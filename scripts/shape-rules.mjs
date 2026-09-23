// Shape of the rings (ADR-016, FR-040): fitness functions that dependency-cruiser cannot express.
// Each rule takes a source root and returns violations as `file: message`. tests/architecture/
// shape.test.ts runs them on src/ and on the fixtures; the auditing skill runs them on any scope.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { parse } from "yaml";

// Five screens. Past that, a domain or application file holds more than one responsibility or
// mixes types with rules (constitution I: one authority per module).
export const MAX_RING_FILE_LINES = 300;

/** Rings whose files are kept short: the ones that carry business rules. */
const SHORT_RINGS = ["domain", "application"];
/** Where infrastructure may be instantiated: the composition root, the framework layer and the gateways themselves. */
const MAY_INSTANTIATE = ["composition/", "infrastructure/"];
/** A gateway of a module of the adapters ring (feature 018): `interface-adapters/<module>/gateways/`. */
const GATEWAY = /^interface-adapters\/[^/]+\/gateways\//;
/** The controllers of the adapters ring (feature 018): `interface-adapters/<module>/controllers/`. */
const CONTROLLER = /^interface-adapters\/[^/]+\/controllers\//;

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
 * `interface-adapters/<module>/controllers/<kebab>.ts`, and every controller file is one operationId.
 * @param {string} root
 * @param {string} bundlePath
 * @returns {string[]}
 */
export function oneControllerPerOperation(root, bundlePath) {
  const controllers = tsFiles(root, "interface-adapters").filter((f) => CONTROLLER.test(f));
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
        `interface-adapters/<module>/controllers/${name}.ts: missing controller for operationId ${id}`,
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
    if (MAY_INSTANTIATE.some((p) => file.startsWith(p)) || GATEWAY.test(file)) continue;
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

/** A condition on a configuration field: `if (config.x`, `config.x === …`, `config.x ? …`, `switch (config.x`. */
const CONFIG_BRANCH =
  /\b(?:if|while|switch)\s*\([^)]*\bconfig\.\w+|\bconfig\.\w+\s*(?:===|!==|==|!=|\?[^?.]|&&|\|\|)/;

/**
 * Rule 5: the composition root does not branch on configuration. Which profile, which modules
 * and which defaults apply is decided once, at the process entry, and injected; a `config.x`
 * inside a condition under composition/ is a decision taken in the middle and repeated below
 * (ADR-013). Reading a field to pass it on (`config.port`) is fine; `config.ts` parses, it is exempt.
 * @param {string} root
 * @returns {string[]}
 */
export function noConfigBranchInRoot(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, "composition")) {
    if (file === "composition/config.ts") continue;
    readFileSync(path.join(root, file), "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const m = CONFIG_BRANCH.exec(line);
        if (m) out.push(`${file}:${i + 1}: the composition root branches on configuration (${m[0].trim()})`);
      });
  }
  return out;
}

const TAB = 9;
const CARRIAGE_RETURN = 13;
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

/**
 * The first ASCII control character of a line other than tab and carriage return (the line was
 * already split on line feeds), as a code point; undefined when there is none.
 * @param {string} line
 * @returns {number | undefined}
 */
function rawControlIn(line) {
  for (const ch of line) {
    const code = ch.codePointAt(0) ?? FIRST_PRINTABLE;
    const control = code < FIRST_PRINTABLE && code !== TAB && code !== CARRIAGE_RETURN;
    if (control || code === DELETE) return code;
  }
  return undefined;
}

/**
 * Rule 6: no raw control character in a source file. A separator such as U+001F written as the
 * character itself is invisible to a reader (an editor shows nothing, or a dash) and survives
 * copy and paste unnoticed; written as its escape it says what it is.
 * @param {string} root
 * @returns {string[]}
 */
export function noRawControlCharacters(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, ".")) {
    const source = readFileSync(path.join(root, file), "utf8");
    source.split(/\r?\n/).forEach((line, i) => {
      const code = rawControlIn(line);
      if (code !== undefined) {
        const hex = code.toString(16).padStart(4, "0").toUpperCase();
        out.push(`${file}:${i + 1}: raw control character U+${hex}; write it as an escape`);
      }
    });
  }
  return out;
}

/** The names of the shape rules, as `shape:<rule>` citations and the audit adapter list them. */
/** Where a module of composition wires itself: one file per module (ADR-033). */
const WIRING_MODULE = /^composition\/modules\/[^/]+\.ts$/;
/** What such a file may export: a component of the graph, and the module itself. */
const WIRED = /^\s*(port\(|compositionModule\()/;

/**
 * What an `export` declares, for the message; undefined when the form is allowed.
 * @param {string} line
 * @param {string} initializer the rest of the line, or the next non-empty line
 * @returns {string | undefined}
 */
function exportedOther(line, initializer) {
  if (/^export (type|interface) /.test(line)) return undefined;
  const constant = /^export const (\w+)\s*=(.*)$/.exec(line);
  if (!constant) return line.replace(/^export\s+/, "").split(/[ ({=]/)[0] || "something";
  const value = (constant[2] ?? "").trim();
  return WIRED.test(value === "" ? initializer : value) ? undefined : `the value ${constant[1] ?? ""}`;
}

/**
 * Rule 7 (ADR-033, FR-008): a module of composition exports only the components it declares, the
 * module itself and the types of what it exposes. Anything else —a factory, a service built
 * outside a binding, a table of gateways— is a side channel through which another module reaches
 * this one without the graph, and therefore without the context map judging it.
 * @param {string} root
 * @returns {string[]}
 */
export function compositionModuleShape(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, ".").filter((f) => WIRING_MODULE.test(f))) {
    const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!line.startsWith("export ")) return;
      const next = lines.slice(i + 1).find((l) => l.trim() !== "") ?? "";
      const other = exportedOther(line, next);
      if (other !== undefined) {
        out.push(`${file}:${i + 1}: a module of composition exports ${other}; only its ports and itself`);
      }
    });
  }
  return out;
}

/**
 * Where a component is built: the builder of a binding —of one port or of several— or of what a
 * module serves.  is a builder too: what it returns is built from what the graph resolved,
 * which is exactly the condition this rule is after.
 */
const BUILDERS = ["bind", "bindAll", "from"];

/**
 * Is this node inside the builder of a binding? What a module serves or exposes may instantiate
 * use cases and services of the application with what the graph resolved; building the
 * implementation of a port is the business of a binding (ADR-033).
 * @param {import("typescript").Node} node
 * @returns {boolean}
 */
function insideABinding(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      BUILDERS.includes(current.expression.text)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * An object literal that stands for a component: it carries behaviour —a method or a property
 * that is a function of its own— and it is what something produces, not what something is told.
 * The readers a decorator takes are arguments, and a property holding the result of a call (a
 * handler a factory returns) is not behaviour of its own.
 * @param {import("typescript").Node} node
 * @returns {boolean}
 */
function carriesBehaviour(node) {
  if (!ts.isObjectLiteralExpression(node)) return false;
  const produced =
    ts.isReturnStatement(node.parent) ||
    ts.isVariableDeclaration(node.parent) ||
    (ts.isParenthesizedExpression(node.parent) && ts.isArrowFunction(node.parent.parent)) ||
    ts.isArrowFunction(node.parent);
  if (!produced) return false;
  return node.properties.some(
    (property) =>
      ts.isMethodDeclaration(property) ||
      (ts.isPropertyAssignment(property) &&
        (ts.isArrowFunction(property.initializer) || ts.isFunctionExpression(property.initializer))),
  );
}

/**
 * The names an import statement binds as values, or none when it is not a value import of the
 * adapters or the infrastructure.
 * @param {import("typescript").Statement} statement
 * @returns {string[]}
 */
function adapterNames(statement) {
  if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly === true) return [];
  const from = statement.moduleSpecifier;
  if (!ts.isStringLiteral(from) || !/(interface-adapters|infrastructure)\//.test(from.text)) return [];
  const bindings = statement.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  return bindings.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text);
}

/**
 * The identifiers a file takes, as values, from the adapters or the infrastructure.
 * @param {import("typescript").SourceFile} source
 * @returns {Set<string>}
 */
function adapterImports(source) {
  return new Set(source.statements.flatMap(adapterNames));
}

/**
 * Rule 8 (ADR-033, FR-015): in a module of composition, the implementation of a port is built
 * inside the builder of its binding and nowhere else. A gateway instantiated in what the module
 * serves, or an object with behaviour written in the middle of the wiring, is a component the
 * graph does not know it has: nothing can replace it, and no deployment can serve it otherwise.
 * @param {string} root
 * @returns {string[]}
 */
export function portImplementationsOnlyInBind(root) {
  /** @type {string[]} */
  const out = [];
  for (const file of tsFiles(root, ".").filter((f) => WIRING_MODULE.test(f))) {
    const full = path.join(root, file);
    const source = ts.createSourceFile(full, readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    const adapters = adapterImports(source);
    /** @param {import("typescript").Node} node */
    const visit = (node) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const isAdapter =
        ts.isNewExpression(node) && ts.isIdentifier(node.expression) && adapters.has(node.expression.text);
      if (isAdapter && !insideABinding(node)) {
        out.push(`${file}:${line}: builds ${node.expression.getText()} outside the builder of a binding`);
      } else if (carriesBehaviour(node) && !insideABinding(node)) {
        out.push(`${file}:${line}: writes an implementation outside the builder of a binding`);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
  }
  return out;
}

export const SHAPE_RULES = [
  "max-file-lines",
  "one-controller-per-operation",
  "new-only-in-composition",
  "no-computed-dynamic-import",
  "no-config-branch-in-root",
  "no-raw-control-characters",
  "composition-module-shape",
  "port-implementations-only-in-bind",
];

/**
 * All five rules on one root, as gate findings.
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
    ...noConfigBranchInRoot(root).map((t) => toFinding("no-config-branch-in-root", t)),
    ...noRawControlCharacters(root).map((t) => toFinding("no-raw-control-characters", t)),
    ...compositionModuleShape(root).map((t) => toFinding("composition-module-shape", t)),
    ...portImplementationsOnlyInBind(root).map((t) => toFinding("port-implementations-only-in-bind", t)),
  ];
}
