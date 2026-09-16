// Utilities shared by the governance scripts (check-adrs, check-markers, check-glossary,
// check-invariant-tests, check-language). No shell dependencies. Types in JSDoc.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/**
 * Walks `dir` recursively and returns the files with any of the given extensions.
 * @param {string} dir
 * @param {readonly string[]} extensions
 * @param {readonly string[]} [ignore] directory names that are not walked
 * @returns {string[]}
 */
export function walkFiles(dir, extensions, ignore = ["node_modules", ".git", "dist"]) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} current */
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  };
  if (exists(dir)) visit(dir);
  return out.sort();
}

/**
 * @param {string} file
 * @returns {boolean}
 */
export function exists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

/** @typedef {Record<string, unknown>} Frontmatter */

/**
 * Splits the YAML frontmatter (`---` … `---`) from the body of a markdown.
 * @param {string} markdown
 * @returns {{ data: Frontmatter | null; body: string; error?: string }}
 */
export function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) return { data: null, body: markdown };
  const [, front = "", body = ""] = match;
  try {
    const data = /** @type {unknown} */ (parse(front));
    if (data !== null && data !== undefined && (typeof data !== "object" || Array.isArray(data))) {
      return { data: null, body, error: "the frontmatter is not an object" };
    }
    return { data: /** @type {Frontmatter} */ (data ?? {}), body };
  } catch (err) {
    return { data: null, body, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reads and parses a YAML. The content type is decided by the consumer.
 * @param {string} file
 * @returns {unknown}
 */
export function readYaml(file) {
  return /** @type {unknown} */ (parse(readFileSync(file, "utf8")));
}

/**
 * Removes the backtick spans of a line (what is quoted does not count as a marker).
 * @param {string} line
 * @returns {string}
 */
export function stripBackticks(line) {
  return line.replace(/`[^`]*`/g, "");
}

/**
 * Prints problems (if any) and returns the exit code.
 * @param {readonly string[]} problems
 * @param {string} okMessage
 * @returns {0 | 1}
 */
export function report(problems, okMessage) {
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`${problems.length} problem(s).`);
    return 1;
  }
  console.log(okMessage);
  return 0;
}

/**
 * Path relative to the root, with POSIX separators, for messages stable across platforms.
 * @param {string} root
 * @param {string} file
 * @returns {string}
 */
export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** @typedef {Record<string, string | true>} ParsedArgs */

/**
 * Minimal parsing of `--key value` and `--flag` arguments.
 * @param {readonly string[]} argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/**
 * String value of a parsed argument, or undefined if absent or given as a flag.
 * @param {ParsedArgs} args
 * @param {string} key
 * @returns {string | undefined}
 */
export function argString(args, key) {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Reads a property of an unknown object without assuming its shape.
 * @param {unknown} obj
 * @param {string} key
 * @returns {unknown}
 */
export function prop(obj, key) {
  if (obj !== null && typeof obj === "object" && key in obj) {
    return /** @type {Record<string, unknown>} */ (obj)[key];
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
