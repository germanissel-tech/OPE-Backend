// The notices waiting to be read, on the durable store (feature 044; research R-06): `platform_notices`. Durable
// because a platform notices once — a notice lost in a restart is an order OPE never reads. The unique key of the
// table decides first or repeated, and `next_at` is a column because the scheduler asks for the ones that are due.
import {
  fetched,
  fromDocument,
  stored,
  toDocument,
  type DurableGatewayDeps,
} from "../../shared-kernel/index.js";
import type { NoticeQueue } from "../../../application/platform/index.js";
import type { Notice } from "../../../domain/platform/index.js";
import type { NoticedFlow } from "../../../domain/shared-kernel/index.js";

const KEY = `merchant_id = :merchant AND flow = :flow AND reference = :reference`;

const INSERT = `INSERT INTO platform_notices (merchant_id, flow, reference, next_at, document)
  VALUES (:merchant, :flow, :reference, :nextAt, :document) ON CONFLICT (merchant_id, flow, reference) DO NOTHING`;

const HELD = `SELECT document FROM platform_notices WHERE ${KEY}`;

const DUE = `SELECT document FROM platform_notices WHERE next_at <= :now ORDER BY next_at, id`;

const RESCHEDULE = `UPDATE platform_notices SET next_at = :nextAt, document = :document,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ${KEY}`;

const REMOVE = `DELETE FROM platform_notices WHERE ${KEY}`;

const PENDING = `SELECT flow, COUNT(*) AS pending FROM platform_notices WHERE merchant_id = :merchant GROUP BY flow`;

/** What a write that fails is logged as. */
const WRITE = "platform notice";
/** The column the notice travels in. */
const DOCUMENT = "document";

const keyOf = (notice: Notice) => ({
  merchant: notice.merchantId,
  flow: notice.flow,
  reference: notice.reference,
});

/**
 * The document back as a notice. The cast is true: the document was written from a notice this code built, and
 * its dates come back marked (`fromDocument`).
 */
const noticeOf = (document: unknown): Notice => fromDocument(String(document)) as Notice;

export function sqliteNoticeQueue(deps: DurableGatewayDeps): NoticeQueue {
  return {
    enqueue: (notice) =>
      stored(deps, WRITE, () =>
        deps.store.transaction(() => {
          deps.store.run(INSERT, {
            ...keyOf(notice),
            nextAt: notice.nextAt.toISOString(),
            document: toDocument(notice),
          });
          return noticeOf(deps.store.all(HELD, keyOf(notice))[0]?.[DOCUMENT]);
        }),
      ),
    due: (now) =>
      fetched(deps, () =>
        deps.store.all(DUE, { now: now.toISOString() }).map((row) => noticeOf(row[DOCUMENT])),
      ),
    reschedule: (notice) =>
      stored(deps, WRITE, () => {
        deps.store.run(RESCHEDULE, {
          ...keyOf(notice),
          nextAt: notice.nextAt.toISOString(),
          document: toDocument(notice),
        });
        return undefined;
      }),
    remove: (notice) =>
      stored(deps, WRITE, () => {
        deps.store.run(REMOVE, keyOf(notice));
        return undefined;
      }),
    pendingOf: (merchantId) =>
      fetched(deps, () =>
        Object.fromEntries(
          deps.store
            .all(PENDING, { merchant: merchantId })
            .map((row) => [String(row["flow"]) as NoticedFlow, Number(row["pending"])]),
        ),
      ),
  };
}
