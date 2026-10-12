// Where the reading of each flow of a merchant stands (feature 044; research R-10): `platform_sync`, one row per
// merchant and flow. Durable, so a restart resumes the cycle where it was instead of at the start.
import type { SyncState } from "../../../domain/platform/index.js";
import type { MerchantId, Result, StoreUnavailable, SyncFlow } from "../../../domain/shared-kernel/index.js";

export interface SyncStateStore {
  /** The state of every flow that ever ran; a flow that never did is absent. */
  statesOf(merchantId: MerchantId): Promise<Partial<Record<SyncFlow, SyncState>>>;
  /** Replaces the state of the flow; or says it cannot, and the cursor stays where it was. */
  save(
    merchantId: MerchantId,
    flow: SyncFlow,
    state: SyncState,
  ): Promise<Result<undefined, StoreUnavailable>>;
}
