// US1, scenario 5 (ADR-013): main.ts only reads configuration, starts through the composition root
// and handles signals. No concrete instance lives there, and no "mode" does either (ADR-018): what
// runs is what main wires, never a flag the layers below consult.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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

describe("no mode flag under src/ (ADR-018)", () => {
  it("nothing names a server mode, a mock switch or a built-in merchant", () => {
    const files = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.posix.join("src", f.split(path.sep).join("/")));
    const naming = files.filter((f) =>
      /OPE_MOCK|ServerMode|mode === "mock"|MOCK_MERCHANT/.test(readFileSync(f, "utf8")),
    );
    expect(naming).toEqual([]);
  });
});
