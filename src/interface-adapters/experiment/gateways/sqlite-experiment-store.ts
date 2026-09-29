// The experiments on the durable store (feature 033, US2). Why it exists at all: the **assignments**
// have been durable since feature 030 and the definition was not, so a restart left assignments naming
// an experiment that no longer existed (SC-004).
//
// **It answers its reads from an in-memory index, like the merchants' gateway and for the same reason**
// (**ADR-041**).
// This store is also an `ExperimentDirectory`, and `activeFor` is asked by `Assignments.assign` on
// **every decision** — not in an administration operation. Research R-02 had put this port among the
// cold ones and its amendment of 2026-09-29 says why that was wrong: the read is not even a lookup by
// key, it is every experiment row of the merchant, rehydrated and judged to find the open one. Against a
// remote store (D-21) that is a network round trip inside the decision. The index is sound while there
// is one process and stops being sound the moment there are two, which is written in full in the
// merchants' gateway and is the same limit.
//
// **But the set is judged against the table, not against the index**, and that is the difference with
// the merchants'. "At most one open experiment, no repeated identifier" is an invariant between rows,
// and an invariant is decided by the store: `open` reads the merchant's experiments **inside the
// transaction** that writes, so nothing asynchronous happens between the judgement and the insert
// (`01 §6`). That read is an administration one and therefore cold.
import { Experiment, Experiments, type ExperimentRecord } from "../../../domain/experiment/index.js";
import {
  fromDocument,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { ExperimentDirectory, ExperimentStore } from "../../../application/experiment/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as: the same word for both, because it is the same table. */
const WRITE = "experiment";

const INSERT = `INSERT INTO experiments (merchant_id, experiment_id, document)
  VALUES (:merchant, :experiment, :document)`;

const UPDATE = `UPDATE experiments
  SET document = :document, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE merchant_id = :merchant AND experiment_id = :experiment`;

/** Every experiment there is, oldest first: what fills the index when the gateway is built. */
const ALL = `SELECT document FROM experiments ORDER BY id`;

/** The merchant's, oldest first: the set `open` judges, in the order it was written. */
const OF_MERCHANT = `SELECT document FROM experiments WHERE merchant_id = :merchant ORDER BY id`;

const experimentOf = (row: SqlRow): Experiment =>
  Experiment.rehydrate(fromDocument(String(row[DOCUMENT])) as ExperimentRecord);

export interface SqliteExperimentStoreDeps extends DurableGatewayDeps {
  /**
   * The index this gateway answers from. **Injected and not imported**, because a gateway does not
   * import another gateway (ADR-013): the composition hands it the in-memory store, which already is
   * every experiment of every merchant with the four reads over them.
   */
  readonly index: ExperimentStore & ExperimentDirectory;
}

export function sqliteExperimentStore(
  deps: SqliteExperimentStoreDeps,
): ExperimentStore & ExperimentDirectory {
  const { index } = deps;
  // Filled once, when the gateway is built, and maintained by the writes below. **It does not wait its
  // turn** and it does not need to (feature 034): at boot nothing else runs, so no unit of work can be
  // open. Against a store it
  // cannot read this throws, and at boot that is the right answer: a server that cannot read its
  // experiments would assign visitors as if no experiment existed and nothing would say so.
  for (const row of deps.store.all(ALL)) void index.open(experimentOf(row));

  /**
   * A write, and then the index — **in that order, always**. The index is a view of what the store
   * accepted, so a refused write must leave it alone; the other way round the directory would hand
   * the decision plane an experiment that is not in the table.
   */
  const persisted = async (
    experiment: Experiment,
    sql: string,
    into: (e: Experiment) => Promise<unknown>,
  ): Promise<Result<undefined, StoreUnavailable>> => {
    const written = await stored<undefined>(deps, WRITE, () => {
      deps.store.run(sql, {
        merchant: experiment.merchantId,
        experiment: experiment.experimentId,
        document: toDocument(experiment.record()),
      });
      return undefined;
    });
    if (written.ok) await into(experiment);
    return written;
  };

  return {
    open: async (experiment) => {
      // The judgement and the insert in one transaction: the set is read from the table, so what
      // decides whether this merchant may open another one is the store and not a view of it.
      const written = await stored(deps, WRITE, () =>
        deps.store.transaction(() => {
          const current = deps.store.all(OF_MERCHANT, { merchant: experiment.merchantId }).map(experimentOf);
          const judged = Experiments.of([...current, experiment]);
          if (!judged.ok) return judged;
          deps.store.run(INSERT, {
            merchant: experiment.merchantId,
            experiment: experiment.experimentId,
            document: toDocument(experiment.record()),
          });
          return judged;
        }),
      );
      if (!written.ok) return written;
      if (!written.value.ok) return written.value;
      await index.open(experiment);
      return { ok: true, value: experiment };
    },
    update: async (experiment) => {
      const written = await persisted(experiment, UPDATE, (e) => index.update(e));
      return written.ok ? { ok: true, value: experiment } : written;
    },
    get: (merchantId, experimentId) => index.get(merchantId, experimentId),
    listOf: (merchantId, query) => index.listOf(merchantId, query),
    activeFor: (merchantId: MerchantId) => index.activeFor(merchantId),
  };
}
