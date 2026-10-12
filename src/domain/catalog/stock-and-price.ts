// The stock and price of one variant at an instant (feature 044, ADR-047): what a refresh brings without the
// rest of the catalogue. It is a layer over the snapshot, not a new snapshot: the truth of a variant is the
// newest of the two (`CatalogSnapshot.stockAndPriceOf`). The instant is the platform's, or the one OPE observed
// it at when the platform gives none (verification of the platforms, point 2).
import { fail, ok, type MerchantId, type MoneyRecord, type Result } from "../shared-kernel/index.js";
import { StockAndPriceDuplicateVariantId, StockCapturedInFuture, type RefreshError } from "./errors.js";
import type { VariantId } from "./ids.js";

export interface StockAndPriceRecord {
  variantId: VariantId;
  /** Guard (01 §4.3), as in the snapshot: no quantity exists. */
  available: boolean;
  /** The data of the price, as in the snapshot (`Variant.price`): the catalogue applies no rule of `Money`. */
  price: MoneyRecord;
  observedAt: Date;
}

/** What a refreshed datum does to a variant: it becomes the truth, it was already, or something newer is. */
export type RefreshOutcome = "applied" | "repeated" | "superseded";

export class StockAndPrice {
  readonly variantId: VariantId;
  readonly available: boolean;
  readonly price: MoneyRecord;
  readonly observedAt: Date;

  private constructor(record: StockAndPriceRecord) {
    this.variantId = record.variantId;
    this.available = record.available;
    this.price = record.price;
    this.observedAt = record.observedAt;
  }

  /** A datum a store recorded, or one its refresh already judged: nothing is re-judged. */
  static rehydrate(record: StockAndPriceRecord): StockAndPrice {
    return new StockAndPrice(record);
  }

  record(): StockAndPriceRecord {
    return {
      variantId: this.variantId,
      available: this.available,
      price: this.price,
      observedAt: this.observedAt,
    };
  }

  /**
   * What this datum does to the variant, given what it already holds: the refresh kept for it, if any, and the
   * instant of the snapshot in force. Only a newer instant changes the truth (FR-007). The same instant as the
   * snapshot is not newer: the snapshot already said what was true then. The same instant as the kept refresh
   * is a repetition when the content is the same, and loses when it is not — a platform does not correct a
   * datum without moving its instant, so the one kept stays.
   */
  against(kept: StockAndPrice | undefined, capturedAt: Date): RefreshOutcome {
    if (this.observedAt.getTime() <= capturedAt.getTime()) return "superseded";
    if (kept === undefined) return "applied";
    const order = this.observedAt.getTime() - kept.observedAt.getTime();
    if (order > 0) return "applied";
    return order === 0 && this.#sameContentAs(kept) ? "repeated" : "superseded";
  }

  #sameContentAs(other: StockAndPrice): boolean {
    return (
      this.available === other.available &&
      this.price.amount === other.price.amount &&
      this.price.currency === other.price.currency
    );
  }
}

/**
 * What a refresh is judged against: the snapshot in force, by what it answers. Declared here, and not imported,
 * because the snapshot already depends on this file for the newest datum of a variant, and an import back would
 * be a cycle; `CatalogSnapshot` satisfies it as it is.
 */
export interface RefreshedPicture {
  readonly capturedAt: Date;
  hasVariant(variantId: VariantId): boolean;
}

/** What became of each item of a refresh, by variant; `unknown` is a variant the snapshot in force does not have. */
export type RefreshOutcomes = Readonly<Record<RefreshOutcome | "unknown", readonly VariantId[]>>;

/** A refresh judged against what a store holds: what became of each item, and what the store keeps. */
export interface RefreshJudgement {
  outcomes: RefreshOutcomes;
  /** The items that became the truth of their variant: the only ones written. */
  applied: readonly StockAndPrice[];
}

/** A refresh as the platform sent it, or as the scheduler read it: the items and when OPE received them. */
export interface StockAndPriceRefreshRecord {
  merchantId: MerchantId;
  receivedAt: Date;
  items: readonly StockAndPriceRecord[];
}

export class StockAndPriceRefresh {
  readonly merchantId: MerchantId;
  readonly receivedAt: Date;
  readonly items: readonly StockAndPrice[];

  private constructor(record: StockAndPriceRefreshRecord) {
    this.merchantId = record.merchantId;
    this.receivedAt = record.receivedAt;
    this.items = record.items.map((item) => StockAndPrice.rehydrate(item));
  }

  /**
   * A refresh whose variants are unique and whose instants are not in the future beyond the skew a snapshot
   * tolerates too. The first violated invariant, in the order of the items, is the error.
   */
  static of(record: StockAndPriceRefreshRecord, skewMs: number): Result<StockAndPriceRefresh, RefreshError> {
    const seen = new Set<VariantId>();
    const limit = record.receivedAt.getTime() + skewMs;
    for (const item of record.items) {
      if (seen.has(item.variantId)) return fail(new StockAndPriceDuplicateVariantId(item.variantId));
      seen.add(item.variantId);
      if (item.observedAt.getTime() > limit) return fail(new StockCapturedInFuture(item.variantId, skewMs));
    }
    return ok(new StockAndPriceRefresh(record));
  }

  /**
   * Each item against the snapshot in force and the refresh its variant keeps (`kept`, by variant). With no
   * snapshot every variant is unknown: there is nothing for a refresh to be a layer over (ADR-025: an unknown
   * variant is ignored with its reason).
   */
  judgedAgainst(
    snapshot: RefreshedPicture | undefined,
    kept: (variantId: VariantId) => StockAndPrice | undefined,
  ): RefreshJudgement {
    const outcomes: Record<keyof RefreshOutcomes, VariantId[]> = {
      applied: [],
      repeated: [],
      superseded: [],
      unknown: [],
    };
    const applied: StockAndPrice[] = [];
    for (const item of this.items) {
      if (!snapshot?.hasVariant(item.variantId)) {
        outcomes.unknown.push(item.variantId);
        continue;
      }
      const outcome = item.against(kept(item.variantId), snapshot.capturedAt);
      outcomes[outcome].push(item.variantId);
      if (outcome === "applied") applied.push(item);
    }
    return { outcomes, applied };
  }
}
