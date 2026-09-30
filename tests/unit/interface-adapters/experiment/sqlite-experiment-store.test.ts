// Feature 033: the durable experiment store answers its reads from an in-memory index — `activeFor` is
// asked on every decision — and **this file is about the one rule that keeps that sound**: the index is
// a view of what the store accepted, so it is touched after a successful write and never before.
//
// It is here and not in the durability suite because it needs a store that **refuses**, and because the
// other half is only visible without a restart: after a successful update the index has to answer the
// new version straight away. The durability suite reads everything through a restart, which rebuilds the
// index from the table and hides whether the write maintained it. The mutation gate found exactly that.
import { describe, expect, it } from "vitest";
import { Experiment } from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryExperimentStore } from "../../../../src/interface-adapters/experiment/gateways/memory-experiment-store.js";
import { sqliteExperimentStore } from "../../../../src/interface-adapters/experiment/gateways/sqlite-experiment-store.js";
import { toDocument } from "../../../../src/interface-adapters/shared-kernel/index.js";
import { experimentRecord } from "../../../helpers/experiments.js";
import { fakeLogger, fakeStore } from "../../../helpers/sql-store.js";

/** What the fixture built, or the failure of the fixture itself: never a case the test is about. */
function theOne<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`the fixture has no ${what}`);
  return value;
}

const NOW = new Date("2026-09-29T10:00:00.000Z");
const MERCHANT = asMerchantId("m_a");
const EXPERIMENT = asExperimentId("exp_00000001");

/** The experiment the table holds, calibrating, as the gateway will read it back. */
const stored = (): string => toDocument(experimentRecord({ status: "calibrating" }));

/**
 * A store that answers every read with `rows` and either accepts or refuses every write. `statements`
 * records what it was asked, which is how "the table was not read again" is checked without reaching
 * inside the gateway.
 */
function subject(options: { rows?: readonly string[]; refuses?: boolean } = {}) {
  const fake = fakeStore(options);
  const recorder = fakeLogger();
  const experiments = sqliteExperimentStore({
    store: fake.store,
    logger: recorder.logger,
    index: memoryExperimentStore(),
  });
  return { experiments, reads: fake.reads, logged: recorder.entries };
}

describe("sqliteExperimentStore", () => {
  it("fills its index once, when it is built, and answers every read of the decision path from it", () => {
    const { experiments, reads } = subject({ rows: [stored()] });
    expect(reads()).toBe(1);

    return Promise.all([
      experiments.activeFor(MERCHANT),
      experiments.get(MERCHANT, EXPERIMENT),
      experiments.listOf(MERCHANT, { limit: 10 }),
    ]).then(([active, found, listed]) => {
      expect(active?.experimentId).toBe(EXPERIMENT);
      expect(found?.status).toBe("calibrating");
      expect(listed.items).toHaveLength(1);
      // And none of the three added a statement: the table was read when the gateway was built.
      expect(reads()).toBe(1);
    });
  });

  it("answers the new version as soon as the store accepted it, without a restart", async () => {
    // The half the durability suite cannot see: it reads through a restart, which rebuilds the index
    // from the table. A gateway that wrote the row and never touched the index would pass there and
    // serve the decision plane a closed experiment as open until the next deploy.
    const { experiments } = subject({ rows: [stored()] });
    const open = theOne(await experiments.get(MERCHANT, EXPERIMENT), "experiment in the index");

    const closed = await experiments.update(open.closed(NOW));
    expect(closed.ok).toBe(true);

    expect((await experiments.get(MERCHANT, EXPERIMENT))?.status).toBe("closed");
    // Closed is not open, so the decision plane stops assigning to it in the very next batch.
    expect(await experiments.activeFor(MERCHANT)).toBeUndefined();
  });

  it("leaves the index alone when the store refused the update, so it never answers what was not written", async () => {
    const { experiments, logged } = subject({ rows: [stored()], refuses: true });
    const open = theOne(await experiments.get(MERCHANT, EXPERIMENT), "experiment in the index");

    const refused = await experiments.update(open.closed(NOW));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");

    expect((await experiments.get(MERCHANT, EXPERIMENT))?.status).toBe("calibrating");
    expect((await experiments.activeFor(MERCHANT))?.experimentId).toBe(EXPERIMENT);
    expect(logged).toHaveLength(1);
  });

  it("leaves the index alone when the store refused to open one", async () => {
    const { experiments } = subject({ refuses: true });
    const built = Experiment.of({
      experimentId: asExperimentId("exp_00000002"),
      merchantId: MERCHANT,
      treatmentShare: 0.5,
      seed: "seed-a",
      targetSample: 100,
      cuts: [],
      openedAt: NOW,
    });
    const refused = await experiments.open(theOne(built.ok ? built.value : undefined, "experiment"));
    expect(refused.ok).toBe(false);

    expect(await experiments.activeFor(MERCHANT)).toBeUndefined();
    expect((await experiments.listOf(MERCHANT, { limit: 10 })).items).toHaveLength(0);
  });
});
