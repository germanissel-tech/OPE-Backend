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
    for (const job of ["checks", "durability", "mutation"]) {
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

  it("runs the durability suite in its own job, always, and not through the scoped choice (039)", () => {
    // **The only cover the durable gateways have** (feature 030, research R-06), and until feature 039 the
    // job that decides did not run it: the choice of suites was written in feature 017, before the project
    // existed, and what covered it was the initial test run of the mutation job — a red that says «the
    // mutation run failed» and sends you to read the worst of the three places.
    const job = workflow.jobs["durability"];
    expect(job?.if).toContain("schedule");
    expect(runs("durability")).toContain("npm run test:durability");
    // Behaviour, not measurements: what decides does not measure (the ceiling of a measurement was
    // calibrated on a development machine and never ran in CI).
    expect(runs("durability")).not.toContain("npm run test:measures");
    expect(runs("durability")).not.toContain("npm run test:all");
    // It compares against nothing, so it neither needs the whole history nor main.
    const checkout = job?.steps.find((s) => s.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.["fetch-depth"]).toBeUndefined();
    expect(runs("durability").some((r) => r.includes("origin main"))).toBe(false);
  });

  it("runs the mutation gate in its own job, incrementally, on every change", () => {
    const job = workflow.jobs["mutation"];
    expect(job?.if).toContain("schedule");
    expect(runs("mutation")).toContain("npm run test:mutation");
    const cache = job?.steps.find((s) => s.uses?.startsWith("actions/cache/restore"));
    expect(cache?.with?.["path"]).toBe("reports/mutation/stryker-incremental.json");
    expect(cache?.with?.["restore-keys"]).toContain("stryker-incremental-");
    // The verdicts are kept even when the gate fails: the next run re-tests only what changed.
    const save = job?.steps.find((s) => s.uses?.startsWith("actions/cache/save"));
    expect(save?.with?.["path"]).toBe("reports/mutation/stryker-incremental.json");
    expect((save as { if?: string } | undefined)?.if).toBe("always()");
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
