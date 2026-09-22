// test:scoped — runs the Vitest projects a change actually needs (feature 017, T003). The
// `fast` project always runs; the `tools` project (audit over fixtures, quality chain, contract
// docs: whole toolchains, minutes) only when something it exercises changed against the base.
//
//   node scripts/test-scope.mjs                  # decides from git (base: $CONTRACT_BASE_REF | origin/main | main)
//   node scripts/test-scope.mjs --all            # every project, like test:all
//   node scripts/test-scope.mjs --changed a,b    # test mode: this list instead of git
//   node scripts/test-scope.mjs --dry-run        # prints the projects and exits 0
//
// Without a base (a fresh clone with no main) every project runs: not knowing is not a reason
// to skip. `npm run test:all` stays as the local closure of a story.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { argString, parseArgs } from "./governance-lib.mjs";
import { capture, repoRoot, resolveBaseRef, run } from "./lib.mjs";

/** Paths whose change makes the `tools` project relevant (prefixes or exact files, POSIX). */
export const TOOLS_TRIGGERS = [
  "scripts/",
  ".claude/",
  "contracts/",
  "docs/",
  "tests/audit/",
  "tests/docs/",
  "scripts/audit/",
  "audit.profile.json",
  "config/schemas/",
  "generated/schemas/",
  "tests/governance/quality.test.ts",
  "tests/unit/contract-docs.test.ts",
  "vitest.config.ts",
  "vitest.mutation.config.ts",
  "package.json",
  "package-lock.json",
  ".github/",
];

/**
 * The Vitest projects a set of changed files needs.
 * @param {readonly string[]} changed repo-relative paths, POSIX separators
 * @returns {("fast" | "tools")[]}
 */
export function projectsFor(changed) {
  const tools = changed.some((file) =>
    TOOLS_TRIGGERS.some((trigger) => (trigger.endsWith("/") ? file.startsWith(trigger) : file === trigger)),
  );
  return tools ? ["fast", "tools"] : ["fast"];
}

/**
 * Files changed against the base: committed since the merge base, modified in the working tree
 * and never-added ones.
 * @param {string} baseRef
 * @returns {string[]}
 */
function changedAgainst(baseRef) {
  const mergeBase = capture("git", ["merge-base", baseRef, "HEAD"]);
  const from = mergeBase.status === 0 ? mergeBase.stdout.trim() : baseRef;
  const diff = capture("git", ["diff", "--name-only", from]);
  if (diff.status !== 0) throw new Error(`git diff failed: ${diff.stderr}`);
  const untracked = capture("git", ["ls-files", "--others", "--exclude-standard"]);
  if (untracked.status !== 0) throw new Error(`git ls-files failed: ${untracked.stderr}`);
  return `${diff.stdout}\n${untracked.stdout}`
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** @returns {number} */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const listed = argString(args, "changed");
  /** @type {("fast" | "tools")[]} */
  let projects;
  let why;
  if (args["all"] === true) {
    projects = ["fast", "tools"];
    why = "--all";
  } else if (listed !== undefined) {
    projects = projectsFor(listed.split(",").map((f) => f.trim()));
    why = "--changed";
  } else {
    const baseRef = resolveBaseRef();
    if (baseRef === null) {
      projects = ["fast", "tools"];
      why = "no base branch";
    } else {
      projects = projectsFor(changedAgainst(baseRef));
      why = `changes against ${baseRef}`;
    }
  }
  console.log(`test:scoped — projects: ${projects.join(", ")} (${why})`);
  if (args["dry-run"] === true) return 0;
  const vitest = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");
  return run(process.execPath, [vitest, "run", ...projects.flatMap((p) => ["--project", p])]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exit(main());
  } catch (/** @type {unknown} */ err) {
    console.error(`test:scoped — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
