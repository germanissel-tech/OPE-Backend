// Feature 001 — FR-020 / US1 scenarios 11-12 and edge cases: every class of incompatible change fails the diff
// when the major version did not increase; compatible changes pass; with a major bump it passes;
// without a base contract it is skipped with a warning.
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
    const e = err as { status: number; stdout?: string; stderr?: string };
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
  ["brk-add-error-response.yaml", "ope-client-error-response-added"],
];

const compatible = [
  "compat-add-optional-and-op.yaml",
  "compat-add-enum-in-request.yaml",
  "compat-add-server-error-response.yaml",
];

describe("contract:diff (oasdiff with OPE severities)", () => {
  it.each(breaking)("%s fails as incompatible with check %s", (file, check) => {
    const result = diff(base, path.join(fixtures, file));
    expect(result.status, result.output).not.toBe(0);
    expect(result.output).toContain(check);
    expect(result.output).toContain("without a major version bump");
  });

  it.each(compatible)("%s passes as compatible", (file) => {
    const result = diff(base, path.join(fixtures, file));
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("No incompatible changes");
  });

  it("the same contract reports no changes", () => {
    const result = diff(base, base);
    expect(result.status).toBe(0);
    expect(result.output).toContain("No incompatible changes");
  });

  it("an incompatible change with an increased major version passes and reports it as expected", () => {
    const result = diff(base, path.join(fixtures, "major-bump.yaml"));
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Expected incompatible change: major version 1 → 2");
  });

  it("an incompatible change passes while the contract is marked building, and says so", () => {
    const result = diff(base, path.join(fixtures, "building.yaml"));
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("response-optional-property-removed");
    expect(result.output).toContain("Incompatible change accepted: the contract is building");
    expect(result.output).not.toContain("without a major version bump");
  });

  it("without a base contract the comparison is skipped with a warning", () => {
    const result = diff(path.join(fixtures, "no-existe.yaml"), base);
    expect(result.status).toBe(0);
    expect(result.output).toContain("WARNING: no base contract");
  });
});
