// Feature 001 — FR-052 / SC-001: every contract verification rule has a fixture that violates it and a test
// confirming that the verification fails naming that rule, with file and position.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Document, Spectral, type ISpectralDiagnostic, type Ruleset } from "@stoplight/spectral-core";
import * as Parsers from "@stoplight/spectral-parsers";
import { beforeAll, describe, expect, it } from "vitest";

const fixturesDir = path.resolve("tests/contract-rules/fixtures");
const rulesetPath = path.resolve("contracts/.spectral.yaml");

// Fixtures that must pass without errors or warnings.
const VALID = [
  "valid.yaml",
  "valid-body-without-invariants.yaml",
  "merchant-id-in-response.yaml",
  "valid-invariants.yaml",
  "valid-capabilities.yaml",
  "valid-union.yaml",
  "valid-outcomes.yaml",
  "valid-portal.yaml",
  "valid-admin-path.yaml",
];

let spectral: Spectral;

// The ruleset is loaded with the same loader the CLI uses (`npm run contract:lint`): it migrates
// the YAML, bundles the custom functions (CommonJS) and resolves `functionsDir`. It is internal
// spectral-cli API, but it guarantees the test exercises exactly what the build runs.
const require = createRequire(import.meta.url);
const { getRuleset } = require("@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js") as {
  getRuleset: (file: string) => Promise<Ruleset>;
};

// The severity is the DiagnosticSeverity enum of the @stoplight/types copy that spectral-core
// uses; it is taken from the diagnostic's own type so as not to depend on another copy.
type Severity = ISpectralDiagnostic["severity"];
const ERROR = 0 as Severity;
const WARNING = 1 as Severity;

async function lint(file: string): Promise<ISpectralDiagnostic[]> {
  const full = path.join(fixturesDir, file);
  const doc = new Document(readFileSync(full, "utf8"), Parsers.Yaml, full);
  return spectral.run(doc);
}

beforeAll(async () => {
  spectral = new Spectral();
  spectral.setRuleset(await getRuleset(rulesetPath));
});

describe("contract rules (contracts/.spectral.yaml)", () => {
  const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".yaml"));
  const violating = fixtures.filter((f) => !VALID.includes(f));

  it("there is one fixture per custom rule (ope-*) of the ruleset", () => {
    const ruleset = readFileSync(rulesetPath, "utf8");
    const opeRules = [...ruleset.matchAll(/^ {2}(ope-[a-z0-9-]+):$/gm)].map((m) => m[1]);
    expect(opeRules.length).toBeGreaterThanOrEqual(13);
    for (const rule of opeRules) {
      expect(
        violating.some((f) => f === `${rule}.yaml` || f.startsWith(`${rule}.`)),
        `missing fixture for ${rule}`,
      ).toBe(true);
    }
  });

  it.each(VALID)("%s passes without errors or warnings", async (file) => {
    const results = await lint(file);
    const relevant = results.filter((r) => r.severity <= WARNING);
    expect(relevant.map((r) => `${r.code}: ${r.message}`)).toEqual([]);
  });

  it.each(violating)("%s fails on its rule, with file and position", async (file) => {
    const rule = file.replace(/\.yaml$/, "").split(".")[0];
    const results = await lint(file);
    const hits = results.filter((r) => r.code === rule && r.severity === ERROR);
    expect(hits.length, `no ${rule} error; got: ${results.map((r) => r.code).join(", ")}`).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.source).toContain(file);
      expect(hit.range.start.line).toBeGreaterThanOrEqual(0);
      expect(hit.message.length).toBeGreaterThan(10);
    }
  });

  it("ope-no-merchant-id-in-request covers path, query, header, cookie and body (merchant isolation)", () => {
    for (const where of ["path", "query", "header", "cookie", "body"]) {
      expect(violating).toContain(`ope-no-merchant-id-in-request.${where}.yaml`);
    }
  });
});
