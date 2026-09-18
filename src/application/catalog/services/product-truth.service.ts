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

export type ProductTruth =
  | {
      kind: "known";
      product: Product;
      variant: Variant;
      freshness: { catalog: "fresh"; stockAndPrice: Freshness };
      ageMs: number;
    }
  | { kind: "unknown"; reason: "absent" | "stale" | "unknown-product" | "unknown-variant" };

export interface ProductTruthService {
  lookup(merchantId: MerchantId, productId: ProductId, variantId: VariantId): Promise<ProductTruth>;
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
    const snapshot = await this.#deps.store.current(merchantId);
    if (snapshot === undefined) return { kind: "unknown", reason: "absent" };
    const ageMs = snapshot.ageAt(this.#deps.clock.now());
    if (ageMs > this.#budget.catalogMs) return { kind: "unknown", reason: "stale" };
    if (snapshot.product(productId) === undefined) return { kind: "unknown", reason: "unknown-product" };
    const found = snapshot.variant(productId, variantId);
    if (found === undefined) return { kind: "unknown", reason: "unknown-variant" };
    const stockAndPrice: Freshness = ageMs > this.#budget.stockAndPriceMs ? "stale" : "fresh";
    return {
      kind: "known",
      product: found.product,
      variant: found.variant,
      freshness: { catalog: "fresh", stockAndPrice },
      ageMs,
    };
  }

  async syncLevel(merchantId: MerchantId): Promise<SyncLevel> {
    return observedSyncLevel(await this.#deps.store.receipts(merchantId), this.#deps.clock.now());
  }
}
