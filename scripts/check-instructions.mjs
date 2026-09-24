// check:instructions — what the agent instructions cite exists, and every section of them is
// classified (ADR-032 §3, feature 024).
//
//   node scripts/check-instructions.mjs [--file <file>] [--policy <file>] [--package <file>]
//
// It lives in `contract:check` and not in the `tools` project on purpose: neither `CLAUDE.md` nor
// `src/` is in TOOLS_TRIGGERS, so a test there would not have run on the commit that moved a file
// the instructions name — which is the commit this gate exists to catch (feature 024, research
// R-01). `contract:check` runs always.
//
// It verifies what can be verified mechanically: that what is named exists. Whether what is written
// is *true* is verified by review, and saying so is the difference between this gate being useful
// and this gate being believed for more than it is.
import { readFileSync } from "node:fs";
import path from "node:path";
import { argString, exists, parseArgs, prop, report } from "./governance-lib.mjs";
import {
  citations,
  commandProblems,
  pathProblems,
  sectionRange,
  policyProblems,
  sectionProblems,
} from "./instructions-lib.mjs";
import { repoRoot } from "./lib.mjs";

/** @import { Policy } from "./instructions-lib.mjs" */

const args = parseArgs(process.argv.slice(2));
const root = repoRoot;
const file = path.resolve(root, argString(args, "file") ?? "CLAUDE.md");
const policyFile = path.resolve(root, argString(args, "policy") ?? "scripts/instructions-policy.json");
const packageFile = path.resolve(root, argString(args, "package") ?? "package.json");

const markdown = readFileSync(file, "utf8");
const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(policyFile, "utf8")));
const policy = /** @type {Policy} */ (parsed);
const scripts = Object.keys(
  /** @type {Record<string, unknown>} */ (
    prop(/** @type {unknown} */ (JSON.parse(readFileSync(packageFile, "utf8"))), "scripts") ?? {}
  ),
);

const cites = citations(markdown);
const where = path.relative(root, file).replaceAll("\\", "/");
/**
 * A problem of the policy itself has no line in the document; it names the policy instead.
 * @param {string} problem
 * @returns {string}
 */
const at = (problem) => {
  const [line, ...rest] = problem.split(": ");
  const text = rest.join(": ");
  return line === "0" ? `${path.relative(root, policyFile)}: ${text}` : `${where}:${line}: ${text}`;
};

const paths = pathProblems(cites, policy, (f) => exists(path.resolve(root, f)));
const commands = commandProblems(markdown, scripts, policy, sectionRange(markdown, policy.commandsSection));
const sections = sectionProblems(markdown, policy);
const problems = [
  ...policyProblems(parsed),
  ...paths.problems,
  ...commands.problems,
  ...sections.problems,
].map(at);

// The summary prints green too: a gate that only speaks when it fails does not show that it is
// still looking.
process.exit(
  report(
    problems,
    `Instructions: ${paths.checked} paths, ${commands.checked} commands, ${sections.checked} sections; nothing unverified`,
  ),
);
