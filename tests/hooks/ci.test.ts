// US6 (FR-050; ADR-016): CI runs the quality gates and the mutation gate on every change, and a
// scheduled job mutates the whole repository informatively. Static verification of the workflow.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Step {
  run?: string;
  name?: string;
  uses?: string;
  "continue-on-error"?: boolean;
  with?: Record<string, string>;
}
interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, { if?: string; steps: Step[] }>;
}

const workflow = parse(readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8")) as Workflow;
const runs = (job: string): string[] =>
  workflow.jobs[job]?.steps.map((s) => s.run ?? "").filter(Boolean) ?? [];

describe(".github/workflows/ci.yml", () => {
  it("runs quality after lint and both test projects in the checks job (015 F-055)", () => {
    const checks = runs("checks");
    expect(checks.indexOf("npm run quality")).toBeGreaterThan(checks.indexOf("npm run lint"));
    expect(checks).toContain("npm run test:all");
    expect(checks).not.toContain("npm test");
    expect(checks).not.toContain("npm run test:mutation");
  });

  it("runs the mutation gate in its own job, incrementally, on every change", () => {
    const job = workflow.jobs["mutation"];
    expect(job?.if).toContain("schedule");
    expect(runs("mutation")).toContain("npm run test:mutation");
    const cache = job?.steps.find((s) => s.uses?.startsWith("actions/cache"));
    expect(cache?.with?.["path"]).toBe("reports/mutation/stryker-incremental.json");
    expect(cache?.with?.["restore-keys"]).toContain("stryker-incremental-");
  });

  it("has a scheduled, manually triggerable full mutation job that never blocks and publishes its report", () => {
    expect(workflow.on).toHaveProperty("schedule");
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    const job = workflow.jobs["mutation-full"];
    expect(job?.if).toContain("schedule");
    const sweep = job?.steps.find((s) => s.run?.includes("test:mutation -- --all"));
    expect(sweep?.["continue-on-error"]).toBe(true);
    const upload = job?.steps.find((s) => s.uses?.startsWith("actions/upload-artifact"));
    expect(upload?.with?.["path"]).toBe("reports/mutation/");
  });
});
