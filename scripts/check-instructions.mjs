// check:instructions — what the agent instructions cite exists, every section of them is
// classified, the core fits its limit and every rule is scoped (ADR-032 §3, features 024 and 025).
//
//   node scripts/check-instructions.mjs [--policy <file>] [--package <file>] [--root <dir>]
//
// It lives in `contract:check` and not in the `tools` project on purpose: neither the instructions
// nor `src/` is in TOOLS_TRIGGERS, so a test there would not have run on the commit that moved a
// file the instructions name — which is the commit this gate exists to catch (feature 024,
// research R-01). `contract:check` runs always.
//
// It verifies what can be verified mechanically: that what is named exists, that the core fits and
// that a rule can load. Whether what is written is *true*, and whether the one-line invariant the
// core keeps behind a moved rule is *enough*, is verified by review — saying so is the difference
// between this gate being useful and this gate being believed for more than it is.
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { argString, exists, parseArgs, prop, report } from "./governance-lib.mjs";
import {
  citations,
  commandProblems,
  coreSizeProblems,
  pathProblems,
  policyProblems,
  scopeProblems,
  sectionProblems,
  sectionRange,
} from "./instructions-lib.mjs";
import { repoRoot } from "./lib.mjs";

/** @import { Policy } from "./instructions-lib.mjs" */

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const policyFile = path.resolve(root, argString(args, "policy") ?? "scripts/instructions-policy.json");
const packageFile = path.resolve(root, argString(args, "package") ?? "package.json");

const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(policyFile, "utf8")));
const policy = /** @type {Policy} */ (parsed);
const scripts = Object.keys(
  /** @type {Record<string, unknown>} */ (
    prop(/** @type {unknown} */ (JSON.parse(readFileSync(packageFile, "utf8"))), "scripts") ?? {}
  ),
);

const policyName = path.relative(root, policyFile).replaceAll("\\", "/");

/**
 * A problem of the whole policy has no line in any document; it names the policy instead.
 * @param {string} where
 * @param {string} problem
 * @returns {string}
 */
function at(where, problem) {
  const [line, ...rest] = problem.split(": ");
  const text = rest.join(": ");
  return line === "0" ? `${where}: ${text}` : `${where}:${line}: ${text}`;
}

/**
 * A scope is alive when at least one file of the repository matches it.
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesSomething(pattern) {
  return globSync(pattern, { cwd: root }).length > 0;
}

/** @type {string[]} */
const problems = policyProblems(parsed).map((p) => at(policyName, p));
problems.push(...scopeProblems(policy, matchesSomething).map((p) => at(policyName, p)));

let paths = 0;
let sections = 0;
let commands = 0;
for (const entry of policy.files) {
  const file = path.resolve(root, entry.file);
  if (!exists(file)) {
    problems.push(at(policyName, `0: the policy declares a file that is not there: ${entry.file}`));
    continue;
  }
  const markdown = readFileSync(file, "utf8");

  const found = pathProblems(citations(markdown), policy, (f) => exists(path.resolve(root, f)));
  paths += found.checked;
  problems.push(...found.problems.map((p) => at(entry.file, p)));

  const classified = sectionProblems(markdown, entry);
  sections += classified.checked;
  problems.push(...classified.problems.map((p) => at(entry.file, p)));

  // The commands table and the size limit belong to the core: a rule has neither.
  if (entry.role !== "core") continue;
  problems.push(...coreSizeProblems(markdown, policy.coreMaxLines).map((p) => at(entry.file, p)));
  const named = commandProblems(markdown, scripts, policy, sectionRange(markdown, policy.commandsSection));
  commands = named.checked;
  problems.push(...named.problems.map((p) => at(entry.file, p)));
}

// The summary prints green too: a gate that only speaks when it fails does not show that it is
// still looking.
process.exit(
  report(
    problems,
    `Instructions: ${policy.files.length} files, ${paths} paths, ${commands} commands, ${sections} sections; nothing unverified`,
  ),
);
