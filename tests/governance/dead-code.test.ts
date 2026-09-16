// US3 (FR-021; ADR-016): unused files, exports and dependencies block; unused exported types inform.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const run = (...extra: string[]) =>
  runScript("check-dead-code.mjs", ["--root", fixture("dead-code"), ...extra]);

describe("check:dead-code", () => {
  const r = run();

  it("fails naming the unused file, the unused export and the unused dependency", () => {
    expect(r.status).toBe(1);
    expect(r.output).toContain("src/unused.ts:1: unused file");
    expect(r.output).toContain("src/used.ts:6: unused export: orphan");
    expect(r.output).toContain("package.json:1: unused dependency: left-pad");
  });

  it("lists an unused exported type as informative, not as a failure", () => {
    expect(r.output).toContain("1 exported type(s) nobody imports (informative)");
    expect(r.output).toContain("src/used.ts:8: unused exported type: Unused");
    expect(r.output).toContain("3 finding(s)");
  });

  it("emits the gate JSON with --json, marking each finding's mode", () => {
    const j = JSON.parse(run("--json").output) as {
      gate: string;
      status: string;
      findings: { file: string; rule: string; mode: string }[];
    };
    expect(j.gate).toBe("dead-code");
    expect(j.status).toBe("fail");
    expect(
      j.findings
        .filter((f) => f.mode === "blocking")
        .map((f) => f.rule)
        .sort(),
    ).toEqual(["dead-code/dependencies", "dead-code/exports", "dead-code/files"]);
    expect(j.findings.find((f) => f.rule === "dead-code/types")?.mode).toBe("informative");
  });
});
