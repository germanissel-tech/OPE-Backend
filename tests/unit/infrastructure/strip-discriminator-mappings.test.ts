// Research R-05 / ADR-014: el contrato lleva discriminator.mapping; Ajv no lo soporta; el
// adaptador lo quita antes de compilar los validadores. Con el bundle real, no con un fixture.
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
  it("el contrato publicado tiene al menos un discriminator.mapping (la unión de eventos)", () => {
    expect(hasDiscriminatorMappings(bundle)).toBe(true);
  });

  it("devuelve una copia sin ningún mapping y no muta el original", () => {
    const stripped = stripDiscriminatorMappings(bundle);
    expect(hasDiscriminatorMappings(stripped)).toBe(false);
    expect(hasDiscriminatorMappings(bundle)).toBe(true);
    expect(stripped).not.toBe(bundle);
  });

  it("openapi-backend con discriminator: true no arranca con el contrato tal cual, y sí sin mapping", async () => {
    await expect(backend(bundle).init()).rejects.toThrow(/mapping is not supported/);
    await expect(backend(stripDiscriminatorMappings(bundle)).init()).resolves.toBeDefined();
  });
});
