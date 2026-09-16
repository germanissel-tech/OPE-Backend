// US5 (FR-040): the pre-commit hook runs format and lint on staged files and the typecheck;
// never the contract verification or the tests. Static verification of lefthook.yml
// (running git hooks inside a test would be brittle).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Job {
  name: string;
  run: string;
  glob?: string;
}
interface Lefthook {
  "pre-commit": { parallel?: boolean; jobs: Job[] };
}

const config = parse(readFileSync(path.resolve("lefthook.yml"), "utf8")) as Lefthook;
const jobs = config["pre-commit"].jobs;
const byName = (name: string): Job | undefined => jobs.find((j) => j.name === name);

describe("lefthook.yml (pre-commit)", () => {
  it("runs format, lint and typecheck in parallel", () => {
    expect(config["pre-commit"].parallel).toBe(true);
    expect(jobs.map((j) => j.name).sort()).toEqual(["format", "lint", "typecheck"]);
  });

  it("format and lint act only on staged files, with the spec globs", () => {
    expect(byName("format")?.run).toContain("{staged_files}");
    expect(byName("format")?.glob).toBe("*.{ts,mts,cts,js,mjs,cjs,json,yaml,yml,md}");
    expect(byName("lint")?.run).toContain("{staged_files}");
    expect(byName("lint")?.glob).toBe("*.{ts,mts,cts,js,mjs,cjs}");
    expect(byName("typecheck")?.run).toBe("npm run typecheck");
  });

  it("does not run contract:check or the tests", () => {
    for (const job of jobs) {
      for (const forbidden of ["contract:check", "npm test", "vitest", "test:contract", "release-check"]) {
        expect(job.run, `${job.name} must not run ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
