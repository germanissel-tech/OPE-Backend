// FR-052 / SC-001: cada regla de verificación del contrato tiene un fixture que la viola y una
// prueba que confirma que la verificación falla nombrando esa regla, con archivo y posición.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Document, Spectral, type ISpectralDiagnostic, type Ruleset } from "@stoplight/spectral-core";
import * as Parsers from "@stoplight/spectral-parsers";
import { beforeAll, describe, expect, it } from "vitest";

const fixturesDir = path.resolve("tests/contract-rules/fixtures");
const rulesetPath = path.resolve("contracts/.spectral.yaml");

// Fixtures que deben pasar sin errores ni warnings.
const VALID = [
  "valid.yaml",
  "merchant-id-in-response.yaml",
  "valid-invariants.yaml",
  "valid-capabilities.yaml",
];

const ERROR = 0; // DiagnosticSeverity.Error
const WARNING = 1;

let spectral: Spectral;

// Se carga el ruleset con el mismo cargador que usa la CLI (`npm run contract:lint`): migra el
// YAML, empaqueta las funciones custom (CommonJS) y resuelve `functionsDir`. Es API interna de
// spectral-cli, pero garantiza que la prueba ejercita exactamente lo que corre el build.
const require = createRequire(import.meta.url);
const { getRuleset } = require("@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js") as {
  getRuleset: (file: string) => Promise<Ruleset>;
};

async function lint(file: string): Promise<ISpectralDiagnostic[]> {
  const full = path.join(fixturesDir, file);
  const doc = new Document(readFileSync(full, "utf8"), Parsers.Yaml, full);
  return spectral.run(doc);
}

beforeAll(async () => {
  spectral = new Spectral();
  spectral.setRuleset(await getRuleset(rulesetPath));
});

describe("reglas del contrato (contracts/.spectral.yaml)", () => {
  const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".yaml"));
  const violating = fixtures.filter((f) => !VALID.includes(f));

  it("hay un fixture por cada regla propia (ope-*) del ruleset", () => {
    const ruleset = readFileSync(rulesetPath, "utf8");
    const opeRules = [...ruleset.matchAll(/^  (ope-[a-z0-9-]+):$/gm)].map((m) => m[1]);
    expect(opeRules.length).toBeGreaterThanOrEqual(13);
    for (const rule of opeRules) {
      expect(
        violating.some((f) => f === `${rule}.yaml` || f.startsWith(`${rule}.`)),
        `falta fixture para ${rule}`,
      ).toBe(true);
    }
  });

  it.each(VALID)("%s pasa sin errores ni warnings", async (file) => {
    const results = await lint(file);
    const relevant = results.filter((r) => r.severity <= WARNING);
    expect(relevant.map((r) => `${r.code}: ${r.message}`)).toEqual([]);
  });

  it.each(violating)("%s falla por su regla, con archivo y posición", async (file) => {
    const rule = file.replace(/\.yaml$/, "").split(".")[0];
    const results = await lint(file);
    const hits = results.filter((r) => r.code === rule && r.severity === ERROR);
    expect(
      hits.length,
      `sin error ${rule}; obtenido: ${results.map((r) => r.code).join(", ")}`,
    ).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.source).toContain(file);
      expect(hit.range.start.line).toBeGreaterThanOrEqual(0);
      expect(hit.message.length).toBeGreaterThan(10);
    }
  });

  it("ope-no-merchant-id-in-request cubre path, query, header, cookie y body (aislamiento por merchant)", () => {
    for (const where of ["path", "query", "header", "cookie", "body"]) {
      expect(violating).toContain(`ope-no-merchant-id-in-request.${where}.yaml`);
    }
  });
});
