// Feature 038 (FR-014): a base text reaches the active experiments of every merchant without its own text
// in force for that key and language; with one, out; in calibration, out. A merchant's text reaches only
// the merchant's. And a restart records the text that caused it.
import { describe, expect, it } from "vitest";
import {
  WindowRestarts,
  type ExperimentDirectory,
  type ExperimentStore,
} from "../../../../src/application/experiment/index.js";
import { ReachedByText } from "../../../../src/application/messages/index.js";
import { TextVersion, type TextDraft } from "../../../../src/domain/messages/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId, ok } from "../../../../src/domain/shared-kernel/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import { testMerchant } from "../../../helpers/merchants.js";
import type { MerchantStore } from "../../../../src/application/merchant/index.js";
import type { Experiment, ExperimentStatus } from "../../../../src/domain/experiment/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const KEY = { family: "fit.policies.reassurance", locale: "es" };

interface Tenant {
  id: string;
  /** Whether the merchant has its own text in force for the key: published, removed, or none. */
  own?: "published" | "removed";
  status?: ExperimentStatus | "none";
}

const draft = (over: Partial<TextDraft> = {}): TextDraft => ({
  key: KEY,
  text: "Base.",
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops-all"),
  ...over,
});

async function given(tenants: readonly Tenant[]) {
  const updated: Experiment[] = [];
  const texts = memoryTextStore();
  await texts.publish(draft());
  for (const tenant of tenants) {
    if (tenant.own === undefined) continue;
    await texts.publish(draft({ merchantId: asMerchantId(tenant.id), text: "Own." }));
    if (tenant.own === "removed") {
      await texts.publish(
        Object.fromEntries(
          Object.entries(draft({ merchantId: asMerchantId(tenant.id) })).filter(
            ([field]) => field !== "text",
          ),
        ) as TextDraft,
      );
    }
  }
  const merchants = {
    list: () => Promise.resolve({ items: tenants.map((t) => testMerchant({ merchantId: t.id })) }),
  } as unknown as MerchantStore;
  const experiments = {
    activeFor: (merchantId: string) => {
      const tenant = tenants.find((t) => t.id === merchantId);
      const status = tenant?.status ?? "active";
      if (tenant === undefined || status === "none") return Promise.resolve(undefined);
      return Promise.resolve(testExperiment({ merchantId, experimentId: `exp_${merchantId}`, status }));
    },
  } as unknown as ExperimentDirectory;
  const experimentStore = {
    update: (experiment: Experiment) => {
      updated.push(experiment);
      return Promise.resolve(ok(experiment));
    },
  } as unknown as ExperimentStore;
  const service = new ReachedByText({
    merchants,
    experiments,
    texts,
    restarts: new WindowRestarts({ experimentStore }),
  });
  return { service, updated: () => updated };
}

const ids = (experiments: readonly Experiment[]): string[] => experiments.map((e) => e.merchantId).sort();

describe("ReachedByText.by", () => {
  it("a base text reaches the active experiments of the merchants without their own text", async () => {
    const { service } = await given([{ id: "m_a" }, { id: "m_b", own: "published" }, { id: "m_c" }]);
    expect(ids(await service.by(undefined, KEY))).toEqual(["m_a", "m_c"]);
  });

  it("a merchant that removed its own text is back on the base, and reached again", async () => {
    const { service } = await given([{ id: "m_a", own: "removed" }]);
    expect(ids(await service.by(undefined, KEY))).toEqual(["m_a"]);
  });

  it("only an active experiment counts: calibrating, closed or none are out", async () => {
    const { service } = await given([
      { id: "m_a", status: "calibrating" },
      { id: "m_b", status: "closed" },
      { id: "m_c", status: "none" },
      { id: "m_d" },
    ]);
    expect(ids(await service.by(undefined, KEY))).toEqual(["m_d"]);
  });

  it("another key or another language of the same family is another text: the own text does not shield it", async () => {
    const { service } = await given([{ id: "m_a", own: "published" }]);
    expect(ids(await service.by(undefined, { ...KEY, locale: "en" }))).toEqual(["m_a"]);
  });

  it("a merchant's text reaches only that merchant's active experiment, whatever the others do", async () => {
    const { service } = await given([{ id: "m_a" }, { id: "m_b" }]);
    expect(ids(await service.by(asMerchantId("m_b"), KEY))).toEqual(["m_b"]);
    const { service: calibrating } = await given([{ id: "m_a", status: "calibrating" }]);
    expect(await calibrating.by(asMerchantId("m_a"), KEY)).toEqual([]);
  });
});

describe("ReachedByText.restart", () => {
  it("restarts each reached experiment recording the text that caused it", async () => {
    const { service, updated } = await given([{ id: "m_a" }, { id: "m_b" }]);
    const reached = await service.by(undefined, KEY);
    const version = TextVersion.numbered(draft({ corrective: true, reason: "wording" }), 2);
    const done = await service.restart(reached, version);
    expect(done).toEqual({ ok: true, value: undefined });
    expect(
      updated()
        .map((e) => e.merchantId)
        .sort(),
    ).toEqual(["m_a", "m_b"]);
    expect(updated()[0]?.windowRestarts[0]).toEqual({
      at: AT,
      reason: "wording",
      level: "defaults",
      configurationVersion: 2,
      text: { family: KEY.family, locale: "es" },
    });
  });

  it("a merchant's text records its layer, so the restart names whose text it was", async () => {
    const { service, updated } = await given([{ id: "m_a" }]);
    const own = TextVersion.numbered(
      draft({ merchantId: asMerchantId("m_a"), corrective: true, reason: "r" }),
      1,
    );
    await service.restart(await service.by(asMerchantId("m_a"), KEY), own);
    expect(updated()[0]?.windowRestarts[0]?.text).toEqual({
      family: KEY.family,
      locale: "es",
      merchantId: "m_a",
    });
    expect(updated()[0]?.windowRestarts[0]?.level).toBe("merchant");
  });

  it("nothing reached demands nothing, not even a reason", async () => {
    const { service, updated } = await given([{ id: "m_a", own: "published" }]);
    const done = await service.restart(await service.by(undefined, KEY), TextVersion.numbered(draft(), 2));
    expect(done.ok).toBe(true);
    expect(updated()).toEqual([]);
  });
});
