// FR-020 / US1 escenarios 11-12 y edge cases: cada clase de cambio incompatible falla el diff
// cuando la versión mayor no aumentó; los cambios compatibles pasan; con bump de major pasa;
// sin contrato base se omite con aviso.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixtures = path.resolve("tests/contract-diff/fixtures");
const script = path.resolve("scripts/contract-diff.mjs");

interface Outcome {
  status: number;
  output: string;
}

function diff(base: string, head: string): Outcome {
  try {
    const stdout = execFileSync(process.execPath, [script, "--base", base, "--head", head], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const base = path.join(fixtures, "base.yaml");

const breaking: [string, string][] = [
  ["brk-remove-operation.yaml", "api-path-removed-without-deprecation"],
  ["brk-remove-response-field.yaml", "response-optional-property-removed"],
  ["brk-rename-response-field.yaml", "response-optional-property-removed"],
  ["brk-request-field-required.yaml", "request-property-became-required"],
  ["brk-change-type.yaml", "response-property-type-changed"],
  ["brk-change-format.yaml", "response-property-type-specialized"],
  ["brk-remove-request-enum.yaml", "request-property-enum-value-removed"],
  ["brk-add-error-response.yaml", "response-non-success-status-added"],
];

const compatible = ["compat-add-optional-and-op.yaml", "compat-add-enum-in-request.yaml"];

describe("contract:diff (oasdiff con severidades de OPE)", () => {
  it.each(breaking)("%s falla como incompatible con el check %s", (file, check) => {
    const result = diff(base, path.join(fixtures, file));
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain(check);
    expect(result.output).toContain("sin aumento de versión mayor");
  });

  it.each(compatible)("%s pasa como compatible", (file) => {
    const result = diff(base, path.join(fixtures, file));
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Sin cambios incompatibles");
  });

  it("el mismo contrato no reporta cambios", () => {
    const result = diff(base, base);
    expect(result.status).toBe(0);
    expect(result.output).toContain("Sin cambios incompatibles");
  });

  it("un cambio incompatible con versión mayor aumentada pasa y lo reporta como esperado", () => {
    const result = diff(base, path.join(fixtures, "major-bump.yaml"));
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Cambio incompatible esperado: versión mayor 1 → 2");
  });

  it("sin contrato base la comparación se omite con aviso", () => {
    const result = diff(path.join(fixtures, "no-existe.yaml"), base);
    expect(result.status).toBe(0);
    expect(result.output).toContain("AVISO: sin contrato base");
  });
});
