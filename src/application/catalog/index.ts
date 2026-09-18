// Public API of the catalogue module (application).
export { FRESHNESS_BUDGET } from "./policies/freshness.js";
export type { FreshnessBudget } from "./policies/freshness.js";
export { observedSyncLevel, RECEIPTS_KEPT } from "./policies/sync-level.js";
export type { SyncLevel } from "./policies/sync-level.js";
export type { CatalogStore } from "./ports/catalog-store.js";
export { DefaultProductTruthService } from "./services/product-truth.service.js";
export type {
  Freshness,
  ProductTruth,
  ProductTruthService,
  ProductTruthServiceDependencies,
  TruthFreshness,
} from "./services/product-truth.service.js";
export { UpsertCatalogSnapshotUseCase } from "./use-cases/upsert-catalog-snapshot.use-case.js";
export type {
  CatalogSummary,
  UpsertCatalogSnapshotDependencies,
  UpsertCatalogSnapshotRequest,
  UpsertCatalogSnapshotResponse,
} from "./use-cases/upsert-catalog-snapshot.use-case.js";
