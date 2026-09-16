// US1, escenario 5 (ADR-013): main.ts sólo lee configuración, arranca por el composition root y
// maneja señales. Ninguna instancia concreta vive ahí.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/main.ts", "utf8");
const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1] ?? "");

describe("src/main.ts", () => {
  it("importa sólo de composition/ y de módulos de Node", () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) {
      expect(spec, spec).toMatch(/^(node:|\.\/composition\/)/);
    }
  });

  it("no instancia nada concreto: ni Fastify, ni openapi-backend, ni gateways", () => {
    expect(source).not.toMatch(/\bnew\b/);
    expect(source).not.toMatch(/Fastify|OpenAPIBackend|gateways|infrastructure|interface-adapters/);
  });
});
