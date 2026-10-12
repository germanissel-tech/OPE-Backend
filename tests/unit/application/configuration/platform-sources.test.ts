// Feature 044 (ADR-047; research R-08): a mode nothing executes cannot be published. The configuration asks the
// deployment which sources it installed and what each one reads every flow by, and refuses a source that is not
// there or a mode it does not read — at the field that names it, on a merchant version and on the defaults.
import { describe, expect, it } from "vitest";
import { Configurations, type PlatformSources } from "../../../../src/application/configuration/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryConfigurationStore } from "../../../../src/interface-adapters/configuration/gateways/memory-configuration-store.js";
import { TEST_NOW } from "../../../helpers/merchants.js";
import { testLevels } from "../../../helpers/test-app.js";
import type { DeclaredConfiguration } from "../../../../src/domain/configuration/index.js";
import type { SourceModes } from "../../../../src/domain/platform/index.js";

const NONE: SourceModes = { catalog: [], stockAndPrice: [], orders: [], returns: [] };
const TEST: SourceModes = {
  catalog: ["pull"],
  stockAndPrice: ["pull"],
  orders: ["pull", "subscribe"],
  returns: ["pull", "subscribe"],
};

/** A deployment with `generic` and, unless told otherwise, the test source. */
const installed = (test: SourceModes = TEST): PlatformSources => ({
  modesOf: (source) => (source === "generic" ? NONE : test),
});

/** A deployment that installed only `generic`. */
const withoutTest: PlatformSources = { modesOf: (source) => (source === "generic" ? NONE : undefined) };

const configurationWith = (sources: PlatformSources) => {
  const levels = testLevels();
  return new Configurations({
    levels: {
      platform: () => Promise.resolve(levels.platform),
      defaults: () => Promise.resolve(levels.defaults),
    },
    store: memoryConfigurationStore(),
    sources,
  });
};

const pointerOf = async (declared: DeclaredConfiguration, sources = installed()) => {
  const judged = await configurationWith(sources).judge({
    merchantId: asMerchantId("m_a"),
    declared,
    corrective: false,
    publishedAt: TEST_NOW,
    operatorId: asOperatorId("ops-all"),
  });
  return judged.ok ? undefined : judged.error.pointer;
};

describe("the sources a deployment installed judge the modes a merchant publishes", () => {
  it("push on every flow needs no source: generic reads nothing and is always enough", async () => {
    expect(await pointerOf({})).toBeUndefined();
    expect(await pointerOf({ platformSource: "generic" })).toBeUndefined();
  });

  it("pull with generic is refused at the flow, because nothing would read it", async () => {
    expect(await pointerOf({ syncStrategy: { catalog: "pull" } })).toBe("syncStrategy.catalog");
    expect(await pointerOf({ syncStrategy: { returns: "pull" } })).toBe("syncStrategy.returns");
  });

  it("a mode the source reads is accepted, and one it does not is refused at its flow", async () => {
    const pulled = { platformSource: "test", syncStrategy: { stockAndPrice: "pull" } } as const;
    expect(await pointerOf(pulled)).toBeUndefined();
    const ordersOnly: SourceModes = { ...NONE, orders: ["pull"] };
    expect(await pointerOf(pulled, installed(ordersOnly))).toBe("syncStrategy.stockAndPrice");
    const subscribed = {
      platformSource: "test",
      syncStrategy: { orders: "subscribe" },
      confirmedOrderStates: ["paid"],
    } as const;
    expect(await pointerOf(subscribed)).toBeUndefined();
    expect(await pointerOf(subscribed, installed(ordersOnly))).toBe("syncStrategy.orders");
  });

  it("a source this deployment did not install is refused, whatever its modes", async () => {
    expect(await pointerOf({ platformSource: "test" }, withoutTest)).toBe("platformSource");
  });

  it("subscribe on the catalogue or on stock and price is refused even by a source that claimed it", async () => {
    const everything: SourceModes = {
      catalog: ["pull", "subscribe"],
      stockAndPrice: ["pull", "subscribe"],
      orders: ["pull", "subscribe"],
      returns: ["pull", "subscribe"],
    };
    for (const flow of ["catalog", "stockAndPrice"] as const) {
      const declared = { platformSource: "test", syncStrategy: { [flow]: "subscribe" } } as const;
      expect(await pointerOf(declared, installed(everything)), flow).toBe(`syncStrategy.${flow}`);
    }
  });

  it("orders pulled with no confirmed state is still refused, with the source installed", async () => {
    const declared = { platformSource: "test", syncStrategy: { orders: "pull" } } as const;
    expect(await pointerOf(declared)).toBe("confirmedOrderStates");
  });

  it("the defaults are judged the same way: a level cannot make every merchant read by a mode nothing executes", async () => {
    const { version, ...content } = testLevels().defaults.record() as unknown as Record<string, unknown>;
    expect(version).toBeDefined();
    const judge = (over: Record<string, unknown>, sources = installed()) =>
      configurationWith(sources).judgeLevel({
        level: "defaults",
        content: { ...content, ...over },
        corrective: false,
        publishedAt: TEST_NOW,
        operatorId: asOperatorId("ops-all"),
      });
    const pulled = { syncStrategy: { ...(content["syncStrategy"] as object), catalog: "pull" } };
    const refused = await judge(pulled);
    expect(refused.ok ? undefined : refused.error.pointer).toBe("syncStrategy.catalog");
    expect((await judge({ ...pulled, platformSource: "test" })).ok).toBe(true);
    const missing = await judge({ platformSource: "test" }, withoutTest);
    expect(missing.ok ? undefined : missing.error.pointer).toBe("platformSource");
    expect((await judge({})).ok).toBe(true);
  });
});
