// Public API of the catalogue module (domain): the snapshot (which answers about its products
// and variants) and its identities.
export { CatalogSnapshot } from "./catalog-snapshot.js";
export type { Attribute, CatalogSnapshotRecord, Product, Variant } from "./catalog-snapshot.js";
export {
  CatalogCapturedInFuture,
  CatalogDuplicateProductId,
  CatalogDuplicateVariantId,
  CatalogOutOfOrder,
} from "./errors.js";
export type { CatalogError, CatalogPolicyError } from "./errors.js";
export { asProductId, asVariantId } from "./ids.js";
export { SyncLevelRules } from "./sync-level.js";
export type { SyncLevel, SyncLevelRulesRecord } from "./sync-level.js";
export { FreshnessBudget } from "./freshness.js";
export type { FreshnessBudgetRecord } from "./freshness.js";
export type { ProductId, VariantId } from "./ids.js";
