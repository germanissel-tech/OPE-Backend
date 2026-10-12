// Use case: the stock and price of some variants, without the rest of the catalogue (feature 044, ADR-047).
// The refresh is built by its factory (unique variants, nothing observed in the future beyond the skew) and
// the store judges each item against the snapshot and the refresh it keeps, in one step: `applied` becomes
// the truth of its variant, `repeated` already was, `superseded` lost to something newer, and `unknown` names
// a variant the snapshot does not have. The answer is per item, so it is the same whoever drives it: the
// platform by `push` or the scheduler by `pull`. A store that cannot keep it answers LedgerUnavailable and
// nothing was kept (ADR-021).
import {
  StockAndPriceRefresh,
  type RefreshError,
  type RefreshOutcomes,
  type StockAndPriceRecord,
} from "../../../domain/catalog/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, ClockTolerance, Logger, UseCase } from "../../shared-kernel/index.js";
import type { CatalogPolicies } from "../ports/catalog-policies.js";
import type { CatalogStore } from "../ports/catalog-store.js";

export interface RefreshStockAndPriceRequest {
  merchantId: MerchantId;
  items: readonly StockAndPriceRecord[];
}

export type RefreshStockAndPriceResponse = Result<RefreshOutcomes, RefreshError | LedgerUnavailable>;

export interface RefreshStockAndPriceDependencies {
  clock: Clock;
  tolerance: ClockTolerance;
  store: CatalogStore;
  policies: CatalogPolicies;
  logger: Logger;
}

export class RefreshStockAndPriceUseCase implements UseCase<
  RefreshStockAndPriceRequest,
  RefreshStockAndPriceResponse
> {
  readonly #deps: RefreshStockAndPriceDependencies;

  constructor(deps: RefreshStockAndPriceDependencies) {
    this.#deps = deps;
  }

  async execute(request: RefreshStockAndPriceRequest): Promise<RefreshStockAndPriceResponse> {
    const { clock, tolerance, store, policies, logger } = this.#deps;
    const built = StockAndPriceRefresh.of(
      { merchantId: request.merchantId, receivedAt: clock.now(), items: request.items },
      tolerance.skewMs(),
    );
    if (!built.ok) return fail(built.error);
    const rules = await policies.syncLevelRulesFor(request.merchantId);
    const kept = await store.refresh(built.value, rules.receiptsKept);
    if (!kept.ok) return fail(kept.error);
    const outcomes = kept.value;
    logger.info(
      {
        merchantId: request.merchantId,
        applied: outcomes.applied.length,
        repeated: outcomes.repeated.length,
        superseded: outcomes.superseded.length,
        unknown: outcomes.unknown.length,
      },
      "stock and price refreshed",
    );
    return ok(outcomes);
  }
}
