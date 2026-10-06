// Feature 039 — US2 (FR-005, FR-006): no test file of the repository runs in no project.
//
// **The hole this closes lasted three features and nobody saw it.** The mutation runner excluded three
// durability files by name, and the project that held them ran in no CI job, so those three ran nowhere —
// including the one that measures what an administration action costs a concurrent decision, written in
// feature 034 to answer a question nothing else answers.
//
// The comparison is pure and tested here with lists by hand; the script that gathers the real ones asks
// Vitest what each project resolves, because reimplementing the matching of `include` and `exclude` would
// make the gate agree with its own copy of the rules instead of with the configuration.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { runScript } from "./run.js";

/** The lib as this suite uses it; a `.mjs` imported from TypeScript needs its shape said once. */
interface Lib {
  suiteCoverageFindings: (lists: {
    onDisk: readonly string[];
    resolved: readonly string[];
    declared: readonly string[];
  }) => string[];
  resolvedFrom: (output: string) => string[];
  exportedStringArray: (source: string, name: string) => string[] | null;
}

let lib: Lib;
beforeAll(async () => {
  lib = (await import(pathToFileURL(path.resolve("scripts/suite-coverage-lib.mjs")).href)) as Lib;
});

const A = "tests/durability/store.test.ts";
const B = "tests/durability/ingest-latency.test.ts";

describe("suiteCoverageFindings", () => {
  it("says nothing when every file on disk is resolved and every declaration exists", () => {
    expect(lib.suiteCoverageFindings({ onDisk: [A, B], resolved: [A, B], declared: [B] })).toEqual([]);
  });

  it("**names the file no project runs**, which is the hole itself", () => {
    const findings = lib.suiteCoverageFindings({ onDisk: [A, B], resolved: [A], declared: [B] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(B);
    expect(findings[0]).toContain("no project runs it");
  });

  it("names a declaration whose file is gone: a declaration cannot outlive what it names", () => {
    const findings = lib.suiteCoverageFindings({ onDisk: [A], resolved: [A], declared: [B] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(B);
    expect(findings[0]).toContain("declared as a measurement");
  });

  it("names a resolved path that is not on disk, instead of trusting the listing", () => {
    const findings = lib.suiteCoverageFindings({ onDisk: [A], resolved: [A, B], declared: [] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("not on disk");
  });

  it("reports every offender and not just the first: a run tells the whole truth", () => {
    const findings = lib.suiteCoverageFindings({ onDisk: [A, B], resolved: [], declared: [] });
    expect(findings).toHaveLength(2);
  });
});

describe("resolvedFrom", () => {
  it("reads the project and the path of each line of `vitest list --filesOnly`", () => {
    const output = `[fast] tests/unit/a.test.ts\n[durability] tests/durability/store.test.ts\n`;
    expect(lib.resolvedFrom(output)).toEqual(["tests/unit/a.test.ts", "tests/durability/store.test.ts"]);
  });

  it("ignores anything that is not such a line, and answers POSIX paths on Windows", () => {
    expect(lib.resolvedFrom("Vitest 5.0.1\n\n[fast] tests\\unit\\a.test.ts\n")) //
      .toEqual(["tests/unit/a.test.ts"]);
  });
});

describe("exportedStringArray", () => {
  it("reads the literals of the exported array, which is where the declaration has to be true", () => {
    const source = `export const MEASURED_SUITES = [\n  "a.test.ts",\n  "b.test.ts",\n];\n`;
    expect(lib.exportedStringArray(source, "MEASURED_SUITES")).toEqual(["a.test.ts", "b.test.ts"]);
  });

  it("answers nothing for a constant that is not an array of literals, so the caller can say so", () => {
    expect(lib.exportedStringArray("export const MEASURED_SUITES = other.filter(x);", "MEASURED_SUITES")) //
      .toBeNull();
    expect(lib.exportedStringArray("const MEASURED_SUITES = [];", "MEASURED_SUITES")).toBeNull();
  });
});

describe("check:suite-coverage", () => {
  it("passes on the repository: every test file is run by some project", () => {
    const r = runScript("check-suite-coverage.mjs", []);
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("every test file is run");
  });

  it("reads the declaration from vitest.config.ts, so the gate and the configuration cannot disagree", () => {
    const source = readFileSync(path.resolve("vitest.config.ts"), "utf8");
    const declared = lib.exportedStringArray(source, "MEASURED_SUITES");
    expect(declared, "MEASURED_SUITES is declared as an array of literals").not.toBeNull();
    // Every measurement of the durability directory is what the `measures` project runs, and the ones of
    // `fast` keep running there: the declaration says what measures, not what is left out of a gate.
    expect(declared?.some((file) => file.startsWith("tests/durability/"))).toBe(true);
  });
});
