// Feature 015 (F-053; ADR-029): a secret is compared without a shortcut on the first difference.
import { describe, expect, it } from "vitest";
import { constantTimeEquals } from "../../../../src/domain/shared-kernel/index.js";

describe("constantTimeEquals", () => {
  it("equal strings are equal, including the empty one", () => {
    expect(constantTimeEquals("v1=abcdef", "v1=abcdef")).toBe(true);
    expect(constantTimeEquals("", "")).toBe(true);
  });

  it("a different length is unequal even when one is a prefix of the other", () => {
    expect(constantTimeEquals("secret", "secret-and-more")).toBe(false);
    expect(constantTimeEquals("secret-and-more", "secret")).toBe(false);
    expect(constantTimeEquals("secret", "")).toBe(false);
  });

  it("a long shared prefix with one differing code unit is unequal", () => {
    const real = "k".repeat(63) + "a";
    expect(constantTimeEquals(real, "k".repeat(63) + "b")).toBe(false);
    expect(constantTimeEquals(real, "x" + "k".repeat(63))).toBe(false);
  });

  it("differs by any code unit, not only ASCII", () => {
    expect(constantTimeEquals("na00efve", "naive")).toBe(false);
    expect(constantTimeEquals("na00efve", "na00efve")).toBe(true);
  });
});
