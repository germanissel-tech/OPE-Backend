// ADR-025: Money only exists valid; rehydrate trusts what the contract validated.
import { describe, expect, it } from "vitest";
import { InvalidMoney, Money } from "../../../../src/domain/shared-kernel/index.js";

describe("Money.of", () => {
  it("accepts a decimal amount with up to two decimals and an ISO 4217 currency", () => {
    for (const amount of ["0", "19990", "19990.5", "19990.50"]) {
      const built = Money.of(amount, "ARS");
      expect(built.ok).toBe(true);
      if (built.ok) expect(built.value).toMatchObject({ amount, currency: "ARS" });
    }
  });

  it.each([
    ["-1", "amount"],
    ["1,5", "amount"],
    ["1.555", "amount"],
    ["", "amount"],
    ["10", "ars"],
    ["10", "ARSS"],
  ])("rejects %s / %s naming the field", (amount, expected) => {
    const currency =
      expected === "amount" ? "ARS" : amount === "10" ? (expected === "ars" ? "ars" : "ARSS") : "ARS";
    const built = Money.of(expected === "amount" ? amount : "10", currency);
    const field = expected === "amount" ? "amount" : "currency";
    expect(built).toMatchObject({
      ok: false,
      error: { code: "invalid-money", module: "shared-kernel", details: { field } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidMoney);
  });

  it("equals compares by value; rehydrate does not re-judge", () => {
    const a = Money.rehydrate({ amount: "10.00", currency: "ARS" });
    const b = Money.rehydrate({ amount: "10.00", currency: "ARS" });
    const c = Money.rehydrate({ amount: "10.00", currency: "USD" });
    const d = Money.rehydrate({ amount: "11.00", currency: "ARS" });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
    expect(Money.rehydrate({ amount: "not validated", currency: "x" }).amount).toBe("not validated");
  });
});
