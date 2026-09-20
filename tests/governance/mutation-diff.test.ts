// Feature 005, US4 (FR-030..FR-033; ADR-016): the mutation gate mutates only the changed src/ lines, skips
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
  statusReason?: string;
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
  disabledRanges: (source: string) => { start: number; end: number }[];
  rangesOfFiles: (
    spec: string,
    isMutable: (file: string) => boolean,
    readSource: (file: string) => string,
  ) => { file: string; start: number; end: number }[];
  rangesOfUntracked: (
    files: string[],
    isMutable: (file: string) => boolean,
    readSource: (file: string) => string,
  ) => { file: string; start: number; end: number }[];
  ignoredOutsideDisable: (
    report: Report,
    readSource: (file: string) => string,
  ) => { file: string; line: number; message: string }[];
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

describe("rangesOfFiles (--files, the fix loop of one survivor)", () => {
  const sources: Record<string, string> = { "src/a.ts": "1\n2\n3\n4", "src/b.ts": "x" };
  const read = (file: string) => sources[file] ?? "";

  it("a whole file, a line range, and several of them", () => {
    expect(mod.rangesOfFiles("src/a.ts, src/b.ts:1-1", () => true, read)).toEqual([
      { file: "src/a.ts", start: 1, end: 4 },
      { file: "src/b.ts", start: 1, end: 1 },
    ]);
    expect(mod.rangesOfFiles("src\\a.ts:2-3", () => true, read)).toEqual([
      { file: "src/a.ts", start: 2, end: 3 },
    ]);
  });

  it("refuses a file the gate would not mutate", () => {
    expect(() => mod.rangesOfFiles("src/generated/x.ts", (f) => !f.includes("generated"), read)).toThrow(
      "not a mutable src/ file",
    );
  });
});

describe("rangesOfUntracked", () => {
  it("a file git does not track yet is mutated whole, if it is mutable; the diff alone would miss it", () => {
    const sources: Record<string, string> = { "src/new.ts": "a\nb\nc", "src/generated/x.ts": "z" };
    const ranges = mod.rangesOfUntracked(
      ["src/new.ts", "src/generated/x.ts"],
      (file) => !file.includes("generated"),
      (file) => sources[file] ?? "",
    );
    expect(ranges).toEqual([{ file: "src/new.ts", start: 1, end: 3 }]);
  });
});

describe("ignoredOutsideDisable (F-052 of the audit 014)", () => {
  const source = [
    "const a = 1;",
    "// Stryker disable next-line ConditionalExpression: equivalent",
    "const b = a ? 1 : 2;",
    "// Stryker disable BooleanLiteral: unreachable",
    "const c = true;",
    "// Stryker restore BooleanLiteral",
    "const d = false;",
  ].join("\n");
  const ignored = (line: number, reason: string): Mutant => ({
    mutatorName: "ConditionalExpression",
    status: "Ignored",
    statusReason: reason,
    location: { start: { line } },
  });

  it("reads next-line and block ranges from the source", () => {
    expect(mod.disabledRanges(source)).toEqual([
      { start: 3, end: 3 },
      { start: 4, end: 6 },
    ]);
    expect(mod.disabledRanges("// Stryker disable all: leaked\nconst x = 1;\nconst y = 2;")).toEqual([
      { start: 1, end: 3 },
    ]);
  });

  it("flags an ignored mutant outside every range and accepts the ones inside; excluded mutators are not comments", () => {
    const report: Report = {
      files: {
        "src/x.ts": {
          mutants: [
            ignored(3, "equivalent"),
            ignored(5, "unreachable"),
            ignored(7, "unreachable"),
            {
              ...ignored(7, 'Ignored because of excluded mutation "StringLiteral"'),
              mutatorName: "StringLiteral",
            },
          ],
        },
      },
    };
    const leaked = mod.ignoredOutsideDisable(report, () => source);
    expect(leaked).toEqual([
      {
        file: "src/x.ts",
        line: 7,
        rule: "mutation/ConditionalExpression",
        message: "Ignored outside any Stryker disable range: unreachable",
      },
    ]);
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
