// upsertCatalogSnapshot (ADR-025): DTO → domain products (ids branded, prices as Money) → use
// case → 201 created | 200 repeated | the Problem Details of the returned error (422 invariant,
// 409 idempotency conflict, 503 store unavailable with Retry-After).
import { asProductId, asVariantId, type Product } from "../../../domain/catalog/index.js";
import { Money } from "../../../domain/shared-kernel/index.js";
import { idempotent, instantOf } from "../../http/boundary.js";
import { merchantOf } from "../../http/security/principal.js";
import { toProblem } from "../../http/to-problem.js";
import type {
  CatalogSummary,
  UpsertCatalogSnapshotRequest,
  UpsertCatalogSnapshotResponse,
} from "../../../application/catalog/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler, components } from "../../http/typed.js";

type ProductDto = components["schemas"]["CatalogProduct"];
type SummaryDto = components["schemas"]["CatalogSummary"];

function toProduct(dto: ProductDto): Product {
  return {
    productId: asProductId(dto.productId),
    title: dto.title,
    attributes: (dto.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
    variants: dto.variants.map((v) => ({
      variantId: asVariantId(v.variantId),
      size: v.size,
      color: v.color,
      available: v.available,
      price: Money.rehydrate(v.price),
    })),
  };
}

function toSummaryDto(summary: CatalogSummary): SummaryDto {
  return {
    products: summary.products,
    variants: summary.variants,
    receivedAt: summary.receivedAt.toISOString(),
    observedSyncLevel: summary.observedSyncLevel,
  };
}

export function makeUpsertCatalogSnapshot(
  upsert: UseCase<UpsertCatalogSnapshotRequest, UpsertCatalogSnapshotResponse>,
): OperationHandler<"upsertCatalogSnapshot"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await upsert.execute({
      merchantId: merchant.merchantId,
      capturedAt: instantOf(req.body.capturedAt),
      products: req.body.products.map(toProduct),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const body = toSummaryDto(result.value);
    return idempotent(result.value.outcome, body);
  };
}
