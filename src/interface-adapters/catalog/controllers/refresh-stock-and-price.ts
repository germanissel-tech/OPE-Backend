// refreshStockAndPrice (feature 044, ADR-047): DTO → items (ids branded, prices and instants as the contract
// validated them) → use case → 200 with what became of each item | the Problem Details of the returned error
// (422 invariant, 409 stock and price that do not arrive by push, 503 store unavailable with Retry-After).
import {
  asVariantId,
  type RefreshOutcomes,
  type StockAndPriceRecord,
} from "../../../domain/catalog/index.js";
import { instantOf } from "../../http/boundary.js";
import { merchantOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import type {
  RefreshStockAndPriceRequest,
  RefreshStockAndPriceResponse,
} from "../../../application/catalog/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { Fail, SyncModeNotConfigured } from "../../../domain/shared-kernel/index.js";
import type { OperationHandler, components } from "../../http/typed.js";

type ItemDto = components["schemas"]["RefreshItem"];
type ResultDto = components["schemas"]["RefreshResult"];

function toItem(dto: ItemDto): StockAndPriceRecord {
  return {
    variantId: asVariantId(dto.variantId),
    available: dto.available,
    price: dto.price,
    observedAt: instantOf(dto.observedAt),
  };
}

function toResultDto(outcomes: RefreshOutcomes): ResultDto {
  return {
    applied: [...outcomes.applied],
    repeated: [...outcomes.repeated],
    superseded: [...outcomes.superseded],
    unknown: [...outcomes.unknown],
  };
}

export function makeRefreshStockAndPrice(
  refresh: UseCase<RefreshStockAndPriceRequest, RefreshStockAndPriceResponse | Fail<SyncModeNotConfigured>>,
): OperationHandler<"refreshStockAndPrice"> {
  return async (req) => {
    const result = await refresh.execute({
      merchantId: merchantOf(req).merchantId,
      items: req.body.items.map(toItem),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: toResultDto(result.value) };
  };
}
