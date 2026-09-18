// ADR-026: the three barriers of the MVP (03 §4.2) are a closed vocabulary of the kernel, and
// the contract names exactly them as the reason of an INTERVENE decision.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { BARRIERS } from "../../src/domain/shared-kernel/index.js";

const decision = parse(readFileSync("contracts/components/schemas/Decision.yaml", "utf8")) as {
  properties: { outcome: { description: string } };
};

describe("barrier vocabulary", () => {
  it("is exactly fit, price and returns, each a Decision.reason-compatible slug", () => {
    expect([...BARRIERS].sort()).toEqual(["fit", "price", "returns"]);
    for (const barrier of BARRIERS) expect(barrier).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("the contract lists the same barriers as the reason of an INTERVENE decision", () => {
    const listed = [...decision.properties.outcome.description.matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
    for (const barrier of BARRIERS) expect(listed).toContain(barrier);
  });
});
