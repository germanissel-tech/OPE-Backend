// Freshness budgets by class of datum (01 §8; ADR-025), measured from `capturedAt`: the
// catalogue and its variants stay true for the order of a day; availability and price for the
// order of minutes. Treatment defaults a merchant overrides (constitution XI).
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidFreshnessBudget } from "./errors.js";

export interface FreshnessBudgetRecord {
  /** Beyond this the snapshot holds no truth at all. */
  catalogMs: number;
  /** Beyond this the variant exists but availability and price no longer sustain a claim. */
  stockAndPriceMs: number;
}

const FIELDS = ["catalogMs", "stockAndPriceMs"] as const;

export class FreshnessBudget {
  readonly catalogMs: number;
  readonly stockAndPriceMs: number;

  private constructor(record: FreshnessBudgetRecord) {
    this.catalogMs = record.catalogMs;
    this.stockAndPriceMs = record.stockAndPriceMs;
  }

  /** Both budgets positive milliseconds; stock and price never outlive the catalogue. */
  static of(record: FreshnessBudgetRecord): Result<FreshnessBudget, InvalidFreshnessBudget> {
    for (const field of FIELDS) {
      if (!Number.isFinite(record[field]) || record[field] <= 0)
        return fail(new InvalidFreshnessBudget(field));
    }
    if (record.stockAndPriceMs > record.catalogMs) return fail(new InvalidFreshnessBudget(FIELDS[1]));
    return ok(new FreshnessBudget(record));
  }

  static rehydrate(record: FreshnessBudgetRecord): FreshnessBudget {
    return new FreshnessBudget(record);
  }

  record(): FreshnessBudgetRecord {
    return { catalogMs: this.catalogMs, stockAndPriceMs: this.stockAndPriceMs };
  }
}
