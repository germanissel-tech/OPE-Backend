// Decision ledger on the durable store. Same key as the one in memory —merchant plus decision, so
// another merchant's decision does not exist for whoever asks— and the same secondary read by
// session, which here is an index instead of a second map.
//
// `bySession` answers "in the order they were recorded", and that order is SQLite's `rowid`: it is
// monotonic per insert, so nothing has to carry a counter that could disagree with what actually
// happened.
//
// **The document comes from `decision.record()`, not from a copy made here.** Listing the fields
// in the gateway would put the shape of the domain in the one place that cannot be kept in step
// with it: the day the domain gains a field it would be dropped silently, noticed by whichever
// test happened to carry it. The entity knows its own record, as `Order` already did.
import { DecisionBase, type Decision, type DecisionRecord } from "../../../domain/ledger/index.js";
import { fromDocument, toDocument } from "../../shared-kernel/index.js";
import { attempted, type DurableGatewayDeps } from "./durable-write.js";
import type { DecisionLedger } from "../../../application/ledger/index.js";

/** The column every table of the ledger keeps the record in. */
const DOCUMENT = "document";

/**
 * No `ON CONFLICT`: a decision already recorded is **not** overwritten, and the key refusing the
 * write is what says so. The ledger is immutable, so a repeated identifier is not an update to
 * accept quietly — it is a minted identifier that collided, and the only honest answer is the one
 * the failure channel already has: the write did not happen, the decision degrades to `NO_OP` with
 * `ledger-unavailable` (ADR-021) and the plane fails closed (constitution II).
 *
 * With 128-bit random identifiers this cannot happen. That is the point: if it ever does, it is a
 * broken generator, and losing the evidence of the first decision would be the worst possible way
 * to find out.
 */
const INSERT = `INSERT INTO decisions (merchant_id, decision_id, session_id, document)
  VALUES (:merchant, :decision, :session, :document)`;

const BY_ID = `SELECT document FROM decisions WHERE merchant_id = :merchant AND decision_id = :decision`;

const BY_SESSION = `SELECT document FROM decisions
  WHERE merchant_id = :merchant AND session_id = :session ORDER BY rowid`;

export function sqliteDecisionLedger(deps: DurableGatewayDeps): DecisionLedger {
  return {
    record: (decision) =>
      attempted(deps, "decision", () => {
        deps.store.run(INSERT, {
          merchant: decision.merchantId,
          decision: decision.decisionId,
          session: decision.sessionId,
          document: toDocument(decision.record()),
        });
      }),
    find: (merchantId, decisionId) =>
      Promise.resolve(first(deps.store.all(BY_ID, { merchant: merchantId, decision: decisionId }))),
    bySession: (merchantId, sessionId) =>
      Promise.resolve(
        deps.store
          .all(BY_SESSION, { merchant: merchantId, session: sessionId })
          .map((row) => decisionOf(row[DOCUMENT])),
      ),
  };
}

const first = (rows: readonly Readonly<Record<string, unknown>>[]): Decision | undefined =>
  rows.length === 0 ? undefined : decisionOf(rows[0]?.[DOCUMENT]);

/**
 * The document back as the entity. The cast is where the reasoning leaves the compiler: what was
 * written came from a decision this code had already judged, and `rehydrate` is defined not to
 * judge it again (ADR-024). Re-validating here would be the domain's rules written a second time,
 * in the one place that cannot be kept in step with them.
 */
const decisionOf = (document: unknown): Decision =>
  DecisionBase.rehydrate(fromDocument(String(document)) as DecisionRecord);
