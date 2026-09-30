// Feature 005, US4 (FR-030..FR-033; ADR-016): the mutation gate mutates only the changed src/ lines, skips
// with a reason when there is nothing to mutate, and treats a runner that ran zero tests as broken.
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
  mtimeOf: (file: string) => number | null;
  noVerdict: (run: {
    status: number;
    startedAtMs: number;
    reportFile: string;
    reportMtimeMs: number | null;
  }) => string | null;
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
    expect(isMutable("generated/api.d.ts")).toBe(false);
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

// Feature 035 (D-31): whether what is on disk is the verdict of the run that just happened.
//
// **The gate used to answer this question by not asking it.** It read the report Stryker leaves behind
// without wondering which run wrote it, so a run that never got to judge reported the figures of the
// previous one — once as three survivors on lines that had been deleted that same day, and once, worse,
// as "0 mutant(s) survived", which is the number whoever runs the gate is hoping to see.
describe("noVerdict", () => {
  const REPORT = "reports/mutation/report.json";
  const STARTED = 1_000_000;
  const run = (over: Partial<Parameters<Module["noVerdict"]>[0]>) =>
    mod.noVerdict({
      status: 0,
      startedAtMs: STARTED,
      reportFile: REPORT,
      reportMtimeMs: STARTED + 1_000,
      ...over,
    });

  it("says the run did not finish, with its code, and does not look at the report at all", () => {
    // The report here is **fresh**: if the answer were about the file, this would be a verdict. It is not,
    // and that is the order the rule promises — a number that was not produced is not even computed.
    expect(run({ status: 7 })).toBe(
      "the mutation run did not finish (exit code 7); nothing on disk is its verdict",
    );
    expect(run({ status: 1, reportMtimeMs: null })).toBe(
      "the mutation run did not finish (exit code 1); nothing on disk is its verdict",
    );
  });

  it("says the run wrote no report when there is none", () => {
    expect(run({ reportMtimeMs: null })).toBe(`Stryker wrote no report at ${REPORT}`);
  });

  it("says the report belongs to a previous run when it is older than this one", () => {
    expect(run({ reportMtimeMs: STARTED - 1 })).toBe(
      `the report at ${REPORT} is older than this run: it belongs to a previous one`,
    );
  });

  it("treats a report written in the same instant as this run's, which is the safe bias", () => {
    // **FR-005, and the bias is deliberate.** File timestamps do not have the same resolution everywhere,
    // and a gate that fails because two instants landed together would cost more than the defect it fixes.
    // The real margin is minutes against milliseconds, so the doubt is resolved towards "it is ours".
    expect(run({ reportMtimeMs: STARTED })).toBeNull();
  });

  it("answers nothing when the run finished and wrote its own report", () => {
    expect(run({})).toBeNull();
  });
});

// The other half of the same question, and the only one a pure test cannot reach: whether the date of a
// **real** file is comparable with `Date.now()` at all.
//
// It is one line of production code (`statSync(file).mtimeMs`) and it is the line that would break the
// feature in silence: a `Date`, or seconds instead of milliseconds, would make every report look older than
// every run, and the gate would refuse to report a verdict it did have. No amount of testing the rule with
// numbers would notice.
describe("mtimeOf (against a real file)", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ope-mtime-"));
    file = path.join(dir, "report.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("answers nothing for a file that is not there", () => {
    expect(mod.mtimeOf(file)).toBeNull();
  });

  it("answers a date on the same scale and epoch as the clock the rule compares against", () => {
    const before = Date.now();
    writeFileSync(file, "{}");
    const at = mod.mtimeOf(file);
    // Written between two readings of the clock, so its date has to sit between them — which is what says
    // it is milliseconds since the same epoch and not seconds, not a `Date`, not something else.
    expect(at).not.toBeNull();
    expect(at ?? 0).toBeGreaterThanOrEqual(before - 1_000);
    expect(at ?? 0).toBeLessThanOrEqual(Date.now() + 1_000);
  });

  it("sees a report left behind by a previous run as older than a run starting now", () => {
    // The whole feature, end to end, over a file: a report written an hour ago and a run that starts now.
    writeFileSync(file, "{}");
    const anHourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(file, anHourAgo, anHourAgo);

    expect(
      mod.noVerdict({
        status: 0,
        startedAtMs: Date.now(),
        reportFile: file,
        reportMtimeMs: mod.mtimeOf(file),
      }),
    ).toBe(`the report at ${file} is older than this run: it belongs to a previous one`);
  });

  it("sees a report written after the run started as this run's", () => {
    // **A second of margin, and the reason is a measurement.** The first version of this case took the
    // instant and wrote the file on the next line, and it failed once out of several runs: the gap between
    // `Date.now()` and a file's `mtimeMs` on this machine is between 0.17 and 1.5 ms, and `mtimeMs` is a
    // float, so which of the two is larger is a race when they are that close.
    //
    // The margin is not papering over the race: it is what makes the case **real**. A mutation run writes
    // its report minutes after it started, so the question this test asks —is a report written during the
    // run ours?— is only meaningful at the scale the mechanism works at. Tightening it to zero would test
    // the resolution of the file system instead, and the rule already resolves that doubt towards "ours"
    // (FR-005).
    const startedAtMs = Date.now() - 1_000;
    writeFileSync(file, "{}");
    expect(
      mod.noVerdict({ status: 0, startedAtMs, reportFile: file, reportMtimeMs: mod.mtimeOf(file) }),
    ).toBeNull();
  });
});
