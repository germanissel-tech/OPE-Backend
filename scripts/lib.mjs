// Utilities shared by the contract scripts. No shell dependencies: they run the same on
// Windows, macOS and Linux. Types in JSDoc, verified by tsconfig.scripts.json.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @import { SpawnSyncOptions } from "node:child_process" */

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contractRoot =
  process.env["OPE_CONTRACT_ROOT"] ?? path.join(repoRoot, "contracts", "openapi.yaml");
export const bundlePath = path.join(repoRoot, "contracts", "dist", "openapi.yaml");
export const generatedTypesPath =
  process.env["OPE_TYPES_FILE"] ??
  path.join(repoRoot, "src", "interface-adapters", "http", "generated", "api.d.ts");

/**
 * Command + arguments to invoke the CLI of an installed package, bypassing the .cmd wrappers
 * of node_modules/.bin (they fail on Windows with spaces in the path).
 */
const CLI_ENTRIES = /** @type {const} */ ({
  redocly: "@redocly/cli/bin/cli.js",
  spectral: "@stoplight/spectral-cli/dist/index.js",
});

/** @typedef {keyof typeof CLI_ENTRIES} CliName */

/**
 * @param {CliName} name
 * @returns {{ cmd: string; prefix: string[] }}
 */
export function cli(name) {
  const entry = CLI_ENTRIES[name];
  return { cmd: process.execPath, prefix: [path.join(repoRoot, "node_modules", entry)] };
}

/**
 * Runs a command inheriting stdio and returns the exit code.
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {number}
 */
export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * The git reference the repo compares against: `$CONTRACT_BASE_REF`, `origin/main` or `main`;
 * null when none exists (a clone without main).
 * @returns {string | null}
 */
export function resolveBaseRef() {
  const candidates = [process.env["CONTRACT_BASE_REF"], "origin/main", "main"].filter(
    (c) => typeof c === "string",
  );
  for (const ref of candidates) {
    if (capture("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).status === 0) return ref;
  }
  return null;
}

/**
 * Runs the CLI of a package (see `cli`).
 * @param {CliName} name
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {number}
 */
export function runCli(name, args, options = {}) {
  const { cmd, prefix } = cli(name);
  return run(cmd, [...prefix, ...args], options);
}

/** @typedef {{ status: number; stdout: string; stderr: string }} Captured */

/**
 * Runs a command capturing stdout/stderr as UTF-8 text.
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {Captured}
 */
export function capture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: repoRoot, ...options, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Runs a command capturing stdout as bytes (for binary content or unknown encoding, such as
 * `git show`).
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ status: number; stdout: Buffer }}
 */
export function captureBuffer(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: repoRoot });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout };
}
