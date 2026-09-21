// Feature 005, US6 (FR-050; ADR-016): CI runs the quality gates and the mutation gate on every change, and a
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
  it("one run per branch: a new push cancels the previous run, and a pull request of this repository does not run twice (017)", () => {
    const concurrency = (
      workflow as unknown as { concurrency: { group: string; "cancel-in-progress": boolean } }
    ).concurrency;
    expect(concurrency.group).toContain("github.ref");
    expect(concurrency["cancel-in-progress"]).toBe(true);
    for (const job of ["checks", "mutation"]) {
      expect(workflow.jobs[job]?.if, job).toContain("pull_request");
      expect(workflow.jobs[job]?.if, job).toContain("head.repo.full_name != github.repository");
    }
  });

  it("runs quality (which chains lint and arch, not repeated) and the scoped tests in the checks job (015 F-055, 017 T003)", () => {
    const checks = runs("checks");
    expect(checks).toContain("npm run quality");
    expect(checks).not.toContain("npm run lint");
    expect(checks).not.toContain("npm run arch");
    expect(checks).toContain("npm run test:scoped");
    expect(checks).not.toContain("npm test");
    expect(checks).not.toContain("npm run test:all");
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
