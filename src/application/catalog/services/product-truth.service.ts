// Application service: the truth of a variant for whoever decides (feature 011), read from the
// hot cache, never from the platform (01 §4.6). Freshness is judged per class of datum
// (01 §8): beyond the catalogue budget nothing is true; between the two budgets the variant
// exists but availability and price are stale and sustain no claim. Fail-closed: "unknown" with
// a reason, and the consumer stays silent (P3).
import { FRESHNESS_BUDGET, type FreshnessBudget } from "../policies/freshness.js";
import { observedSyncLevel, type SyncLevel } from "../policies/sync-level.js";
import type { Product, ProductId, Variant, VariantId } from "../../../domain/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";
import type { Clock } from "../../shared-kernel/index.js";
import type { CatalogStore } from "../ports/catalog-store.js";

export type Freshness = "fresh" | "stale";

/**
 * A known truth is always inside the catalogue budget (a stale catalogue is `unknown`, reason
 * `stale`), so the only freshness it carries is the one that can vary: stock and price.
 */
export type ProductTruth =
  | { kind: "known"; product: Product; variant: Variant; stockAndPrice: Freshness; ageMs: number }
  /** The product without a variant in focus: attributes yes, availability and price of nothing. */
  | { kind: "known-product"; product: Product; stockAndPrice: Freshness; ageMs: number }
  | { kind: "unknown"; reason: "absent" | "stale" | "unknown-product" | "unknown-variant" };

export interface ProductTruthService {
  lookup(merchantId: MerchantId, productId: ProductId, variantId: VariantId): Promise<ProductTruth>;
  /** The truth of a product when the SDK resolved no variant (feature 011). */
  product(merchantId: MerchantId, productId: ProductId): Promise<ProductTruth>;
  syncLevel(merchantId: MerchantId): Promise<SyncLevel>;
}

export interface ProductTruthServiceDependencies {
  clock: Clock;
  store: CatalogStore;
}

export class DefaultProductTruthService implements ProductTruthService {
  readonly #deps: ProductTruthServiceDependencies;
  readonly #budget: FreshnessBudget;

  constructor(deps: ProductTruthServiceDependencies, budget: FreshnessBudget = FRESHNESS_BUDGET) {
    this.#deps = deps;
    this.#budget = budget;
  }

  async lookup(merchantId: MerchantId, productId: ProductId, variantId: VariantId): Promise<ProductTruth> {
    const known = await this.product(merchantId, productId);
    if (known.kind !== "known-product") return known;
    const found = known.product.variants.find((v) => v.variantId === variantId);
    if (found === undefined) return { kind: "unknown", reason: "unknown-variant" };
    return {
      kind: "known",
      product: known.product,
      variant: found,
      stockAndPrice: known.stockAndPrice,
      ageMs: known.ageMs,
    };
  }

  async product(merchantId: MerchantId, productId: ProductId): Promise<ProductTruth> {
    const snapshot = await this.#deps.store.current(merchantId);
    if (snapshot === undefined) return { kind: "unknown", reason: "absent" };
    const ageMs = snapshot.ageAt(this.#deps.clock.now());
    if (ageMs > this.#budget.catalogMs) return { kind: "unknown", reason: "stale" };
    const product = snapshot.product(productId);
    if (product === undefined) return { kind: "unknown", reason: "unknown-product" };
    const stockAndPrice: Freshness = ageMs > this.#budget.stockAndPriceMs ? "stale" : "fresh";
    return { kind: "known-product", product, stockAndPrice, ageMs };
  }

  async syncLevel(merchantId: MerchantId): Promise<SyncLevel> {
    return observedSyncLevel(await this.#deps.store.receipts(merchantId), this.#deps.clock.now());
  }
}
