// ADR-024: the domain anchor vocabulary replicates contracts/components/schemas/Anchor.yaml.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ANCHORS } from "../../src/domain/ledger/index.js";

const schema = parse(readFileSync("contracts/components/schemas/Anchor.yaml", "utf8")) as {
  type: string;
  enum: string[];
};

describe("anchor catalogue", () => {
  it("the domain replicates exactly the contract enum", () => {
    expect(schema.type).toBe("string");
    expect([...ANCHORS].sort()).toEqual([...schema.enum].sort());
  });
});
