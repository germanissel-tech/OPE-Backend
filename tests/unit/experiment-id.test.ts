// ADR-024, feature 022 US4: the shape of an experiment identifier is the contract's, and the
// reader of the seed —the only place that judges one the HTTP border never saw— replicates it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const schema = parse(readFileSync("contracts/components/schemas/ExperimentId.yaml", "utf8")) as {
  type: string;
  pattern: string;
};
const reader = readFileSync("src/composition/experiments-config.ts", "utf8");

describe("experiment identifier", () => {
  it("the seed reader replicates the pattern the contract declares", () => {
    expect(schema.type).toBe("string");
    expect(reader).toContain(`const ID_PATTERN = /${schema.pattern}/;`);
  });

  it("what the minter produces satisfies the pattern, which accepts more on purpose", () => {
    const pattern = new RegExp(schema.pattern);
    expect(pattern.test("exp_abcdefghijkl")).toBe(true);
    expect(pattern.test("experiment-from-another-environment")).toBe(true);
    expect(pattern.test("short")).toBe(false);
  });
});
