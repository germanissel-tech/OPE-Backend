// upsertCatalogSnapshot (ADR-025): DTO → domain products (ids branded, prices as Money) → use
// case → 201 created | 200 repeated | the Problem Details of the returned error (422 invariant,
// 409 idempotency conflict, 503 store unavailable with Retry-After).
import { asProductId, asVariantId, type Product } from "../../../../domain/catalog/index.js";
import { Money } from "../../../../domain/shared-kernel/index.js";
import { merchantOf } from "../../security/ingest-key.js";
import { toProblem } from "../../to-problem.js";
import type {
  CatalogSummary,
  UpsertCatalogSnapshotRequest,
  UpsertCatalogSnapshotResponse,
} from "../../../../application/catalog/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { components } from "../../generated/api.js";
import type { OperationHandler } from "../../typed.js";

type ProductDto = components["schemas"]["CatalogProduct"];
type SummaryDto = components["schemas"]["CatalogSummary"];

/** The contract validated `date-time`; a value Date cannot parse is a programming error, not a business one. */
function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}

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
    return result.value.outcome === "created" ? { status: 201, body } : { status: 200, body };
  };
}
