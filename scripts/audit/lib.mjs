// What every gate adapter shares (feature 019, D-01; ADR-032): the findings-v1 protocol the
// auditing-architecture skill speaks. An adapter is invoked from the repository root with
// `--files-from <file>` (one repo-relative path per line; may be empty) and answers on stdout
// `{ "findings": [{ file, line, rule, message }] }`; with `--list-rules` it answers
// `{ "rules": [...] }` so a `lint:`/`arch:`/`shape:` citation can be resolved. Exit ≠ 0 means
// the gate is degraded (the message goes to stderr). The adapters are the repository's side of
// the frontier: they know eslint.config.mjs, .dependency-cruiser.cjs, shape-rules.mjs and the
// check-*.mjs scripts; the skill knows only this protocol.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { argString, parseArgs } from "../governance-lib.mjs";
import { repoRoot } from "../lib.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */

/**
 * The invocation of an adapter: the rules mode, or the files of the scope.
 * @param {readonly string[]} argv
 * @returns {{ listRules: true } | { listRules: false; files: string[] }}
 */
export function invocation(argv) {
  const args = parseArgs(argv);
  if (args["list-rules"] === true) return { listRules: true };
  const from = argString(args, "files-from");
  if (from === undefined) fail("usage: --files-from <file> | --list-rules");
  const files = readFileSync(path.resolve(from), "utf8")
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  return { listRules: false, files };
}

/**
 * @param {Finding[]} findings
 */
export function emitFindings(findings) {
  console.log(JSON.stringify({ findings }));
}

/**
 * @param {readonly string[]} rules
 */
export function emitRules(rules) {
  console.log(JSON.stringify({ rules: [...new Set(rules)].sort() }));
}

/**
 * Degraded: the message on stderr, exit 1.
 * @param {string} message
 * @returns {never}
 */
export function fail(message) {
  console.error(message);
  process.exit(1);
}

/**
 * The source root the structural gates (arch, shape) run on: the repository's `src/`, or the
 * common ancestor of the files when they form a source tree of their own (an eval fixture with
 * its own `src/`).
 * @param {readonly string[]} files repo-relative posix paths
 * @returns {string} repo-relative posix path
 */
export function sourceRootOf(files) {
  const first = files[0];
  if (first === undefined || first.startsWith("src/")) return "src";
  const segments = first.split("/");
  const rings = ["domain", "application", "interface-adapters", "infrastructure", "composition"];
  for (let i = segments.length - 1; i > 0; i -= 1) {
    const candidate = segments.slice(0, i).join("/");
    if (rings.some((ring) => existsSync(path.join(repoRoot, candidate, ring)))) return candidate;
  }
  return "src";
}

/**
 * Keeps the findings of the scope (every finding when the scope is empty).
 * @param {Finding[]} findings
 * @param {readonly string[]} files
 * @returns {Finding[]}
 */
export function inScope(findings, files) {
  const scope = new Set(files);
  return scope.size === 0 ? findings : findings.filter((f) => scope.has(f.file));
}
