// Which experiments a change of a level reaches, and what a restart records (feature 036, FR-007, FR-008).
//
// **This is the unit where the feature can be wrong without anything looking wrong.** Publishing a level is
// easy to get right; deciding who it reaches is not, and the consequence of getting it wrong is invisible —
// a measurement window that keeps running over a treatment that changed, and a number that nobody doubts
// until it is used. So the cases here are about reach and nothing else, with doubles for the four stores.
import { describe, expect, it } from "vitest";
import {
  ReachedExperiments,
  type ConfigurationStore,
  type ReachedExperimentsDependencies,
} from "../../../../src/application/configuration/index.js";
import {
  WindowRestarts,
  type ExperimentDirectory,
  type ExperimentStore,
} from "../../../../src/application/experiment/index.js";
import {
  ChangedLeaves,
  LevelVersion,
  MerchantConfigurationVersion,
  type DeclaredConfiguration,
} from "../../../../src/domain/configuration/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId, ok } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import { testMerchant } from "../../../helpers/merchants.js";
import type { MerchantStore } from "../../../../src/application/merchant/index.js";
import type { Experiment, ExperimentStatus } from "../../../../src/domain/experiment/index.js";

const AT = new Date("2026-10-01T12:00:00.000Z");

interface Tenant {
  id: string;
  /** What the merchant declares of the treatment; absent means it published no version at all. */
  declared?: DeclaredConfiguration;
  status?: ExperimentStatus | "none";
}

/** The four stores a reach question needs, answered from a list of tenants. */
function given(tenants: readonly Tenant[]): {
  deps: ReachedExperimentsDependencies;
  updated: () => readonly Experiment[];
} {
  const updated: Experiment[] = [];
  const merchants = {
    list: () =>
      Promise.resolve({
        items: tenants.map((t) => testMerchant({ merchantId: t.id })),
      }),
  } as unknown as MerchantStore;
  const configurations = {
    latestOf: (merchantId: string) => {
      const tenant = tenants.find((t) => t.id === merchantId);
      if (tenant?.declared === undefined) return Promise.resolve(undefined);
      return Promise.resolve(
        MerchantConfigurationVersion.numbered(
          {
            merchantId: asMerchantId(tenant.id),
            declared: tenant.declared,
            corrective: false,
            publishedAt: AT,
            operatorId: asOperatorId("ops-all"),
          },
          1,
        ),
      );
    },
  } as unknown as ConfigurationStore;
  const experiments = {
    activeFor: (merchantId: string) => {
      const tenant = tenants.find((t) => t.id === merchantId);
      if (tenant === undefined) return Promise.resolve(undefined);
      const status = tenant.status ?? "active";
      if (status === "none") return Promise.resolve(undefined);
      return Promise.resolve(
        testExperiment({ merchantId: tenant.id, experimentId: `exp_${tenant.id}`, status }),
      );
    },
  } as unknown as ExperimentDirectory;
  const experimentStore = {
    update: (experiment: Experiment) => {
      updated.push(experiment);
      return Promise.resolve(ok(experiment));
    },
  } as unknown as ExperimentStore;
  // The restart is the experiment module's (feature 038); this test still sees what it wrote through the store.
  const restarts = new WindowRestarts({ experimentStore });
  return { deps: { merchants, configurations, experiments, restarts }, updated: () => updated };
}

const reaching = (from: object, to: object): ChangedLeaves => ChangedLeaves.between(from, to);

const corrective = (reason: string): LevelVersion =>
  LevelVersion.numbered(
    {
      level: "defaults",
      content: {},
      corrective: true,
      reason,
      publishedAt: AT,
      operatorId: asOperatorId("ops-all"),
    },
    4,
  );

describe("ReachedExperiments.by", () => {
  const changed = reaching({ decisionPolicy: { threshold: 0.6 } }, { decisionPolicy: { threshold: 0.8 } });

  it("reaches an active experiment of a merchant that declares nothing of what changed", async () => {
    const { deps } = given([{ id: "m_a" }]);
    const reached = await new ReachedExperiments(deps).by(changed);
    expect(reached.map((e) => e.merchantId)).toEqual(["m_a"]);
  });

  it("does not reach one whose merchant declares every leaf that changed", async () => {
    const { deps } = given([
      { id: "m_a", declared: { decisionPolicy: { version: "mine-1", threshold: 0.9 } } },
    ]);
    expect(await new ReachedExperiments(deps).by(changed)).toEqual([]);
  });

  it("**reaches one whose merchant declares only some of the leaves**", async () => {
    // The case the whole feature turns on. Two leaves of the same object change; the merchant declares one.
    // By field it would look covered, and its window would keep running over a treatment that moved.
    const two = reaching(
      { decisionPolicy: { threshold: 0.6, readingSeconds: 5 } },
      { decisionPolicy: { threshold: 0.8, readingSeconds: 9 } },
    );
    const { deps } = given([
      { id: "m_a", declared: { decisionPolicy: { version: "mine-1", threshold: 0.9 } } },
    ]);
    expect((await new ReachedExperiments(deps).by(two)).map((e) => e.merchantId)).toEqual(["m_a"]);
  });

  it("ignores a merchant in calibration and one with no experiment at all", async () => {
    // Calibrating decisions are already excluded from the analysis, so there is no measurement to protect.
    const { deps } = given([
      { id: "m_a", status: "calibrating" },
      { id: "m_b", status: "closed" },
      { id: "m_c", status: "none" },
    ]);
    expect(await new ReachedExperiments(deps).by(changed)).toEqual([]);
  });

  it("reaches several merchants at once, which is what multitenant means here", async () => {
    const { deps } = given([
      { id: "m_a" },
      { id: "m_b", declared: { decisionPolicy: { version: "mine-1", threshold: 0.5 } } },
      { id: "m_c" },
    ]);
    expect((await new ReachedExperiments(deps).by(changed)).map((e) => e.merchantId)).toEqual(["m_a", "m_c"]);
  });

  it("reaches nobody when nothing changed, without asking a single store", async () => {
    // A repeated publication must not restart anything, and it must not pay for asking either.
    let asked = 0;
    const merchants = {
      list: () => {
        asked += 1;
        return Promise.resolve({ items: [] });
      },
    } as unknown as MerchantStore;
    const { deps } = given([{ id: "m_a" }]);
    const reached = await new ReachedExperiments({ ...deps, merchants }).by(reaching({ a: 1 }, { a: 1 }));
    expect(reached).toEqual([]);
    expect(asked).toBe(0);
  });
});

describe("ReachedExperiments.restart", () => {
  it("records the instant, the reason, the level and the number on each one", async () => {
    const { deps, updated } = given([{ id: "m_a" }, { id: "m_b" }]);
    const service = new ReachedExperiments(deps);
    const reached = await service.by(reaching({ x: 1 }, { x: 2 }));

    const done = await service.restart(reached, corrective("threshold raised"));

    expect(done.ok).toBe(true);
    expect(updated()).toHaveLength(2);
    for (const experiment of updated()) {
      expect(experiment.windowStartedAt).toEqual(AT);
      expect(experiment.windowRestarts).toEqual([
        { at: AT, reason: "threshold raised", level: "defaults", configurationVersion: 4 },
      ]);
    }
  });

  it("asks nothing of a version that restarts nothing, which is not an error", async () => {
    // **The defect this case exists for.** The first version demanded the reason before looking at whether
    // there was anything to restart, so a publication that reached nobody — the ordinary one — threw.
    const { deps, updated } = given([]);
    const notCorrective = LevelVersion.numbered(
      {
        level: "defaults",
        content: {},
        corrective: false,
        publishedAt: AT,
        operatorId: asOperatorId("ops-all"),
      },
      2,
    );

    expect((await new ReachedExperiments(deps).restart([], notCorrective)).ok).toBe(true);
    expect(updated()).toEqual([]);
  });

  it("refuses to restart what is not active, because that is a programming error", async () => {
    const { deps } = given([]);
    const closed = testExperiment({ merchantId: "m_a", status: "closed" });
    await expect(new ReachedExperiments(deps).restart([closed], corrective("why"))).rejects.toThrow(
      "not active",
    );
  });

  it("stops at the first store that cannot write, instead of reporting a restart that did not happen", async () => {
    const { deps } = given([{ id: "m_a" }]);
    const refusing = {
      update: () => Promise.resolve({ ok: false as const, error: { code: "store-unavailable" } }),
    } as unknown as ExperimentStore;
    const service = new ReachedExperiments({
      ...deps,
      restarts: new WindowRestarts({ experimentStore: refusing }),
    });
    const reached = await service.by(reaching({ x: 1 }, { x: 2 }));

    const done = await service.restart(reached, corrective("why"));

    expect(done.ok).toBe(false);
  });
});
