// ADR-024, feature 017: the vocabularies of the configuration replicate the contract — the sync
// modes, the surfaces, the flows of the strategy and the shape of a language tag.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  LOCALE_PATTERN,
  SURFACES,
  SYNC_FLOWS,
  SYNC_MODES,
} from "../../../../src/domain/configuration/index.js";

const schema = (name: string): Record<string, unknown> =>
  parse(readFileSync(`contracts/components/schemas/${name}.yaml`, "utf8")) as Record<string, unknown>;

describe("configuration vocabularies", () => {
  it("the sync modes and the surfaces replicate exactly the contract enums", () => {
    expect([...SYNC_MODES].sort()).toEqual([...(schema("SyncMode")["enum"] as string[])].sort());
    expect([...SURFACES].sort()).toEqual([...(schema("Surface")["enum"] as string[])].sort());
  });

  it("the flows of the sync strategy are the properties of the contract schema", () => {
    const properties = schema("SyncStrategy")["properties"] as Record<string, unknown>;
    expect([...SYNC_FLOWS].sort()).toEqual(Object.keys(properties).sort());
  });

  it("the language tag pattern is the one the contract publishes for the supported locales", () => {
    const properties = schema("Locales")["properties"] as { supported: { items: { pattern: string } } };
    expect(LOCALE_PATTERN.source).toBe(properties.supported.items.pattern);
    expect(LOCALE_PATTERN.test("es-AR")).toBe(true);
    expect(LOCALE_PATTERN.test("en")).toBe(true);
    expect(LOCALE_PATTERN.test("spanish")).toBe(true);
    expect(LOCALE_PATTERN.test("es_AR")).toBe(false);
    expect(LOCALE_PATTERN.test("")).toBe(false);
  });
});
