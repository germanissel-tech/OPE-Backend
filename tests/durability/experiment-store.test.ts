// The experiments across a restart (feature 033, US2), and **the incoherence this closes** (SC-004).
//
// The assignments have been durable since feature 030 and the definition of the experiment was not, so
// a restart left assignments naming an experiment that no longer existed. It did not show on the seeded
// merchants because the file brings the same identifiers back every boot — which is exactly why it went
// unnoticed: the only way to see it is to open an experiment **through the API**, which mints an
// identifier the file cannot bring back.
//
// So this suite asks the two halves together: the definition comes back, and a visitor who was already
// assigned comes back to the **same arm**, through the same service the decision plane uses.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Assignments,
  type AssignmentService,
  type ExperimentDirectory,
  type ExperimentStore,
} from "../../src/application/experiment/index.js";
import { Experiment } from "../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import {
  memoryExperimentStore,
  sqliteAssignmentLedger,
  sqliteExperimentStore,
} from "../../src/interface-adapters/experiment/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

/** A store over the current connection. After `restart()` this is a different one over the same file. */
const experiments = (): ExperimentStore & ExperimentDirectory =>
  sqliteExperimentStore({
    store: fixture.store,
    logger: fixture.logger,
    index: memoryExperimentStore(),
  });

/** The service the decision plane assigns with, over the durable directory and the durable ledger. */
const assignments = (directory: ExperimentDirectory): AssignmentService =>
  new Assignments({
    experiments: directory,
    assignments: sqliteAssignmentLedger({ store: fixture.store, logger: fixture.logger }),
    clock: { now: () => NOW },
    logger: fixture.logger,
  });

const opened = (over: { experimentId?: string; merchantId?: string; seed?: string } = {}): Experiment => {
  const built = Experiment.of({
    experimentId: asExperimentId(over.experimentId ?? "exp_uno"),
    merchantId: asMerchantId(over.merchantId ?? "m_uno"),
    treatmentShare: 0.5,
    seed: over.seed ?? "seed-alfa",
    targetSample: 1000,
    cuts: [0.5, 1],
    openedAt: NOW,
  });
  if (!built.ok) throw new Error(`test experiment: ${built.error.message}`);
  return built.value;
};

describe("the experiments across a restart", () => {
  it("keeps a calibrating experiment calibrating, with its split, its seed, its sample and its cuts", async () => {
    expect((await experiments().open(opened())).ok).toBe(true);

    fixture.restart();

    const found = await experiments().get(asMerchantId("m_uno"), asExperimentId("exp_uno"));
    expect(found?.status).toBe("calibrating");
    expect(found?.phase()).toBe("calibration");
    expect(found?.treatmentShare).toBe(0.5);
    expect(found?.seed).toBe("seed-alfa");
    expect(found?.targetSample).toBe(1000);
    expect(found?.cuts).toEqual([0.5, 1]);
    // An instant, not a string: `openedAt` is compared and subtracted, and a string does both wrong.
    expect(found?.openedAt).toEqual(NOW);
  });

  it("keeps the restarts of the accumulation window, each with its instant", async () => {
    // The trap of this document: `windowRestarts` is an array of objects and its `at` is a `Date` two
    // levels down. A gateway that revived instants by field name at the root would bring these back as
    // strings, and the window would compare wrong without anything failing.
    const store = experiments();
    await store.open(opened({ experimentId: "exp_dos" }));
    const active = (await store.get(asMerchantId("m_uno"), asExperimentId("exp_dos")))?.activated(
      later(1000),
    );
    const restarted =
      active?.ok === true
        ? active.value.windowRestarted(later(2000), "corrective", {
            level: "merchant",
            configurationVersion: 3,
          })
        : undefined;
    expect(restarted?.ok).toBe(true);
    if (restarted?.ok === true) await store.update(restarted.value);

    fixture.restart();

    const found = await experiments().get(asMerchantId("m_uno"), asExperimentId("exp_dos"));
    expect(found?.status).toBe("active");
    expect(found?.windowStartedAt).toEqual(later(2000));
    // The level of the version that caused it crosses the restart too (feature 036): without it, the number
    // would not say whose version 3 it was.
    expect(found?.windowRestarts).toEqual([
      { at: later(2000), reason: "corrective", level: "merchant", configurationVersion: 3 },
    ]);
    expect(found?.activatedAt).toEqual(later(1000));
  });

  it("judges the set of the merchant against the store, so a second open one is refused after a restart", async () => {
    // At most one open experiment per merchant is an invariant of the set, and after a restart the only
    // thing that knows the merchant already has one is the table.
    await experiments().open(opened({ experimentId: "exp_tres" }));

    fixture.restart();

    const refused = await experiments().open(opened({ experimentId: "exp_cuatro" }));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("experiment-already-open");
    // And nothing of the refused one was written: it is not in the list either.
    const listed = await experiments().listOf(asMerchantId("m_uno"), { limit: 10 });
    expect(listed.items.map((e) => e.experimentId)).toEqual(["exp_tres"]);
  });

  it("refuses an identifier the merchant already used, after the restart too", async () => {
    await experiments().open(opened({ experimentId: "exp_cinco" }));
    const closed = (await experiments().get(asMerchantId("m_uno"), asExperimentId("exp_cinco")))?.closed(
      later(1000),
    );
    if (closed) await experiments().update(closed);

    fixture.restart();

    const refused = await experiments().open(opened({ experimentId: "exp_cinco" }));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("duplicate-experiment-id");
  });

  it("shows a merchant nothing of another one, and lists newest first", async () => {
    const store = experiments();
    await store.open(opened({ experimentId: "exp_seis", merchantId: "m_dos" }));
    await store.open(opened({ experimentId: "exp_siete", merchantId: "m_tres" }));

    fixture.restart();

    const after = experiments();
    expect((await after.listOf(asMerchantId("m_dos"), { limit: 10 })).items.map((e) => e.experimentId)) //
      .toEqual(["exp_seis"]);
    expect(await after.get(asMerchantId("m_dos"), asExperimentId("exp_siete"))).toBeUndefined();
    // The directory of one merchant never answers with another merchant's open experiment.
    expect((await after.activeFor(asMerchantId("m_dos")))?.experimentId).toBe("exp_seis");
  });

  it("[SC-004] leaves no assignment pointing at an experiment that no longer exists", async () => {
    const store = experiments();
    await store.open(opened({ experimentId: "exp_ocho" }));
    const visitor = asVisitorId("vis_00000001");
    const before = await assignments(store).assign(asMerchantId("m_uno"), visitor);
    const arm = before.ok ? before.value?.assignment.arm : undefined;
    expect(arm).toBeDefined();

    fixture.restart();

    // The experiment is still there — this is the half that did not survive before the feature — and
    // the assignment still names it.
    const after = experiments();
    expect((await after.activeFor(asMerchantId("m_uno")))?.experimentId).toBe("exp_ocho");

    const again = await assignments(after).assign(asMerchantId("m_uno"), visitor);
    expect(again.ok ? again.value?.assignment.experimentId : undefined).toBe("exp_ocho");
    // And the same arm, which is the fact the analysis rests on: the visitor is not re-assigned.
    expect(again.ok ? again.value?.assignment.arm : undefined).toBe(arm);
    // Nothing logged the drift between what was recorded and what was computed.
    expect(fixture.logged.some((entry) => entry.message.includes("assignment-drift"))).toBe(false);
  });

  it("degrades instead of throwing when the store cannot accept a write", async () => {
    const store = experiments();
    fixture.makeUnavailable();

    const refused = await store.open(opened({ experimentId: "exp_nueve" }));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});
