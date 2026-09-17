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
  it("runs quality after lint and test:mutation after the tests", () => {
    const ci = runs("ci");
    expect(ci.indexOf("npm run quality")).toBeGreaterThan(ci.indexOf("npm run lint"));
    expect(ci.indexOf("npm run test:mutation")).toBeGreaterThan(ci.indexOf("npm test"));
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
