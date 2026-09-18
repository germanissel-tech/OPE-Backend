// Catalogue snapshot (01-arquitectura-mvp.md §4.3, §8; 02 §4; ADR-025): the complete catalogue
// of a merchant at `capturedAt`, received at `receivedAt`. Products with their variants nested,
// so no variant is orphan by construction. Availability is a guard (a boolean), never a claim.
// A snapshot only exists valid: `of` enforces the invariants the schema cannot express,
// `rehydrate` trusts what a store recorded.
import { fail, minutes, ok, type MerchantId, type Money, type Result } from "../shared-kernel/index.js";
import {
  CatalogCapturedInFuture,
  CatalogDuplicateProductId,
  CatalogDuplicateVariantId,
  type CatalogError,
} from "./errors.js";
import type { ProductId, VariantId } from "./ids.js";

export interface Attribute {
  key: string;
  value: string;
}

export interface Variant {
  variantId: VariantId;
  size: string;
  color: string;
  /** Guard (01 §4.3): `false` means "do not recommend"; no quantity exists. */
  available: boolean;
  price: Money;
}

export interface Product {
  productId: ProductId;
  title: string;
  attributes: readonly Attribute[];
  variants: readonly Variant[];
}

/** The facts of a snapshot, as the platform sent them and OPE received them. */
export interface CatalogSnapshotRecord {
  merchantId: MerchantId;
  capturedAt: Date;
  receivedAt: Date;
  products: readonly Product[];
}

/** A variant with the product it belongs to. */
export interface VariantOfProduct {
  product: Product;
  variant: Variant;
}

/** How far ahead of the receiving clock a capture may claim to be (a platform clock skew). */
const CAPTURE_TOLERANCE_MINUTES = 5;
export const CAPTURE_TOLERANCE_MS = minutes(CAPTURE_TOLERANCE_MINUTES);

export class CatalogSnapshot {
  readonly merchantId: MerchantId;
  readonly capturedAt: Date;
  readonly receivedAt: Date;
  readonly products: readonly Product[];
  readonly #byProduct: ReadonlyMap<ProductId, Product>;
  readonly #byVariant: ReadonlyMap<VariantId, VariantOfProduct>;

  private constructor(record: CatalogSnapshotRecord) {
    this.merchantId = record.merchantId;
    this.capturedAt = record.capturedAt;
    this.receivedAt = record.receivedAt;
    this.products = record.products;
    const byProduct = new Map<ProductId, Product>();
    const byVariant = new Map<VariantId, VariantOfProduct>();
    for (const product of record.products) {
      byProduct.set(product.productId, product);
      for (const variant of product.variants) byVariant.set(variant.variantId, { product, variant });
    }
    this.#byProduct = byProduct;
    this.#byVariant = byVariant;
  }

  /**
   * A snapshot as the platform sent it: the capture is not in the future beyond the tolerance,
   * product identifiers are unique and variant identifiers are unique across the snapshot.
   * The first violated invariant, in that order, is the error.
   */
  static of(record: CatalogSnapshotRecord): Result<CatalogSnapshot, CatalogError> {
    if (record.capturedAt.getTime() > record.receivedAt.getTime() + CAPTURE_TOLERANCE_MS) {
      return fail(new CatalogCapturedInFuture());
    }
    const products = new Set<ProductId>();
    const variants = new Set<VariantId>();
    for (const product of record.products) {
      if (products.has(product.productId)) return fail(new CatalogDuplicateProductId(product.productId));
      products.add(product.productId);
      for (const variant of product.variants) {
        if (variants.has(variant.variantId)) return fail(new CatalogDuplicateVariantId(variant.variantId));
        variants.add(variant.variantId);
      }
    }
    return ok(new CatalogSnapshot(record));
  }

  /** A snapshot a store recorded: its facts are not re-judged. */
  static rehydrate(record: CatalogSnapshotRecord): CatalogSnapshot {
    return new CatalogSnapshot(record);
  }

  product(productId: ProductId): Product | undefined {
    return this.#byProduct.get(productId);
  }

  /** The variant, only if it belongs to that product. */
  variant(productId: ProductId, variantId: VariantId): VariantOfProduct | undefined {
    const found = this.#byVariant.get(variantId);
    return found?.product.productId === productId ? found : undefined;
  }

  counts(): { products: number; variants: number } {
    return { products: this.#byProduct.size, variants: this.#byVariant.size };
  }

  /** Age of the picture at `now`, in ms; never negative (a capture ahead of the clock is "just now"). */
  ageAt(now: Date): number {
    return Math.max(0, now.getTime() - this.capturedAt.getTime());
  }

  /** The same products, variants and prices as `other`, whatever the instants. */
  sameContentAs(other: CatalogSnapshot): boolean {
    return contentKey(this.products) === contentKey(other.products);
  }
}

/** A canonical text of the content, for equality; identifiers keep the order the platform sent. */
function contentKey(products: readonly Product[]): string {
  return JSON.stringify(
    products.map((p) => [
      p.productId,
      p.title,
      p.attributes.map((a) => [a.key, a.value]),
      p.variants.map((v) => [v.variantId, v.size, v.color, v.available, v.price.amount, v.price.currency]),
    ]),
  );
}
