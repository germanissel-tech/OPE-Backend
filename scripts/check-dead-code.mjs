// check:dead-code — files, exports and dependencies nobody uses, with knip (ADR-016, FR-021).
//
//   node scripts/check-dead-code.mjs [--root <dir>] [--json]
//
// Blocking: unused files, unused exports, unused dependencies, unlisted dependencies and
// unlisted binaries. Informative: exported types nobody imports (a module's index.ts is its
// public contract and types cost nothing at runtime): listed, never failing.
//
// knip.json cannot carry comments, so the reasons for its exclusions live here:
// - ignoreDependencies: `@redocly/cli` and `@stoplight/spectral-ruleset-bundler` run through
//   `runCli()` in scripts/lib.mjs; `redoc` is read from node_modules in contract-docs.mjs;
//   `jscpd` runs through its `run-jscpd.js` entry in check-duplication.mjs; the three
//   `@stryker-mutator/*` packages are loaded by Stryker from stryker.config.json.
// - ignoreBinaries: `uvx` (Schemathesis) is installed outside npm.
// - ignore: fixtures (deliberate violations), generated types and the skill evals.
import path from "node:path";
import { argString, parseArgs } from "./governance-lib.mjs";
import { capture, repoRoot } from "./lib.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */
/** @typedef {{ name: string; line?: number; col?: number }} Symbol_ */
/** @typedef {Record<string, Symbol_[] | string> & { file: string }} IssueSet */

const BLOCKING = /** @type {const} */ ([
  ["files", "unused file"],
  ["exports", "unused export"],
  ["nsExports", "unused namespace export"],
  ["dependencies", "unused dependency"],
  ["devDependencies", "unused devDependency"],
  ["unlisted", "unlisted dependency"],
  ["binaries", "unlisted binary"],
  ["unresolved", "unresolved import"],
  ["duplicates", "duplicate export"],
]);
const INFORMATIVE = /** @type {const} */ ([
  ["types", "unused exported type"],
  ["nsTypes", "unused namespace type"],
]);

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const json = args["json"] === true;
const knip = path.join(repoRoot, "node_modules", "knip", "bin", "knip.js");

const result = capture(process.execPath, [knip, "--no-progress", "--no-exit-code", "--reporter", "json"], {
  cwd: root,
});
if (result.status !== 0) {
  console.error(`check:dead-code — knip failed (${result.status}): ${result.stderr || result.stdout}`);
  process.exit(2);
}
const report = /** @type {{ issues: IssueSet[] }} */ (JSON.parse(result.stdout));

/**
 * @param {IssueSet} issue
 * @param {readonly (readonly [string, string])[]} kinds
 * @returns {Finding[]}
 */
function findingsOf(issue, kinds) {
  /** @type {Finding[]} */
  const out = [];
  const file = issue.file.split(path.sep).join("/");
  for (const [kind, label] of kinds) {
    const symbols = issue[kind];
    if (!Array.isArray(symbols)) continue;
    for (const s of symbols) {
      out.push({ file, line: s.line ?? 1, rule: `dead-code/${kind}`, message: `${label}: ${s.name}` });
    }
  }
  return out;
}

const blocking = report.issues.flatMap((issue) => findingsOf(issue, BLOCKING));
const informative = report.issues.flatMap((issue) => findingsOf(issue, INFORMATIVE));
const status = blocking.length === 0 ? "pass" : "fail";

if (json) {
  const findings = [
    ...blocking.map((f) => ({ ...f, mode: "blocking" })),
    ...informative.map((f) => ({ ...f, mode: "informative" })),
  ];
  console.log(JSON.stringify({ gate: "dead-code", mode: "blocking", status, findings }));
} else {
  for (const f of blocking) console.log(`${f.file}:${f.line}: ${f.message}`);
  if (informative.length > 0) {
    console.log(`check:dead-code — ${informative.length} exported type(s) nobody imports (informative):`);
    for (const f of informative) console.log(`  ${f.file}:${f.line}: ${f.message}`);
  }
  if (status === "fail")
    console.error(`check:dead-code — ${blocking.length} finding(s); remove or wire them.`);
  else console.log("check:dead-code — no unused files, exports or dependencies.");
}
process.exit(status === "pass" ? 0 : 1);
