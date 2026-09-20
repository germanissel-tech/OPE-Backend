// Feature 015 (F-030): the rate and count predicates every module judges numbers with, once.
import { describe, expect, it } from "vitest";
import { isCount, isRate } from "../../../../src/domain/shared-kernel/index.js";

describe("isRate", () => {
  it.each([0, 0.5, 1, -0])("accepts %s", (value) => {
    expect(isRate(value)).toBe(true);
  });

  it.each([-0.1, 1.0000001, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects %s",
    (value) => {
      expect(isRate(value)).toBe(false);
    },
  );
});

describe("isCount", () => {
  it.each([0, 1, 2.5, 100_000])("accepts %s", (value) => {
    expect(isCount(value)).toBe(true);
  });

  it.each([-1, -0.0001, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s", (value) => {
    expect(isCount(value)).toBe(false);
  });
});
