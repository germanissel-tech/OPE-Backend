// What the platform module reads of a merchant's effective configuration (constitution XI; ADR-031, ADR-047):
// the source, the mode of each flow, the cadence and what counts as a confirmed order. Declared here and bound by
// the configuration, which can see every consumer; nobody here imports it.
import type { OrderConfirmation, PlatformSourceName, SyncCadence } from "../../../domain/platform/index.js";
import type { MerchantId, SyncStrategy } from "../../../domain/shared-kernel/index.js";

export interface PlatformPolicy {
  source: PlatformSourceName;
  strategy: SyncStrategy;
  cadence: SyncCadence;
  confirmation: OrderConfirmation;
}

export interface PlatformPolicies {
  /** Read on every run: a new configuration version counts on the next one, without a restart. */
  policyFor(merchantId: MerchantId): Promise<PlatformPolicy>;
}
