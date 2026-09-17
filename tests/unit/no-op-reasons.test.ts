// US3 (FR-020): the domain reason catalogue replicates contracts/no-op-reasons.yaml.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { NO_OP_REASONS } from "../../src/domain/ingestion/index.js";

const catalog = parse(readFileSync("contracts/no-op-reasons.yaml", "utf8")) as {
  reasons: { slug: string; emitter: string; description: string }[];
};

describe("NO_OP reason catalogue", () => {
  it("the domain replicates exactly the contract slugs", () => {
    expect([...NO_OP_REASONS].sort()).toEqual(catalog.reasons.map((r) => r.slug).sort());
  });

  it("each slug satisfies the contract Decision.reason pattern and has an emitter and a description", () => {
    for (const reason of catalog.reasons) {
      expect(reason.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(reason.emitter).toBeTruthy();
      expect(reason.description).toBeTruthy();
    }
  });
});
