// Feature 005, US7 (FR-060, FR-064, FR-066): the auditing skill's deterministic half. run-gates reports the
// known defect of each eval fixture; verify-finding accepts the expected finding and rejects one
// whose location, source or severity does not hold.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const skill = path.resolve(".claude/skills/auditing-architecture");
/** Every eval, with the gate rule that sees its defect, or null when only the cognitive review does. */
const evals: Record<string, string | null> = {
  "controller-instantiates-infra": "shape/new-only-in-composition",
  "identical-domain-functions": "lint/sonarjs/no-identical-functions",
  "empty-catch": "lint/sonarjs/no-ignored-exceptions",
  "env-dynamic-import": "shape/no-computed-dynamic-import",
  "hardcoded-profile": "shape/no-config-branch-in-root",
  "central-wiring-list": "arch/composition-wires-by-module",
  "magic-signal-strings": "lint/ope/no-magic-strings",
  "mode-flag-across-layers": null,
  "profile-picks-gateways": "arch/profiles-compose-modules",
};

interface Finding {
  id: string;
  file: string;
  line: number;
  rule: { id: string; source: string };
  severity: string;
  status: string;
  closure?: { status: string; by: string; feature: string };
  verified?: boolean;
  reason?: string;
}
interface GateResult {
  gate: string;
  status: string;
  findings: { file: string; line?: number; rule: string }[];
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "ope-audit-"));
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function node(
  script: string,
  args: string[],
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [path.join(skill, "scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

const expectedOf = (name: string): Finding =>
  JSON.parse(readFileSync(path.join(skill, "evals", name, "expected.json"), "utf8")) as Finding;

function verify(findings: Finding[], env: Record<string, string> = {}): Finding[] {
  const file = path.join(tmp, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(findings));
  const r = node("verify-finding.mjs", [file], env);
  return JSON.parse(r.stdout) as Finding[];
}

describe("run-gates.mjs on the eval fixtures", () => {
  for (const [name, gateRule] of Object.entries(evals)) {
    it(
      gateRule === null
        ? `${name}: no gate sees it (cognitive review only)`
        : `${name}: ${gateRule} reports the expected file and line`,
      () => {
        const r = node("run-gates.mjs", ["--dir", `tests/audit/fixtures/${name}/src`, "--json"]);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { gates: GateResult[] };
        const expected = expectedOf(name);
        // arch findings carry no line (a dependency is file to file): they match on the file alone.
        // `no-orphans` on a one-file fixture is a scope artifact (nothing imports it), not a defect.
        const rulesAt = out.gates
          .flatMap((g) => g.findings)
          .filter((f) => f.file === expected.file && (f.line === undefined || f.line === expected.line))
          .map((f) => f.rule)
          .filter((rule) => rule !== "arch/no-orphans");
        if (gateRule === null) expect(rulesAt).toEqual([]);
        else expect(rulesAt).toContain(gateRule);
      },
      120_000,
    );
  }
});

describe("verify-finding.mjs", () => {
  it("accepts every expected.json of the evals", () => {
    for (const name of Object.keys(evals)) {
      const [result] = verify([expectedOf(name)]);
      expect(result?.verified, `${name}: ${result?.reason ?? ""}`).toBe(true);
    }
  });

  it("rejects a line beyond the file, a nonexistent file and an unknown ADR", () => {
    const base = expectedOf("empty-catch");
    const results = verify([
      { ...base, id: "F-001", line: 9999 },
      { ...base, id: "F-002", file: "src/nope.ts" },
      { ...base, id: "F-003", rule: { id: "x", source: "ADR-999" }, severity: "high" },
    ]);
    expect(results.map((r) => r.verified)).toEqual([false, false, false]);
    expect(results[0]?.reason).toContain("beyond the end");
    expect(results[1]?.reason).toContain("does not exist");
    expect(results[2]?.reason).toContain("docs/adr/999-*.md");
  });

  it("rejects an unknown lint rule and a severity that does not match the source", () => {
    const base = expectedOf("empty-catch");
    const results = verify([
      { ...base, id: "F-001", rule: { id: "x", source: "lint:no-such-rule" } },
      { ...base, id: "F-002", rule: { id: "x", source: "ADR-013" }, severity: "low" },
    ]);
    expect(results[0]?.verified).toBe(false);
    expect(results[0]?.reason).toContain("no-such-rule");
    expect(results[1]?.verified).toBe(false);
    expect(results[1]?.reason).toContain("schema");
  });

  it("accepts an optional closure and rejects a closure status outside the catalogue", () => {
    const base = expectedOf("empty-catch");
    const results = verify([
      { ...base, id: "F-001", closure: { status: "resolved", by: "abc1234", feature: "015" } },
      {
        ...base,
        id: "F-002",
        closure: { status: "rejected", by: "the owner keeps the wiring as it is", feature: "015" },
      },
      { ...base, id: "F-003", closure: { status: "done", by: "abc1234", feature: "015" } },
    ]);
    expect(results[0]?.verified).toBe(true);
    expect(results[1]?.verified).toBe(true);
    expect(results[2]?.verified).toBe(false);
    expect(results[2]?.reason).toContain("schema");
  });

  it("resolves constitution, guide and arch sources, and always accepts clarity", () => {
    const base = expectedOf("empty-catch");
    const results = verify([
      { ...base, id: "F-001", rule: { id: "x", source: "constitution#II. Fail-closed" }, severity: "high" },
      { ...base, id: "F-002", rule: { id: "x", source: "guide#Convenciones" }, severity: "medium" },
      { ...base, id: "F-003", rule: { id: "x", source: "arch:controllers-no-gateways" }, severity: "medium" },
      { ...base, id: "F-004", rule: { id: "x", source: "clarity:vague-name" }, severity: "low" },
      {
        ...base,
        id: "F-005",
        rule: { id: "x", source: "shape:no-computed-dynamic-import" },
        severity: "medium",
      },
      { ...base, id: "F-006", rule: { id: "x", source: "shape:no-such-rule" }, severity: "medium" },
    ]);
    expect(results.map((r) => r.verified)).toEqual([true, true, true, true, true, false]);
  });

  // Feature 014: functional findings cite a DECIDED section of an MVP document or an FR/SC of a spec.
  it("resolves mvp: sources against the MVP documents' headings and spec: sources against FR/SC; both are high", () => {
    const base = expectedOf("empty-catch");
    const docs = { OPE_MVP_DOCS_DIR: path.resolve("tests/audit/fixtures/mvp-docs") };
    const results = verify(
      [
        { ...base, id: "F-001", rule: { id: "x", source: "mvp:01#5. " }, severity: "high" },
        { ...base, id: "F-002", rule: { id: "x", source: "mvp:01#5.2" }, severity: "high" },
        { ...base, id: "F-003", rule: { id: "x", source: "mvp:01#9." }, severity: "high" },
        { ...base, id: "F-004", rule: { id: "x", source: "mvp:02#5" }, severity: "high" },
        { ...base, id: "F-005", rule: { id: "x", source: "mvp:01#5" }, severity: "medium" },
        { ...base, id: "F-006", rule: { id: "x", source: "spec:013#FR-001" }, severity: "high" },
        { ...base, id: "F-007", rule: { id: "x", source: "spec:013#SC-999" }, severity: "high" },
        { ...base, id: "F-008", rule: { id: "x", source: "spec:999#FR-001" }, severity: "high" },
        { ...base, id: "F-009", rule: { id: "x", source: "spec:013#FR-1" }, severity: "high" },
      ],
      docs,
    );
    expect(results.map((r) => r.verified)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(results[2]?.reason).toContain("no heading of 01-arquitectura-mvp.md");
    expect(results[3]?.reason).toContain("02-*.md is not readable");
    expect(results[4]?.reason).toContain("schema");
    expect(results[6]?.reason).toContain("does not declare SC-999");
    expect(results[7]?.reason).toContain("specs/999-*/ does not exist");
    expect(results[8]?.reason).toContain("schema");
  });
});
