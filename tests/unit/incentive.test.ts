// ADR-027: the incentive vocabulary of the kernel replicates contracts/components/schemas/Incentive.yaml.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { INCENTIVE_KINDS } from "../../src/domain/shared-kernel/index.js";

const schema = parse(readFileSync("contracts/components/schemas/Incentive.yaml", "utf8")) as {
  required: string[];
  properties: { kind: { enum: string[] }; value: { exclusiveMinimum: number; maximum: number } };
};

describe("incentive vocabulary", () => {
  it("the kinds replicate the contract enum and the value is a share of 1", () => {
    expect([...INCENTIVE_KINDS].sort()).toEqual([...schema.properties.kind.enum].sort());
    expect(schema.required.sort()).toEqual(["kind", "value"]);
    expect(schema.properties.value).toMatchObject({ exclusiveMinimum: 0, maximum: 1 });
  });
});
