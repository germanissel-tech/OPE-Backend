// Application service: the truth of a variant for whoever decides (feature 011), read from the
// hot cache, never from the platform (01 §4.6). Freshness is judged per class of datum
// (01 §8): beyond the catalogue budget nothing is true; between the two budgets the variant
// exists but availability and price are stale and sustain no claim. Fail-closed: "unknown" with
// a reason, and the consumer stays silent (P3).
//
// Since feature 044 (ADR-047) stock and price of a variant are the newest of the snapshot and its refresh,
// and their freshness is the variant's: a variant the refreshes reach stays fresh while the snapshot ages, and
// one they have not reached yet ages with the snapshot and goes silent on its own. The catalogue itself —
// whether the product exists, its attributes— is still measured with the snapshot.
import type {
  CatalogSnapshot,
  FreshnessBudget,
  Product,
  ProductId,
  SyncLevel,
  Variant,
  VariantId,
} from "../../../domain/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";
import type { Clock } from "../../shared-kernel/index.js";
import type { CatalogPolicies } from "../ports/catalog-policies.js";
import type { CatalogStore } from "../ports/catalog-store.js";

export type Freshness = "fresh" | "stale";

/**
 * A known truth is always inside the catalogue budget (a stale catalogue is `unknown`, reason
 * `stale`), so the only freshness it carries is the one that can vary: stock and price. `ageMs` is the age
 * of what that freshness is measured with: the variant's datum, or the snapshot for a product.
 */
export type ProductTruth =
  | { kind: "known"; product: Product; variant: Variant; stockAndPrice: Freshness; ageMs: number }
  /** The product without a variant in focus: attributes yes, availability and price of nothing. */
  | { kind: "known-product"; product: Product; stockAndPrice: Freshness; ageMs: number }
  | { kind: "unknown"; reason: "absent" | "stale" | "unknown-product" | "unknown-variant" };

/** Stock and price sustain a claim while their datum is inside its budget. */
const freshness = (ageMs: number, budget: FreshnessBudget): Freshness =>
  ageMs > budget.stockAndPriceMs ? "stale" : "fresh";

export interface ProductTruthService {
  lookup(merchantId: MerchantId, productId: ProductId, variantId: VariantId): Promise<ProductTruth>;
  /** The truth of a product when the SDK resolved no variant (feature 011). */
  product(merchantId: MerchantId, productId: ProductId): Promise<ProductTruth>;
  syncLevel(merchantId: MerchantId): Promise<SyncLevel>;
}

export interface ProductTruthServiceDependencies {
  clock: Clock;
  store: CatalogStore;
  /** The freshness budgets and the level rules of each merchant (constitution XI). */
  policies: CatalogPolicies;
}

export class ProductTruths implements ProductTruthService {
  readonly #deps: ProductTruthServiceDependencies;

  constructor(deps: ProductTruthServiceDependencies) {
    this.#deps = deps;
  }

  async lookup(merchantId: MerchantId, productId: ProductId, variantId: VariantId): Promise<ProductTruth> {
    const found = await this.#found(merchantId, productId);
    if (found.kind === "unknown") return found;
    const { snapshot, product, budget, now } = found;
    const variant = product.variants.find((v) => v.variantId === variantId);
    if (variant === undefined) return { kind: "unknown", reason: "unknown-variant" };
    const truth = snapshot.stockAndPriceOf(variant, await this.#deps.store.refreshOf(merchantId, variantId));
    const ageMs = Math.max(0, now.getTime() - truth.at.getTime());
    return {
      kind: "known",
      product,
      variant: truth.variant,
      stockAndPrice: freshness(ageMs, budget),
      ageMs,
    };
  }

  async product(merchantId: MerchantId, productId: ProductId): Promise<ProductTruth> {
    const found = await this.#found(merchantId, productId);
    if (found.kind === "unknown") return found;
    const ageMs = found.snapshot.ageAt(found.now);
    return {
      kind: "known-product",
      product: found.product,
      stockAndPrice: freshness(ageMs, found.budget),
      ageMs,
    };
  }

  /** The product of a snapshot inside the catalogue budget, or why there is none. */
  async #found(
    merchantId: MerchantId,
    productId: ProductId,
  ): Promise<
    | { kind: "found"; snapshot: CatalogSnapshot; product: Product; budget: FreshnessBudget; now: Date }
    | Extract<ProductTruth, { kind: "unknown" }>
  > {
    const snapshot = await this.#deps.store.current(merchantId);
    if (snapshot === undefined) return { kind: "unknown", reason: "absent" };
    const budget = await this.#deps.policies.freshnessFor(merchantId);
    const now = this.#deps.clock.now();
    if (snapshot.ageAt(now) > budget.catalogMs) return { kind: "unknown", reason: "stale" };
    const product = snapshot.product(productId);
    if (product === undefined) return { kind: "unknown", reason: "unknown-product" };
    return { kind: "found", snapshot, product, budget, now };
  }

  async syncLevel(merchantId: MerchantId): Promise<SyncLevel> {
    const rules = await this.#deps.policies.syncLevelRulesFor(merchantId);
    return rules.observe(await this.#deps.store.receipts(merchantId), this.#deps.clock.now());
  }
}
