// Public API of the catalogue module (application).
export type { CatalogRefreshResult, CatalogReplaceResult, CatalogStore } from "./ports/catalog-store.js";
export type { CatalogPolicies } from "./ports/catalog-policies.js";
export type { AttributeLabelReportService } from "./services/attribute-label-report.service.js";
export { ProductTruths } from "./services/product-truth.service.js";
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
export { RefreshStockAndPriceUseCase } from "./use-cases/refresh-stock-and-price.use-case.js";
export type {
  RefreshStockAndPriceDependencies,
  RefreshStockAndPriceRequest,
  RefreshStockAndPriceResponse,
} from "./use-cases/refresh-stock-and-price.use-case.js";
