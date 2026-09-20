// test:mutation — mutation testing scoped to the change (ADR-016, FR-030..FR-033).
//
//   node scripts/mutation-diff.mjs                        # mutate the src/ lines changed against the base ref; break at 100 %
//   node scripts/mutation-diff.mjs --files a.ts,b.ts:5-9  # the same verdict over just those files or lines, re-tested (--force)
//   node scripts/mutation-diff.mjs --all                  # mutate everything Stryker's config allows; informative, own incremental file
//   node scripts/mutation-diff.mjs --check-report         # no Stryker run: no ignored mutant outside a disable line (F-052)
//   node scripts/mutation-diff.mjs --json                 # gate JSON: { gate, mode, status, findings, skipped? }
//
// Base ref: $CONTRACT_BASE_REF, origin/main or main, whichever exists. The diff is taken from the
// merge base to the working tree, so local uncommitted changes count too. Without production
// lines in the diff, or without a base ref, the gate passes and says why.
//
// A `Survived` mutant that ran zero tests while having coverage is a broken runner, not a weak
// test (stryker-js#6210, #6213): the gate fails with its own message instead of reporting false
// survivors.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./governance-lib.mjs";
import { capture, repoRoot, run } from "./lib.mjs";

/** @typedef {{ file: string; start: number; end: number }} Range */
/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */
/**
 * @typedef {{ mutatorName: string; status: string; statusReason?: string; replacement?: string; testsCompleted?: number; coveredBy?: string[]; location: { start: { line: number } } }} Mutant
 */
/** @typedef {{ files: Record<string, { mutants: Mutant[] }> }} MutationReport */
/** @typedef {{ start: number; end: number }} LineRange */

/** The informative sweep keeps its verdicts apart from the gate's incremental file. */
const ALL_INCREMENTAL_FILE = "reports/mutation/stryker-incremental-all.json";
const CONFIG_FILE = path.join(repoRoot, "stryker.config.json");
const REPORT_FILE = path.join(repoRoot, "reports", "mutation", "report.json");
const STRYKER = path.join(repoRoot, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js");
// Every mutant the change introduces must die: the gate is about the change, not the repo (FR-030).
// The verdict is read from the JSON report (Stryker 10 has no `--break` on the CLI), so a survived
// or uncovered mutant fails the gate whatever Stryker's own exit code was.

/**
 * Does `file` match one exclusion glob of stryker.config.json? Only the shapes used there are
 * understood: `dir/**` (a subtree), `dir/**\/name.ts` (a basename under a subtree),
 * `dir/**\/*.ext` (an extension under a subtree) and a literal path.
 * @param {string} glob
 * @param {string} file
 * @returns {boolean}
 */
function matchesExclusion(glob, file) {
  if (glob.endsWith("/**")) return file.startsWith(glob.slice(0, -2));
  const deep = glob.indexOf("/**/");
  if (deep !== -1) {
    const prefix = glob.slice(0, deep + 1);
    const tail = glob.slice(deep + 4);
    if (!file.startsWith(prefix)) return false;
    const base = path.posix.basename(file);
    return tail.startsWith("*") ? base.endsWith(tail.slice(1)) : base === tail;
  }
  return file === glob;
}

/**
 * The `mutate` globs of stryker.config.json, so the diff scope and the full run agree on what is mutable.
 * @param {string} [configFile]
 * @returns {(file: string) => boolean}
 */
export function mutableFilter(configFile = CONFIG_FILE) {
  const config = /** @type {{ mutate: string[] }} */ (JSON.parse(readFileSync(configFile, "utf8")));
  const excluded = config.mutate.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
  return (file) => {
    if (!file.startsWith("src/") || !file.endsWith(".ts")) return false;
    return !excluded.some((glob) => matchesExclusion(glob, file));
  };
}

/**
 * Line ranges of the new side of a unified diff (`--unified=0`), per mutable file.
 * @param {string} diffText
 * @param {(file: string) => boolean} isMutable
 * @returns {Range[]}
 */
export function rangesFromDiff(diffText, isMutable) {
  /** @type {Range[]} */
  const ranges = [];
  /** @type {string | null} */
  let file = null;
  for (const line of diffText.split(/\r?\n/)) {
    const header = /^\+\+\+ b\/(.+)$/.exec(line);
    if (header?.[1] !== undefined) {
      file = isMutable(header[1]) ? header[1] : null;
      continue;
    }
    if (line.startsWith("+++ /dev/null")) {
      file = null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || file === null) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count === 0) continue; // pure deletion: nothing new to mutate
    ranges.push({ file, start, end: start + count - 1 });
  }
  return ranges;
}

/**
 * Whole-file ranges for files `git diff` cannot see: the ones never added to the index. Locally a
 * new file is invisible to the diff until it is staged, while CI sees it committed; without this
 * the two gates would judge different code.
 * @param {string[]} files repo-relative paths
 * @param {(file: string) => boolean} isMutable
 * @param {(file: string) => string} readSource
 * @returns {Range[]}
 */
export function rangesOfUntracked(files, isMutable, readSource) {
  return files
    .filter(isMutable)
    .map((file) => ({ file, start: 1, end: readSource(file).split(/\r?\n/).length }))
    .filter((range) => range.end > 0);
}

/**
 * The ranges a `--files` argument names: `a.ts,b.ts:10-20` (repo-relative, whole file unless a
 * line range follows). The fix loop of one survivor mutates one file, not the whole diff.
 * @param {string} spec
 * @param {(file: string) => boolean} isMutable
 * @param {(file: string) => string} readSource
 * @returns {Range[]}
 */
export function rangesOfFiles(spec, isMutable, readSource) {
  return spec
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const m = /^(.+?)(?::(\d+)-(\d+))?$/.exec(item);
      if (!m || m[1] === undefined) throw new Error(`--files: cannot read "${item}"`);
      const file = m[1].split("\\").join("/");
      if (!isMutable(file)) throw new Error(`--files: ${file} is not a mutable src/ file`);
      const lines = readSource(file).split(/\r?\n/).length;
      const start = m[2] === undefined ? 1 : Number(m[2]);
      const end = m[3] === undefined ? lines : Number(m[3]);
      return { file, start, end };
    });
}

/**
 * @param {Range[]} ranges
 * @param {string | null} baseRef
 * @returns {{ mutate: string[] } | { skipped: "no-base-ref" | "no-production-lines" }}
 */
export function decide(ranges, baseRef) {
  if (baseRef === null) return { skipped: "no-base-ref" };
  if (ranges.length === 0) return { skipped: "no-production-lines" };
  return { mutate: ranges.map((r) => `${r.file}:${r.start}-${r.end}`) };
}

/**
 * Survived mutants with coverage but zero executed tests mean the runner did not run them.
 * @param {MutationReport} report
 * @returns {string | null} the error message, or null
 */
export function guardZeroTests(report) {
  let broken = 0;
  for (const { mutants } of Object.values(report.files)) {
    for (const m of mutants) {
      if (m.status === "Survived" && m.testsCompleted === 0 && (m.coveredBy?.length ?? 0) > 0) broken++;
    }
  }
  return broken > 0 ? `mutation runner executed zero tests for ${broken} covered mutant(s)` : null;
}

const DISABLE_NEXT_LINE = /\/\/\s*Stryker disable next-line\b/;
const DISABLE_BLOCK = /\/\/\s*Stryker disable\b(?! next-line)/;
const RESTORE = /\/\/\s*Stryker restore\b/;
const EXCLUDED_MUTATOR = /excluded mutation/;

/**
 * The lines a source file's `// Stryker disable` comments cover: `next-line` covers the line after
 * it; a block covers from its comment to its `restore`, or to the end of the file when nothing
 * restores it (which is the case this check exists to catch, F-052 of the audit 014).
 * @param {string} source
 * @returns {LineRange[]}
 */
export function disabledRanges(source) {
  /** @type {LineRange[]} */
  const ranges = [];
  /** @type {number | null} */
  let open = null;
  const lines = source.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    const number = i + 1;
    if (DISABLE_NEXT_LINE.test(line)) ranges.push({ start: number + 1, end: number + 1 });
    else if (DISABLE_BLOCK.test(line)) open = number;
    else if (RESTORE.test(line) && open !== null) {
      ranges.push({ start: open, end: number });
      open = null;
    }
  }
  if (open !== null) ranges.push({ start: open, end: lines.length });
  return ranges;
}

/**
 * Mutants Stryker ignored because of a `// Stryker disable` comment whose line is not the one the
 * comment names (a `next-line` directive) nor inside a `disable`/`restore` block: a restore written
 * after the last statement of a block does not restore, and the comment silences the rest of the
 * file. Mutators excluded by configuration (StringLiteral) are not comments and are skipped.
 * @param {MutationReport} report
 * @param {(file: string) => string} readSource the source of a file of the report, by its key
 * @returns {Finding[]}
 */
export function ignoredOutsideDisable(report, readSource) {
  /** @type {Finding[]} */
  const out = [];
  for (const [file, { mutants }] of Object.entries(report.files)) {
    const ignored = mutants.filter(
      (m) => m.status === "Ignored" && !EXCLUDED_MUTATOR.test(m.statusReason ?? ""),
    );
    if (ignored.length === 0) continue;
    const ranges = disabledRanges(readSource(file)).filter((r) => r.end - r.start <= MAX_BLOCK_LINES);
    for (const m of ignored) {
      const line = m.location.start.line;
      if (ranges.some((r) => line >= r.start && line <= r.end)) continue;
      out.push({
        file: file.split(path.sep).join("/"),
        line,
        rule: `mutation/${m.mutatorName}`,
        message: `Ignored outside any Stryker disable range: ${m.statusReason ?? m.mutatorName}`,
      });
    }
  }
  return out;
}

/** A disable block longer than this is a leaked one (the switch groups the repo has span a few lines). */
const MAX_BLOCK_LINES = 20;

/**
 * @param {MutationReport} report
 * @returns {Finding[]}
 */
export function survivors(report) {
  /** @type {Finding[]} */
  const out = [];
  for (const [file, { mutants }] of Object.entries(report.files)) {
    for (const m of mutants) {
      if (m.status !== "Survived" && m.status !== "NoCoverage") continue;
      out.push({
        file: file.split(path.sep).join("/"),
        line: m.location.start.line,
        rule: `mutation/${m.mutatorName}`,
        message: `${m.status}: ${m.replacement ?? m.mutatorName}`,
      });
    }
  }
  return out;
}

/** @returns {string | null} */
function resolveBaseRef() {
  const candidates = [process.env["CONTRACT_BASE_REF"], "origin/main", "main"].filter(
    (c) => typeof c === "string",
  );
  for (const ref of candidates) {
    if (capture("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0) return ref;
  }
  return null;
}

/** Files under src/ that git does not track yet (never staged). @returns {string[]} */
function untrackedFiles() {
  const listed = capture("git", ["ls-files", "--others", "--exclude-standard", "--", "src"]);
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
  return listed.stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

/**
 * @param {string} baseRef
 * @returns {string}
 */
function diffAgainst(baseRef) {
  const mergeBase = capture("git", ["merge-base", baseRef, "HEAD"]);
  const from = mergeBase.status === 0 ? mergeBase.stdout.trim() : baseRef;
  const diff = capture("git", ["diff", "--unified=0", "--no-color", from, "--", "src"]);
  if (diff.status !== 0) throw new Error(`git diff failed: ${diff.stderr}`);
  return diff.stdout;
}

/**
 * @param {string[]} extra
 * @returns {number}
 */
function runStryker(extra) {
  return run(process.execPath, [STRYKER, "run", CONFIG_FILE, ...extra]);
}

/** @returns {MutationReport} */
function readReport() {
  if (!existsSync(REPORT_FILE)) throw new Error(`Stryker wrote no report at ${REPORT_FILE}`);
  return /** @type {MutationReport} */ (JSON.parse(readFileSync(REPORT_FILE, "utf8")));
}

/**
 * @param {{ mode: "blocking" | "informative"; status: "pass" | "fail"; findings: Finding[]; skipped?: string; error?: string; passed?: string }} outcome
 * @param {boolean} json
 */
function emit(outcome, json) {
  if (json) {
    console.log(JSON.stringify({ gate: "mutation", ...outcome }));
    return;
  }
  if (outcome.skipped) console.log(`test:mutation — skipped: ${outcome.skipped.replace(/-/g, " ")}`);
  for (const f of outcome.findings) console.log(`${f.file}:${f.line}: ${f.message}`);
  if (outcome.error) console.error(`test:mutation — ${outcome.error}`);
  else if (outcome.status === "fail")
    console.error(`test:mutation — ${outcome.findings.length} mutant(s) survived.`);
  else if (!outcome.skipped) console.log(`test:mutation — ${outcome.passed ?? "every mutant died."}`);
}

/**
 * The source of a file of the report, by the key Stryker used (relative to the repo root).
 * @param {string} file
 * @returns {string}
 */
function sourceOf(file) {
  return readFileSync(path.isAbsolute(file) ? file : path.join(repoRoot, file), "utf8");
}

/**
 * @param {Finding[]} leaked
 * @returns {string | null}
 */
function leakedError(leaked) {
  return leaked.length > 0 ? `${leaked.length} mutant(s) ignored outside a Stryker disable range` : null;
}

/**
 * `--check-report`: the last full report, without running Stryker — every ignored mutant sits on a
 * line its comment names (F-052 of the audit 014).
 * @param {boolean} json
 * @returns {number}
 */
function checkReportMode(json) {
  const leaked = ignoredOutsideDisable(readReport(), sourceOf);
  const error = leakedError(leaked);
  emit(
    {
      mode: "blocking",
      status: error ? "fail" : "pass",
      findings: leaked,
      passed: "every ignored mutant sits on the line its comment names.",
      ...(error ? { error } : {}),
    },
    json,
  );
  return error ? 1 : 0;
}

/**
 * `--all`: everything mutated, survivors informative; a leaked disable comment or a run without
 * tests still fails.
 * @param {boolean} json
 * @returns {number}
 */
function allMode(json) {
  // Its own incremental file: the informative sweep must not feed verdicts into the blocking gate.
  runStryker(["--reporters", "clear-text,progress,html,json", "--incrementalFile", ALL_INCREMENTAL_FILE]);
  const report = readReport();
  const leaked = ignoredOutsideDisable(report, sourceOf);
  const error = guardZeroTests(report) ?? leakedError(leaked);
  emit(
    {
      mode: "informative",
      status: error ? "fail" : "pass",
      findings: [...survivors(report), ...leaked],
      ...(error ? { error } : {}),
    },
    json,
  );
  return error ? 1 : 0;
}

/**
 * The blocking verdict over some ranges: every mutant of those lines dies, or the gate fails.
 * @param {Range[]} ranges
 * @param {string | null} baseRef
 * @param {boolean} json
 * @param {string[]} extra Stryker arguments beyond `--mutate`
 * @returns {number}
 */
function blockingMode(ranges, baseRef, json, extra) {
  const decision = decide(ranges, baseRef);
  if ("skipped" in decision) {
    emit({ mode: "blocking", status: "pass", findings: [], skipped: decision.skipped }, json);
    return 0;
  }
  const status = runStryker(["--mutate", decision.mutate.join(","), ...extra]);
  const report = readReport();
  const error = guardZeroTests(report);
  const findings = survivors(report);
  const failed = error !== null || status !== 0 || findings.length > 0;
  emit({ mode: "blocking", status: failed ? "fail" : "pass", findings, ...(error ? { error } : {}) }, json);
  return failed ? 1 : 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const json = args["json"] === true;
  if (args["check-report"] === true) return checkReportMode(json);
  if (args["all"] === true) return allMode(json);
  const isMutable = mutableFilter();
  const files = args["files"];
  if (typeof files === "string") {
    // The fix loop: one file (or range), every mutant re-tested regardless of the incremental file.
    return blockingMode(rangesOfFiles(files, isMutable, sourceOf), "--files", json, ["--force"]);
  }
  const baseRef = resolveBaseRef();
  const ranges =
    baseRef === null
      ? []
      : [
          ...rangesFromDiff(diffAgainst(baseRef), isMutable),
          ...rangesOfUntracked(untrackedFiles(), isMutable, sourceOf),
        ];
  return blockingMode(ranges, baseRef, json, []);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exit(main());
  } catch (/** @type {unknown} */ err) {
    console.error(`test:mutation — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
