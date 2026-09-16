// US3 (FR-020): el catálogo de motivos del dominio replica contracts/no-op-reasons.yaml.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { NO_OP_REASONS } from "../../src/domain/ingestion/index.js";

const catalog = parse(readFileSync("contracts/no-op-reasons.yaml", "utf8")) as {
  reasons: { slug: string; emitter: string; description: string }[];
};

describe("catálogo de motivos de NO_OP", () => {
  it("el dominio replica exactamente los slugs del contrato", () => {
    expect([...NO_OP_REASONS].sort()).toEqual(catalog.reasons.map((r) => r.slug).sort());
  });

  it("cada slug cumple el patrón de Decision.reason del contrato y tiene emisor y descripción", () => {
    for (const reason of catalog.reasons) {
      expect(reason.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(reason.emitter).toBeTruthy();
      expect(reason.description).toBeTruthy();
    }
  });
});
