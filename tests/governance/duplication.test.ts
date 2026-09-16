// US3 (FR-020; ADR-016): structural duplication blocks in src/ and only informs in tests/.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const run = (...extra: string[]) =>
  runScript("check-duplication.mjs", ["--root", fixture("duplication"), ...extra]);

describe("check:duplication", () => {
  const r = run();

  it("fails naming both sides of a clone in src/", () => {
    expect(r.status).toBe(1);
    expect(r.output).toContain("src/a.ts:2: 13 lines duplicated at src/b.ts:2-14");
    expect(r.output).toContain("1 clone(s) in src/ must be removed");
  });

  it("lists clones in tests/ as informative, without failing on them", () => {
    expect(r.output).toContain("tests+scripts (informative): 1 clone(s)");
    expect(r.output).toContain("tests/c.test.ts:2: 13 lines duplicated at tests/d.test.ts:2-14");
  });

  it("emits the gate JSON with --json, blocking findings only", () => {
    const j = JSON.parse(run("--json").output) as {
      gate: string;
      status: string;
      findings: { file: string; line: number; mode: string }[];
    };
    expect(j.gate).toBe("duplication");
    expect(j.status).toBe("fail");
    expect(j.findings.filter((f) => f.mode === "blocking").map((f) => `${f.file}:${f.line}`)).toEqual([
      "src/a.ts:2",
    ]);
    expect(j.findings.some((f) => f.mode === "informative" && f.file === "tests/c.test.ts")).toBe(true);
  });
});
