// ADR-026: the three barriers of the MVP (03 §4.2) are a closed vocabulary of the kernel.
import { describe, expect, it } from "vitest";
import { BARRIERS } from "../../src/domain/shared-kernel/index.js";

describe("barrier vocabulary", () => {
  it("is exactly fit, price and returns, each a Decision.reason-compatible slug", () => {
    expect([...BARRIERS].sort()).toEqual(["fit", "price", "returns"]);
    for (const barrier of BARRIERS) expect(barrier).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
