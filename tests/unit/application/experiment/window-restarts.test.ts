// Feature 038 (the mechanism of 036, extracted): the windows of the experiments a publication reaches
// restart with the cause recorded, each one written; nothing to restart demands nothing, and a store that
// refuses is the failure of the port.
import { describe, expect, it } from "vitest";
import { WindowRestarts, type ExperimentStore } from "../../../../src/application/experiment/index.js";
import { StoreUnavailable, asMerchantId, fail, ok } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");

const activeOf = (merchant: string): Experiment => {
  const activated = testExperiment({ merchantId: merchant }).activated(AT);
  if (!activated.ok) throw new Error(activated.error.message);
  return activated.value;
};

const storeOf = (refuses = false) => {
  const written: Experiment[] = [];
  const store: ExperimentStore = {
    open: () => Promise.reject(new Error("not opened here")),
    update: (experiment) => {
      if (refuses) return Promise.resolve(fail(new StoreUnavailable()));
      written.push(experiment);
      return Promise.resolve(ok(experiment));
    },
    get: () => Promise.resolve(undefined),
    listOf: () => Promise.reject(new Error("not listed here")),
  };
  return { store, written };
};

describe("WindowRestarts", () => {
  it("restarts each experiment with the cause and writes each one", async () => {
    const { store, written } = storeOf();
    const restarts = new WindowRestarts({ experimentStore: store });
    const cause = { at: AT, reason: "a typo", level: "defaults" as const, version: 2 };
    const done = await restarts.restart([activeOf("m_a"), activeOf("m_b")], cause);
    expect(done).toEqual({ ok: true, value: undefined });
    expect(written.map((e) => e.merchantId)).toEqual(["m_a", "m_b"]);
    expect(written[0]?.windowRestarts).toEqual([
      { at: AT, reason: "a typo", level: "defaults", configurationVersion: 2 },
    ]);
  });

  it("records the text that caused it, key and layer, when the cause is a text", async () => {
    const { store, written } = storeOf();
    const text = { family: "fit.policies.reassurance", locale: "es", merchantId: asMerchantId("m_a") };
    await new WindowRestarts({ experimentStore: store }).restart([activeOf("m_a")], {
      at: AT,
      reason: "wording",
      level: "merchant",
      version: 3,
      text,
    });
    expect(written[0]?.windowRestarts[0]?.text).toEqual(text);
  });

  it("nothing to restart demands nothing, not even a reason", async () => {
    const { store, written } = storeOf();
    const done = await new WindowRestarts({ experimentStore: store }).restart([], {
      at: AT,
      level: "defaults",
      version: 2,
    });
    expect(done).toEqual({ ok: true, value: undefined });
    expect(written).toEqual([]);
  });

  it("a store that refuses is the failure of the port", async () => {
    const { store } = storeOf(true);
    const done = await new WindowRestarts({ experimentStore: store }).restart([activeOf("m_a")], {
      at: AT,
      reason: "r",
      level: "defaults",
      version: 2,
    });
    expect(done.ok).toBe(false);
    expect(done.ok ? undefined : done.error.code).toBe("store-unavailable");
  });
});
