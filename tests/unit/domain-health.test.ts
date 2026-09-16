import { describe, expect, it } from "vitest";
import { serviceHealth } from "../../src/domain/system/index.js";

describe("serviceHealth (dominio)", () => {
  it("is a pure function of the clock and the contract version", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    expect(serviceHealth({ now, contractVersion: "1.0.0" })).toEqual({
      status: "ok",
      contractVersion: "1.0.0",
      timestamp: now,
    });
    expect(serviceHealth({ now, contractVersion: "1.0.0" })).toEqual(
      serviceHealth({ now, contractVersion: "1.0.0" }),
    );
  });
});
