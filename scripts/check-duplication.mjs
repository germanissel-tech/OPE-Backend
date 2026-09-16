// check:duplication — structural duplication with jscpd (ADR-016, FR-020).
//
//   node scripts/check-duplication.mjs [--root <dir>] [--json]
//
// Two passes with the same thresholds: `src/` blocks (any clone fails), `tests/` and `scripts/`
// inform (clones are listed, exit 0). Generated code and fixtures are never scanned.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { argString, parseArgs, rel } from "./governance-lib.mjs";
import { capture, repoRoot } from "./lib.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */
/** @typedef {{ name: string; start: number; end: number }} CloneSide */
/** @typedef {{ firstFile: CloneSide; secondFile: CloneSide; lines: number }} Clone */

// 50 tokens is about five lines of TypeScript with braces: below that a match is syntax
// coincidence; above it, knowledge written twice.
const MIN_TOKENS = 50;
const MIN_LINES = 5;
const FORMATS = "typescript,javascript";

/** @typedef {{ name: string; mode: "blocking" | "informative"; paths: string[]; ignore: string[] }} Pass */
/** @type {Pass[]} */
const PASSES = [
  { name: "src", mode: "blocking", paths: ["src"], ignore: ["**/generated/**"] },
  { name: "tests+scripts", mode: "informative", paths: ["tests", "scripts"], ignore: ["**/fixtures/**"] },
];

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const json = args["json"] === true;
const jscpd = path.join(repoRoot, "node_modules", "jscpd", "run-jscpd.js");

/**
 * Runs jscpd on `paths` (relative to root) and returns the clones found.
 * @param {Pass} pass
 * @returns {Clone[]}
 */
function clonesOf(pass) {
  const existing = pass.paths.map((p) => path.join(root, p)).filter((p) => existsSync(p));
  if (existing.length === 0) return [];
  const out = mkdtempSync(path.join(os.tmpdir(), "ope-jscpd-"));
  try {
    const result = capture(process.execPath, [
      jscpd,
      ...existing,
      "--min-tokens",
      String(MIN_TOKENS),
      "--min-lines",
      String(MIN_LINES),
      "--format",
      FORMATS,
      // jscpd matches ignore globs against absolute paths: anchor them to each scanned directory
      // so a fixture tree that itself lives under a `fixtures/` folder can still be scanned.
      "--ignore",
      existing
        .flatMap((dir) => pass.ignore.map((glob) => `${dir.split(path.sep).join("/")}/${glob}`))
        .join(","),
      "--reporters",
      "json,silent",
      "--output",
      out,
    ]);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`jscpd failed (${result.status}): ${result.stderr || result.stdout}`);
    }
    const report = /** @type {{ duplicates?: Clone[] }} */ (
      JSON.parse(readFileSync(path.join(out, "jscpd-report.json"), "utf8"))
    );
    return report.duplicates ?? [];
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/**
 * jscpd names files relative to the scanned path they belong to; findings are shown relative
 * to root, so the path is resolved against each scanned directory until the file exists.
 * @param {Pass} pass
 * @param {CloneSide} side
 * @returns {string}
 */
function shownPath(pass, side) {
  const name = side.name.split(path.sep).join("/");
  for (const p of pass.paths) {
    const candidate = path.resolve(root, p, name);
    if (existsSync(candidate)) return rel(root, candidate);
  }
  return name;
}

/** @type {{ pass: Pass; findings: Finding[] }[]} */
const results = [];
for (const pass of PASSES) {
  const findings = clonesOf(pass).map((clone) => ({
    file: shownPath(pass, clone.firstFile),
    line: clone.firstFile.start,
    rule: "duplication",
    message: `${clone.lines} lines duplicated at ${shownPath(pass, clone.secondFile)}:${clone.secondFile.start}-${clone.secondFile.end}`,
  }));
  results.push({ pass, findings });
}

const blocking = results.filter((r) => r.pass.mode === "blocking").flatMap((r) => r.findings);
const status = blocking.length === 0 ? "pass" : "fail";

if (json) {
  const findings = results.flatMap((r) => r.findings.map((f) => ({ ...f, mode: r.pass.mode })));
  console.log(JSON.stringify({ gate: "duplication", mode: "blocking", status, findings }));
} else {
  for (const { pass, findings } of results) {
    const label = pass.mode === "blocking" ? "blocking" : "informative";
    console.log(`check:duplication — ${pass.name} (${label}): ${findings.length} clone(s)`);
    for (const f of findings) console.log(`  ${f.file}:${f.line}: ${f.message}`);
  }
  if (status === "fail")
    console.error(`check:duplication — ${blocking.length} clone(s) in src/ must be removed.`);
  else console.log("check:duplication — no duplication in src/.");
}
process.exit(status === "pass" ? 0 : 1);
