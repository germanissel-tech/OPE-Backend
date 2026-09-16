// US1, scenario 5 (ADR-013): main.ts only reads configuration, starts through the composition root
// and handles signals. No concrete instance lives there.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/main.ts", "utf8");
const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1] ?? "");

describe("src/main.ts", () => {
  it("imports only from composition/ and Node modules", () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) {
      expect(spec, spec).toMatch(/^(node:|\.\/composition\/)/);
    }
  });

  it("instantiates nothing concrete: neither Fastify, nor openapi-backend, nor gateways", () => {
    expect(source).not.toMatch(/\bnew\b/);
    expect(source).not.toMatch(/Fastify|OpenAPIBackend|gateways|infrastructure|interface-adapters/);
  });
});
