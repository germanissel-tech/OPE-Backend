// ADR-016 (FR-012): named units of time replace unit arithmetic in the domain.
import { describe, expect, it } from "vitest";
import { hours, minutes, MS_PER_SECOND, seconds } from "../../../../src/domain/shared-kernel/index.js";

describe("time units", () => {
  it("compose seconds, minutes and hours into milliseconds", () => {
    expect(seconds(1)).toBe(MS_PER_SECOND);
    expect(minutes(5)).toBe(300_000);
    expect(hours(24)).toBe(86_400_000);
  });

  it("scale linearly and keep zero at zero", () => {
    expect(hours(0)).toBe(0);
    expect(minutes(2)).toBe(2 * minutes(1));
  });
});
