// The admin log on the durable store (feature 033, US2): what an operator did, append-only and never
// pruned (FR-009). Its retention is declared: forever. Its volume is operator actions and not traffic —
// orders of magnitude below events or decisions — and pruning only this one would invent an asymmetry
// the ledger of features 030 and 031 deliberately does not have.
//
// **No business key and no unique index**, unlike every other write of this schema: two identical
// actions by the same operator at the same instant are two actions, not a repeat. There is nothing here
// for a store to decide, so there is nothing to conflict on.
//
// `merchant_id` is a column because `listOf` filters by it, and it is **null when the action belongs to
// the platform** — importing the seed, listing merchants. The absence means something, and filtering by
// equality never brings those rows, which is the isolation this log needs.
import { asOperatorId } from "../../../domain/operator/index.js";
import {
  descending,
  fromDocument,
  pageTo,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { AdminLog } from "../../../application/admin/index.js";
import type { AdminEntry } from "../../../domain/admin/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "admin entry";

const INSERT = `INSERT INTO admin_entries (merchant_id, document) VALUES (:merchant, :document)`;

/** Newest first, resuming below the row the cursor names: the key of a row never moves. */
const RECENT = `SELECT id, document FROM admin_entries
  WHERE id < :below ORDER BY id DESC LIMIT :limit`;

const OF_MERCHANT = `SELECT id, document FROM admin_entries
  WHERE merchant_id = :merchant AND id < :below ORDER BY id DESC LIMIT :limit`;

/**
 * What `writable` asks. It is a read, and that is the honest limit of the question: SQLite cannot say
 * whether the next write will succeed without writing, so a full disk still shows up at write time.
 * What this does catch is what an operator most often hits — a store that is closed, a file that is
 * gone, a schema that is not the one this build expects — and the rest is what **D-28** removes by
 * committing the entry with the action it records instead of asking beforehand (ADR-034).
 */
const REACHABLE = `SELECT id FROM admin_entries LIMIT 1`;

const entryOf = (row: SqlRow): AdminEntry => fromDocument(String(row[DOCUMENT])) as AdminEntry;

export function sqliteAdminLog(deps: DurableGatewayDeps): AdminLog {
  const paged = (sql: string, merchantId: string | undefined, query: Parameters<AdminLog["list"]>[0]) => {
    const window = descending(query);
    const rows = deps.store.all(sql, {
      ...(merchantId === undefined ? {} : { merchant: merchantId }),
      below: window.below,
      limit: window.limit,
    });
    return Promise.resolve(
      pageTo(
        rows.map((row) => ({ key: Number(row["id"]), item: entryOf(row) })),
        window,
      ),
    );
  };
  return {
    // The audit trail writes the actor as text (the kernel cannot see the identity it belongs to,
    // ADR-034); the administration owns that identity and types it again here, at the only border
    // where the loss is repaired — the same thing the in-memory log does, for the same reason.
    record: (entry) =>
      stored<undefined>(deps, WRITE, () => {
        deps.store.run(INSERT, {
          merchant: entry.merchantId ?? null,
          document: toDocument({ ...entry, operatorId: asOperatorId(entry.operatorId) }),
        });
        return undefined;
      }),
    writable: () =>
      stored<undefined>(deps, WRITE, () => {
        deps.store.all(REACHABLE);
        return undefined;
      }),
    list: (query) => paged(RECENT, undefined, query),
    listOf: (merchantId, query) => paged(OF_MERCHANT, merchantId, query),
  };
}
