// check:suite-coverage — every test file of the repository is run by some Vitest project, and the
// declaration of what measures does not outlive its files (feature 039, FR-005, FR-006).
//
//   node scripts/check-suite-coverage.mjs [--json]
//
// **The hole it closes lasted three features.** The mutation runner excluded three durability files by name,
// and the project that held them ran in no CI job: those three ran nowhere, and the only place that knew they
// existed was the configuration of one tool. A list written by hand in one place is how a test stops being
// verified without anybody noticing.
//
// It asks Vitest what each project resolves (`vitest list --filesOnly`) instead of matching the globs here,
// because what runs a file is the `include` and `exclude` of each project: a copy of that matching would make
// this gate agree with itself rather than with the configuration. The comparisons are in
// `suite-coverage-lib.mjs`, and `tests/governance/suite-coverage.test.ts` feeds them lists by hand.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, report, walkFiles } from "./governance-lib.mjs";
import { capture, repoRoot } from "./lib.mjs";
import { exportedStringArray, resolvedFrom, suiteCoverageFindings } from "./suite-coverage-lib.mjs";

/** The configuration that declares the projects and what measures. */
const CONFIG = "vitest.config.ts";
/** The constant that names the measured suites. */
const DECLARATION = "MEASURED_SUITES";
/** Fixtures look like tests and are inputs: the projects exclude them and so does this. */
const NOT_A_SUITE = /(^|\/)fixtures\//u;

/**
 * The test files on disk, POSIX and relative to the root.
 * @param {string} root
 * @returns {string[]}
 */
function onDisk(root) {
  return walkFiles(path.join(root, "tests"), [".ts"])
    .map((file) => path.relative(root, file).replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".test.ts") && !NOT_A_SUITE.test(file));
}

/**
 * What every project resolves, asked of Vitest itself.
 * @param {string} root
 * @returns {string[]}
 */
function resolved(root) {
  const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
  const listed = capture(process.execPath, [vitest, "list", "--filesOnly"], { cwd: root });
  if (listed.status !== 0) {
    throw new Error(`vitest list failed (${String(listed.status)}): ${listed.stderr}`);
  }
  return resolvedFrom(listed.stdout);
}

/** @returns {number} */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot;
  const declared = exportedStringArray(readFileSync(path.join(root, CONFIG), "utf8"), DECLARATION);
  if (declared === null) {
    // Not a finding but a broken build: the gate cannot say anything about a declaration it cannot read.
    throw new Error(`${CONFIG}: ${DECLARATION} is not an exported array of string literals`);
  }
  const files = onDisk(root);
  const findings = suiteCoverageFindings({ onDisk: files, resolved: resolved(root), declared });
  if (args["json"] === true) {
    console.log(
      JSON.stringify({
        gate: "suite-coverage",
        mode: "blocking",
        status: findings.length === 0 ? "pass" : "fail",
        findings,
      }),
    );
    return findings.length === 0 ? 0 : 1;
  }
  return report(
    findings,
    `check:suite-coverage — ${String(files.length)} test file(s): every test file is run by some project, and every measurement declared exists.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
