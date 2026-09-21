// Public API of the catalogue module (application).
export type { CatalogReplaceResult, CatalogStore } from "./ports/catalog-store.js";
export type { CatalogPolicies } from "./ports/catalog-policies.js";
export { DefaultProductTruthService } from "./services/product-truth.service.js";
export type {
  Freshness,
  ProductTruth,
  ProductTruthService,
  ProductTruthServiceDependencies,
} from "./services/product-truth.service.js";
export { UpsertCatalogSnapshotUseCase } from "./use-cases/upsert-catalog-snapshot.use-case.js";
export type {
  CatalogSummary,
  UpsertCatalogSnapshotDependencies,
  UpsertCatalogSnapshotRequest,
  UpsertCatalogSnapshotResponse,
} from "./use-cases/upsert-catalog-snapshot.use-case.js";
