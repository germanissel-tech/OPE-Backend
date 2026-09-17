// Research R-05 / ADR-014: the contract carries discriminator.mapping; Ajv does not support it;
// the adapter strips it before compiling the validators. With the real bundle, not a fixture.
import { readFileSync } from "node:fs";
import ajvFormats from "ajv-formats";
import { OpenAPIBackend, type Document } from "openapi-backend";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  hasDiscriminatorMappings,
  stripDiscriminatorMappings,
} from "../../../src/infrastructure/http/strip-discriminator-mappings.js";

const bundle = parse(readFileSync("contracts/dist/openapi.yaml", "utf8")) as Document;

const backend = (definition: Document) =>
  new OpenAPIBackend({
    definition,
    strict: true,
    validate: true,
    ajvOpts: { strict: false, discriminator: true },
    customizeAjv: (ajv) => ajvFormats.default(ajv),
  });

describe("stripDiscriminatorMappings", () => {
  it("the published contract has at least one discriminator.mapping (the event union)", () => {
    expect(hasDiscriminatorMappings(bundle)).toBe(true);
  });

  it("returns a copy without any mapping and does not mutate the original", () => {
    const stripped = stripDiscriminatorMappings(bundle);
    expect(hasDiscriminatorMappings(stripped)).toBe(false);
    expect(hasDiscriminatorMappings(bundle)).toBe(true);
    expect(stripped).not.toBe(bundle);
  });

  it("openapi-backend with discriminator: true does not start with the contract as is, and does without mapping", async () => {
    await expect(backend(bundle).init()).rejects.toThrow(/mapping is not supported/);
    await expect(backend(stripDiscriminatorMappings(bundle)).init()).resolves.toBeDefined();
  });
});
