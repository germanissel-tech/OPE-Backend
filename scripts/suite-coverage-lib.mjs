// Every test file of the repository is run by some project (feature 039). Pure comparisons over three
// lists; `check-suite-coverage.mjs` gathers them and `tests/governance/suite-coverage.test.ts` feeds them
// by hand.
//
// **Why it asks Vitest instead of resolving globs here.** What runs a file is the `include` and `exclude` of
// each project, and reimplementing that matching would make this gate agree with its own copy of the rules
// rather than with the configuration. `vitest list --filesOnly` prints what each project actually resolves,
// which is the only answer worth comparing against the disk.
//
// The hole this closes was real and lasted three features: three durability files were excluded by name in
// the configuration of the mutation runner while the project that held them ran in no CI job, so they ran
// nowhere and nothing said so.

/**
 * The findings of comparing what is on disk, what the projects resolve and what is declared as measured.
 *
 * Three rules, and each one is a way a test can stop being verified:
 *
 * 1. a file on disk that **no project resolves** runs nowhere — the hole itself;
 * 2. a path a project resolves that is **not on disk** means a stale listing, which only happens if the
 *    caller mixed two runs, so it is reported rather than ignored;
 * 3. a declared measurement that is **not on disk** is a declaration that outlived its file: whoever reads
 *    the declaration to learn what measures would be reading a name nobody can run.
 *
 * @param {object} lists
 * @param {readonly string[]} lists.onDisk test files found on disk, POSIX, relative to the root
 * @param {readonly string[]} lists.resolved test files some project resolves, same shape
 * @param {readonly string[]} lists.declared the measured suites the configuration declares, same shape
 * @returns {string[]} one line per finding, empty when every rule holds
 */
export function suiteCoverageFindings({ onDisk, resolved, declared }) {
  /** @type {string[]} */
  const findings = [];
  const runs = new Set(resolved);
  const exists = new Set(onDisk);
  for (const file of onDisk) {
    if (!runs.has(file)) findings.push(`${file}: no project runs it; add it to a project or delete it`);
  }
  for (const file of resolved) {
    if (!exists.has(file)) findings.push(`${file}: a project resolves it and it is not on disk`);
  }
  for (const file of declared) {
    if (!exists.has(file)) findings.push(`${file}: declared as a measurement and not on disk`);
  }
  return findings;
}

/**
 * The `[project] path` lines of `vitest list --filesOnly`, as the paths they name.
 * @param {string} output
 * @returns {string[]}
 */
export function resolvedFrom(output) {
  return output
    .split("\n")
    .map((line) => /^\[[^\]]+\]\s+(\S.*)$/.exec(line.trim())?.[1])
    .filter((file) => file !== undefined)
    .map((file) => file.replaceAll("\\", "/"));
}

/**
 * The string literals of an exported array in a TypeScript module, by name.
 *
 * It reads the declaration from the configuration rather than taking it as an argument, because the
 * configuration is where it has to be true: a copy passed in would be one more place to keep in step.
 * Deliberately a text match and not a parse — the shape it looks for is an array of literals, and anything
 * else (a computed value, a spread) answers nothing and makes the caller say the declaration was not found.
 *
 * @param {string} source the module's text
 * @param {string} name the exported constant
 * @returns {string[] | null} the literals, or null when the constant is not an array of literals
 */
export function exportedStringArray(source, name) {
  const declaration = new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`, "u").exec(source);
  if (declaration?.[1] === undefined) return null;
  const literals = [...declaration[1].matchAll(/["'`]([^"'`]+)["'`]/gu)].map((m) => m[1] ?? "");
  return literals.length === 0 ? null : literals;
}
