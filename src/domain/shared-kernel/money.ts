// Money (ADR-014, ADR-025): an amount as a decimal string (no binary rounding) and an ISO 4217
// currency. Shared by ingestion (the price the SDK saw) and the catalogue (the current price),
// which cannot depend on each other. Only exists valid: `of` checks the shape the contract
// publishes; `rehydrate` trusts what the contract or a store already validated.
import { InvalidMoney } from "./errors.js";
import { fail, ok, type Result } from "./result.js";

/** Up to two decimals, dot as separator, no sign, no thousands separators (contract: Money). */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
/** ISO 4217: three uppercase letters. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface MoneyRecord {
  amount: string;
  currency: string;
}

export class Money {
  readonly amount: string;
  readonly currency: string;

  private constructor(record: MoneyRecord) {
    this.amount = record.amount;
    this.currency = record.currency;
  }

  static of(amount: string, currency: string): Result<Money, InvalidMoney> {
    if (!AMOUNT_PATTERN.test(amount)) return fail(new InvalidMoney("amount"));
    if (!CURRENCY_PATTERN.test(currency)) return fail(new InvalidMoney("currency"));
    return ok(new Money({ amount, currency }));
  }

  /** Already validated (by the contract or a store): not re-judged. */
  static rehydrate(record: MoneyRecord): Money {
    return new Money(record);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
