// The notices waiting to be read (feature 044; research R-06): `platform_notices`, durable so a restart does not
// lose a notice the platform will not send again. One per reference of a flow while it is pending: the store
// decides first or repeated by its unique key, not a read before the write.
import type { Notice } from "../../../domain/platform/index.js";
import type {
  MerchantId,
  NoticedFlow,
  Result,
  StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";

export interface NoticeQueue {
  /** Queues the notice; one of the same reference already pending is the one that answers. */
  enqueue(notice: Notice): Promise<Result<Notice, StoreUnavailable>>;
  /** Every pending notice whose next read is due at `now`, the oldest due first. */
  due(now: Date): Promise<readonly Notice[]>;
  /** Replaces a pending notice with its next attempt. */
  reschedule(notice: Notice): Promise<Result<undefined, StoreUnavailable>>;
  /** Forgets a notice that was read, or whose attempts ran out. */
  remove(notice: Notice): Promise<Result<undefined, StoreUnavailable>>;
  /** How many notices of each flow are pending; a flow with none is absent. */
  pendingOf(merchantId: MerchantId): Promise<Partial<Record<NoticedFlow, number>>>;
}
