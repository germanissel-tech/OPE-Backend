// Catalogue policies port (ADR-025; constitution XI): what the configuration resolves for a
// merchant about its catalogue — the freshness budgets and the synchronisation level rules —
// served from memory by the configuration module, bound by the composition.
import type { FreshnessBudget, SyncLevelRules } from "../../../domain/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface CatalogPolicies {
  freshnessFor(merchantId: MerchantId): Promise<FreshnessBudget>;
  syncLevelRulesFor(merchantId: MerchantId): Promise<SyncLevelRules>;
}
