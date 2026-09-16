// US4 (FR-030..FR-033; ADR-016): the mutation gate mutates only the changed src/ lines, skips
// with a reason when there is nothing to mutate, and treats a runner that ran zero tests as broken.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

interface Range {
  file: string;
  start: number;
  end: number;
}
interface Mutant {
  mutatorName: string;
  status: string;
  testsCompleted?: number;
  coveredBy?: string[];
  location: { start: { line: number } };
}
interface Report {
  files: Record<string, { mutants: Mutant[] }>;
}
interface Module {
  mutableFilter: () => (file: string) => boolean;
  rangesFromDiff: (diff: string, isMutable: (file: string) => boolean) => Range[];
  decide: (ranges: Range[], baseRef: string | null) => { mutate: string[] } | { skipped: string };
  guardZeroTests: (report: Report) => string | null;
  survivors: (report: Report) => { file: string; line: number; rule: string }[];
}

let mod: Module;
beforeAll(async () => {
  mod = (await import(pathToFileURL(path.resolve("scripts/mutation-diff.mjs")).href)) as Module;
});

const diff = (file: string, hunks: string) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n${hunks}`;

describe("rangesFromDiff", () => {
  it("turns an added hunk into a line range of the new file", () => {
    const ranges = mod.rangesFromDiff(diff("src/x.ts", "@@ -10,0 +11,3 @@\n+a\n+b\n+c\n"), () => true);
    expect(ranges).toEqual([{ file: "src/x.ts", start: 11, end: 13 }]);
  });

  it("ignores pure deletions and a single-line hunk counts one line", () => {
    const text = diff("src/x.ts", "@@ -5,2 +5,0 @@\n-a\n-b\n@@ -20 +19 @@\n-old\n+new\n");
    expect(mod.rangesFromDiff(text, () => true)).toEqual([{ file: "src/x.ts", start: 19, end: 19 }]);
  });

  it("ignores files the filter rejects and deleted files", () => {
    const text =
      diff("src/composition/ports.ts", "@@ -1,0 +2,2 @@\n+a\n+b\n") +
      "diff --git a/src/gone.ts b/src/gone.ts\n--- a/src/gone.ts\n+++ /dev/null\n@@ -1,3 +0,0 @@\n-a\n-b\n-c\n" +
      diff("src/domain/x.ts", "@@ -1,0 +2,2 @@\n+a\n+b\n");
    const isMutable = mod.mutableFilter();
    expect(mod.rangesFromDiff(text, isMutable)).toEqual([{ file: "src/domain/x.ts", start: 2, end: 3 }]);
  });
});

describe("mutableFilter (stryker.config.json)", () => {
  it("mutates production TypeScript but not generated types, composition, main, index or declarations", () => {
    const isMutable = mod.mutableFilter();
    expect(isMutable("src/domain/ingestion/batch.ts")).toBe(true);
    expect(isMutable("src/interface-adapters/http/generated/api.d.ts")).toBe(false);
    expect(isMutable("src/composition/ports.ts")).toBe(false);
    expect(isMutable("src/main.ts")).toBe(false);
    expect(isMutable("src/domain/ledger/index.ts")).toBe(false);
    expect(isMutable("src/types.d.ts")).toBe(false);
    expect(isMutable("tests/unit/x.test.ts")).toBe(false);
  });
});

describe("decide", () => {
  it("skips without a base ref, skips without production lines, otherwise mutates the ranges", () => {
    expect(mod.decide([{ file: "src/x.ts", start: 1, end: 2 }], null)).toEqual({ skipped: "no-base-ref" });
    expect(mod.decide([], "origin/main")).toEqual({ skipped: "no-production-lines" });
    expect(mod.decide([{ file: "src/x.ts", start: 3, end: 7 }], "origin/main")).toEqual({
      mutate: ["src/x.ts:3-7"],
    });
  });
});

describe("guardZeroTests", () => {
  const mutant = (over: Partial<Mutant>): Mutant => ({
    mutatorName: "EqualityOperator",
    status: "Survived",
    location: { start: { line: 1 } },
    ...over,
  });

  it("flags a survived mutant with coverage that executed zero tests as a broken runner", () => {
    const report: Report = {
      files: { "src/x.ts": { mutants: [mutant({ testsCompleted: 0, coveredBy: ["t1"] })] } },
    };
    expect(mod.guardZeroTests(report)).toBe("mutation runner executed zero tests for 1 covered mutant(s)");
  });

  it("accepts survivors that did run tests, and uncovered mutants", () => {
    const report: Report = {
      files: {
        "src/x.ts": {
          mutants: [
            mutant({ testsCompleted: 3, coveredBy: ["t1"] }),
            mutant({ status: "NoCoverage", testsCompleted: 0, coveredBy: [] }),
          ],
        },
      },
    };
    expect(mod.guardZeroTests(report)).toBeNull();
    expect(mod.survivors(report).map((f) => f.rule)).toEqual([
      "mutation/EqualityOperator",
      "mutation/EqualityOperator",
    ]);
  });
});
