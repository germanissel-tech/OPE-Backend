// Shape of the rings (ADR-016, FR-040): fitness functions that dependency-cruiser cannot express.
// Each rule takes a source root and returns violations as `file: message`. tests/architecture/
// shape.test.ts runs them on src/ and on the fixtures; the auditing skill runs them on any scope.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

// Five screens. Past that, a domain or application file holds more than one responsibility or
// mixes types with rules (constitution I: one authority per module).
export const MAX_RING_FILE_LINES = 300;

/** Rings whose files are kept short: the ones that carry business rules. */
const SHORT_RINGS = ["domain", "application"];
/** Where infrastructure may be instantiated: the composition root, the framework layer and the gateways themselves. */
const MAY_INSTANTIATE = ["composition/", "infrastructure/", "interface-adapters/gateways/"];

/**
 * Every `.ts` file under `dir`, as paths relative to `root` with forward slashes.
 * @param {string} root
 * @param {string} dir
 * @returns {string[]}
 */
export function tsFiles(root, dir) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} current */
  const visit = (current) => {
    /** @type {string[]} */
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(current, name);
      if (statSync(full).isDirectory()) visit(full);
      else if (name.endsWith(".ts") && !name.endsWith(".d.ts"))
        out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  visit(path.join(root, dir));
  return out.sort();
}

/**
 * Lines of a file as an editor counts them: a trailing newline does not add an empty line.
 * @param {string} text
 * @returns {number}
 */
function lineCount(text) {
  const parts = text.split(/\r?\n/);
  return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
}

/**
 * Rule 1: no file of domain/ or application/ is longer than MAX_RING_FILE_LINES.
 * @param {string} root
 * @returns {string[]}
 */
export function maxFileLines(root) {
  return SHORT_RINGS.flatMap((ring) => tsFiles(root, ring))
    .map((file) => ({ file, lines: lineCount(readFileSync(path.join(root, file), "utf8")) }))
    .filter(({ lines }) => lines > MAX_RING_FILE_LINES)
    .map(({ file, lines }) => `${file}: ${lines} lines (max ${MAX_RING_FILE_LINES})`);
}

/**
 * `getHealth` → `get-health`
 * @param {string} operationId
 * @returns {string}
 */
export function kebab(operationId) {
  return operationId.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Every `operationId` of the bundled contract.
 * @param {string} bundlePath
 * @returns {string[]}
 */
export function operationIds(bundlePath) {
  const doc = /** @type {{ paths?: Record<string, Record<string, { operationId?: string }>> }} */ (
    parse(readFileSync(bundlePath, "utf8"))
  );
  /** @type {string[]} */
  const ids = [];
  for (const item of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(item)) {
      if (typeof op === "object" && typeof op.operationId === "string") ids.push(op.operationId);
    }
  }
  return ids.sort();
}

/**
 * Rule 2: one controller per operation. Every operationId of the contract has exactly one
 * `interface-adapters/http/controllers/<module>/<kebab>.ts`, and every controller file is one operationId.
 * @param {string} root
 * @param {string} bundlePath
 * @returns {string[]}
 */
export function oneControllerPerOperation(root, bundlePath) {
  const controllers = tsFiles(root, "interface-adapters/http/controllers");
  const byName = new Map(controllers.map((f) => [path.posix.basename(f, ".ts"), f]));
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const expected = new Set();
  for (const id of operationIds(bundlePath)) {
    const name = kebab(id);
    expected.add(name);
    if (!byName.has(name))
      out.push(
        `interface-adapters/http/controllers/<module>/${name}.ts: missing controller for operationId ${id}`,
      );
  }
  for (const [name, file] of byName) {
    if (!expected.has(name)) out.push(`${file}: no operationId in the contract maps to this controller`);
  }
  return out;
}

/**
 * Value imports from npm packages (not relative, not `node:`), as the local identifiers they bind.
 * @param {string} source
 * @returns {Set<string>}
 */
function npmValueImports(source) {
  /** @type {Set<string>} */
  const names = new Set();
  const importRe = /^import\s+(?!type\s)([\s\S]*?)\s+from\s+["']([^"']+)["'];?/gm;
  for (const m of source.matchAll(importRe)) {
    const [, clause = "", specifier = ""] = m;
    if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
    const bindings = clause.replace(/\btype\s+\w+(\s+as\s+\w+)?/g, "");
    const namespace = /\*\s+as\s+(\w+)/.exec(bindings);
    if (namespace?.[1]) names.add(namespace[1]);
    const named = /\{([^}]*)\}/.exec(bindings);
    for (const spec of named?.[1]?.split(",") ?? []) {
      const local = spec
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (local) names.add(local);
    }
    const def = /^\s*(\w+)\s*(,|$)/.exec(bindings.replace(/\{[^}]*\}/, "").trim());
    if (def?.[1] && def[1] !== "type") names.add(def[1]);
  }
  return names;
}

/**
 * Rule 3: infrastructure is instantiated only in composition/, infrastructure/ and the gateways.
 * Anywhere else, `new X(` may not build something imported from an npm package (constitution I).
 * @param {string} root
 * @returns {string[]}
 */
export function newOnlyInComposition(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, ".")) {
    if (MAY_INSTANTIATE.some((p) => file.startsWith(p))) continue;
    const source = readFileSync(path.join(root, file), "utf8");
    const external = npmValueImports(source);
    if (external.size === 0) continue;
    source.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(/\bnew\s+([A-Za-z_$][\w$]*)/g)) {
        const name = m[1] ?? "";
        if (external.has(name))
          out.push(`${file}:${i + 1}: instantiates ${name} from an npm package outside composition`);
      }
    });
  }
  return out;
}

/**
 * The text of a call argument that starts at `from`, up to its matching closing parenthesis.
 * @param {string} line
 * @param {number} from
 * @returns {string}
 */
function argumentAt(line, from) {
  let depth = 0;
  for (let i = from; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      if (depth === 0) return line.slice(from, i);
      depth--;
    }
  }
  return line.slice(from);
}

/**
 * Rule 4: no dynamic `import()` with a computed specifier anywhere in src/. A module loaded from a
 * variable (an environment value, a config field) is code the composition root did not choose:
 * a test seam or an injection point in production (constitution I). Literal specifiers are fine.
 * @param {string} root
 * @returns {string[]}
 */
export function noComputedDynamicImport(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, ".")) {
    const source = readFileSync(path.join(root, file), "utf8");
    source.split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(/\bimport\s*\(/g)) {
        const specifier = argumentAt(line, (m.index ?? 0) + m[0].length).trim();
        if (specifier === "" || /^["'`]/.test(specifier)) continue;
        out.push(`${file}:${i + 1}: dynamic import() of a computed specifier (${specifier})`);
      }
    });
  }
  return out;
}

/**
 * All four rules on one root, as gate findings.
 * @param {string} root
 * @param {string} bundlePath
 * @returns {{ file: string; line: number; rule: string; message: string }[]}
 */
export function shapeFindings(root, bundlePath) {
  /** @param {string} rule @param {string} text */
  const toFinding = (rule, text) => {
    const m = /^([^:]+?)(?::(\d+))?: (.*)$/.exec(text);
    return {
      file: m?.[1] ?? text,
      line: Number(m?.[2] ?? 1),
      rule: `shape/${rule}`,
      message: m?.[3] ?? text,
    };
  };
  return [
    ...maxFileLines(root).map((t) => toFinding("max-file-lines", t)),
    ...oneControllerPerOperation(root, bundlePath).map((t) => toFinding("one-controller-per-operation", t)),
    ...newOnlyInComposition(root).map((t) => toFinding("new-only-in-composition", t)),
    ...noComputedDynamicImport(root).map((t) => toFinding("no-computed-dynamic-import", t)),
  ];
}
