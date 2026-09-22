// Feature 005 US7 (FR-060, FR-064, FR-066), feature 019 D-01 (ADR-032): the auditing skill's
// deterministic half, now driven by audit.profile.json. run-gates reports the known defect of
// each eval fixture (the repository's own evals and the universal ones the profile admits);
// verify-finding accepts the expected finding and rejects one whose location, source or
// severity does not hold; without a profile, or with one of another version, both say so.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const skill = path.resolve(".claude/skills/auditing-architecture");
const profile = JSON.parse(readFileSync("audit.profile.json", "utf8")) as { evals: string };
/** The repository's evals, with the gate rule that sees the defect, or null when only the cognitive review does. */
const ownEvals: Record<string, string | null> = {
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
  mode: string;
  status: string;
  reason?: string;
  findings: { file: string; line: number; rule: string }[];
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "ope-audit-"));
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function node(
  script: string,
  args: string[],
  env: Record<string, string> = {},
  cwd = process.cwd(),
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [path.join(skill, "scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    cwd,
  });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

const ownExpected = (name: string): Finding =>
  JSON.parse(readFileSync(path.join(profile.evals, name, "expected.json"), "utf8")) as Finding;

function verify(findings: Finding[], env: Record<string, string> = {}): Finding[] {
  const file = path.join(tmp, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(findings));
  const r = node("verify-finding.mjs", [file], env);
  return JSON.parse(r.stdout) as Finding[];
}

/** The gate rules the expected defect must appear under, at the expected file (and line, except for arch: a dependency is located at its import). */
function rulesAt(out: { gates: GateResult[] }, expected: Finding): string[] {
  return out.gates
    .flatMap((g) => g.findings)
    .filter((f) => f.file === expected.file && (f.rule.startsWith("arch/") || f.line === expected.line))
    .map((f) => f.rule)
    .filter((rule) => rule !== "arch/no-orphans");
}

describe("run-gates.mjs on the repository's evals", () => {
  for (const [name, gateRule] of Object.entries(ownEvals)) {
    it(
      gateRule === null
        ? `${name}: no gate sees it (cognitive review only)`
        : `${name}: ${gateRule} reports the expected file and line`,
      () => {
        const r = node("run-gates.mjs", ["--dir", `tests/audit/fixtures/${name}/src`, "--json"]);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { gates: GateResult[] };
        expect(out.gates.filter((g) => g.status === "degraded")).toEqual([]);
        const rules = rulesAt(out, ownExpected(name));
        if (gateRule === null) expect(rules).toEqual([]);
        else expect(rules).toContain(gateRule);
      },
      120_000,
    );
  }

  it("every eval of the profile has its expected.json and README, and every expected file exists", () => {
    for (const name of readdirSync(profile.evals).filter((d) => !d.endsWith(".md"))) {
      expect(existsSync(path.join(profile.evals, name, "README.md")), name).toBe(true);
      expect(existsSync(ownExpected(name).file), name).toBe(true);
    }
  });
});

describe("the universal evals of the plugin, run with this repository's profile", () => {
  const universal = path.join(skill, "evals");
  const lintRules = JSON.parse(
    spawnSync(process.execPath, ["scripts/audit/gate-lint.mjs", "--list-rules"], { encoding: "utf8" }).stdout,
  ) as { rules: string[] };
  for (const name of readdirSync(universal)) {
    const dir = path.join(universal, name);
    const requires = JSON.parse(readFileSync(path.join(dir, "requires.json"), "utf8")) as {
      gateRule: string;
    };
    const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as Finding;
    it(`${name}: requires ${requires.gateRule}, which this profile lists; the gate reports it and the expected verifies`, () => {
      expect(lintRules.rules).toContain(requires.gateRule);
      const r = node("run-gates.mjs", [
        "--dir",
        path.relative(process.cwd(), path.join(dir, "fixture", "src")),
        "--json",
      ]);
      expect(r.status, r.stderr).toBe(0);
      expect(rulesAt(JSON.parse(r.stdout) as { gates: GateResult[] }, expected)).toContain(
        `lint/${requires.gateRule}`,
      );
      const [result] = verify([expected]);
      expect(result?.verified, result?.reason ?? "").toBe(true);
    }, 120_000);
  }
});

describe("without a usable profile", () => {
  it("says what is missing and audits nothing", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "ope-no-profile-"));
    const r = node("run-gates.mjs", ["--dir", ".", "--json"], {}, empty);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe("");
    expect(r.stderr.trim().split(/\r?\n/u)).toEqual([
      `no audit.profile.json in ${empty}: run the conditioning-project skill to create one`,
    ]);
    rmSync(empty, { recursive: true, force: true });
  });

  it("refuses a profile version it does not understand, naming both versions", () => {
    const other = mkdtempSync(path.join(os.tmpdir(), "ope-profile-99-"));
    const current = JSON.parse(readFileSync("audit.profile.json", "utf8")) as { profileVersion: number };
    writeFileSync(path.join(other, "audit.profile.json"), JSON.stringify({ ...current, profileVersion: 99 }));
    const r = node("run-gates.mjs", ["--dir", ".", "--json"], {}, other);
    expect(r.status).toBe(2);
    expect(r.stderr.trim()).toBe("profile version 99 not supported (this skill understands 1)");
    const v = node("verify-finding.mjs", ["nothing.json"], {}, other);
    expect(v.status).toBe(2);
    rmSync(other, { recursive: true, force: true });
  });

  it("a gate that fails to run is degraded with its reason; the others still run", () => {
    const broken = mkdtempSync(path.join(os.tmpdir(), "ope-degraded-"));
    const current = JSON.parse(readFileSync("audit.profile.json", "utf8")) as { gates: object[] };
    writeFileSync(path.join(broken, "broken.mjs"), "process.stderr.write('boom');\nprocess.exit(3);\n");
    writeFileSync(path.join(broken, "silent.mjs"), "console.log(JSON.stringify({ findings: [] }));\n");
    const run = (script: string) => `${JSON.stringify(process.execPath)} ${script}`;
    const gates = [
      { id: "broken", mode: "blocking", run: run("broken.mjs"), format: "findings-v1" },
      { id: "silent", mode: "informative", run: run("silent.mjs"), format: "findings-v1" },
    ];
    writeFileSync(path.join(broken, "audit.profile.json"), JSON.stringify({ ...current, gates }));
    writeFileSync(path.join(broken, "a.ts"), "export const a = 1;\n");
    const r = node("run-gates.mjs", ["--dir", ".", "--json"], {}, broken);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout) as { gates: GateResult[] };
    expect(out.gates.map((g) => [g.gate, g.status, g.reason])).toEqual([
      ["broken", "degraded", "boom"],
      ["silent", "pass", undefined],
    ]);
    rmSync(broken, { recursive: true, force: true });
  });
});

describe("verify-finding.mjs", () => {
  it("accepts every expected.json of the repository's evals", () => {
    for (const name of Object.keys(ownEvals)) {
      const [result] = verify([ownExpected(name)]);
      expect(result?.verified, `${name}: ${result?.reason ?? ""}`).toBe(true);
    }
  });

  it("rejects a line beyond the file, a nonexistent file and an unknown ADR", () => {
    const base = ownExpected("empty-catch");
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

  it("rejects an unknown lint rule, a severity that does not match the source and a source kind the profile does not declare", () => {
    const base = ownExpected("empty-catch");
    const results = verify([
      { ...base, id: "F-001", rule: { id: "x", source: "lint:no-such-rule" }, severity: "medium" },
      { ...base, id: "F-002", rule: { id: "x", source: "ADR-013" }, severity: "low" },
      { ...base, id: "F-003", rule: { id: "x", source: "vibe:whatever" }, severity: "low" },
    ]);
    expect(results[0]?.verified).toBe(false);
    expect(results[0]?.reason).toContain("no-such-rule");
    expect(results[1]?.verified).toBe(false);
    expect(results[1]?.reason).toContain("severity: must be high");
    expect(results[2]?.verified).toBe(false);
    expect(results[2]?.reason).toContain("not declared in profile");
  });

  it("accepts an optional closure and rejects a closure status outside the catalogue", () => {
    const base = ownExpected("empty-catch");
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

  it("resolves constitution, guide, arch and shape sources by the profile, and always accepts clarity", () => {
    const base = ownExpected("empty-catch");
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
      { ...base, id: "F-007", rule: { id: "x", source: "arch:context-map:merchant" }, severity: "medium" },
    ]);
    expect(results.map((r) => r.verified)).toEqual([true, true, true, true, true, false, true]);
  });

  // Feature 014: functional findings cite a DECIDED section of an MVP document or an FR/SC of a spec.
  it("resolves mvp: sources against the MVP documents' headings and spec: sources against FR/SC; both are high", () => {
    const base = ownExpected("empty-catch");
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
    expect(results[4]?.reason).toContain("severity: must be high");
    expect(results[6]?.reason).toContain("does not declare SC-999");
    expect(results[7]?.reason).toContain("specs/999-*/spec.md does not exist");
    expect(results[8]?.reason).toContain("does not match");
  });
});
