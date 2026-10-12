// Where each flow of a merchant stands, in memory (feature 044): the local deployment's, which a restart forgets.
import { ok, type MerchantId, type SyncFlow } from "../../../domain/shared-kernel/index.js";
import type { SyncStateStore } from "../../../application/platform/index.js";
import type { SyncState } from "../../../domain/platform/index.js";

export function memorySyncStateStore(): SyncStateStore {
  const states = new Map<MerchantId, Partial<Record<SyncFlow, SyncState>>>();
  return {
    statesOf: (merchantId) => Promise.resolve({ ...states.get(merchantId) }),
    save(merchantId, flow, state) {
      states.set(merchantId, { ...states.get(merchantId), [flow]: { ...state } });
      return Promise.resolve(ok(undefined));
    },
  };
}
