// Sync strategies port (feature 044, ADR-047): how each flow of a merchant reaches OPE, as its configuration in
// force says. Served from memory by the configuration module, bound by the composition. In the kernel because
// whoever reads it —the entrances of the catalogue and the outcomes, and the platform— cannot depend on each
// other.
import type { MerchantId, SyncFlow, SyncMode } from "../../../domain/shared-kernel/index.js";

export interface SyncStrategies {
  modeOf(merchantId: MerchantId, flow: SyncFlow): Promise<SyncMode>;
}
