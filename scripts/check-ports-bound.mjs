// check:ports-bound — every abstraction a module of the application declares as a port is bound
// in the graph (feature 020, FR-014; ADR-033). Declaring a port and never binding it is an
// abstraction nobody serves: knip only reports exported types nobody imports, and a port may be
// imported by its use case and still be wired nowhere.
//
//   node scripts/check-ports-bound.mjs [--src <dir>] [--json]
//
// It reads with the TypeScript API, not with regular expressions: a port is the type a file of
// `<module>/ports/` declares under the name of the file, and a binding is the type argument of a
// `port("label")<Type>()` in `composition/modules/`. Two ports may not share a label: the label
// is what the compiler and the boot print, and a repeated one names two different components.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { parseArgs } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */

export const RULES = ["ports-bound/unbound-port", "ports-bound/duplicate-label"];

/**
 * `catalog-store.ts` → `CatalogStore`: a file of `ports/` declares the port it is named after.
 * @param {string} file
 * @returns {string}
 */
export function portNameOf(file) {
  return path
    .basename(file, ".ts")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Every `.ts` file under `dir`, as absolute paths.
 * @param {string} dir
 * @returns {string[]}
 */
function tsFilesIn(dir) {
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
      else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(full);
    }
  };
  visit(dir);
  return out.sort();
}

/**
 * @param {string} file
 * @returns {ts.SourceFile}
 */
function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

/**
 * The line a node starts at, 1-indexed.
 * @param {ts.SourceFile} source
 * @param {ts.Node} node
 * @returns {number}
 */
function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/**
 * The ports the application declares: one per file of `<module>/ports/`, named after its file.
 * @param {string} src
 * @returns {{ name: string; file: string; line: number }[]}
 */
export function declaredPorts(src) {
  /** @type {{ name: string; file: string; line: number }[]} */
  const out = [];
  for (const file of tsFilesIn(path.join(src, "application"))) {
    if (!file.split(path.sep).join("/").includes("/ports/")) continue;
    const source = parse(file);
    const expected = portNameOf(file);
    const relative = path.relative(src, file).split(path.sep).join("/");
    for (const statement of source.statements) {
      const named =
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text === expected;
      if (named) out.push({ name: expected, file: relative, line: lineOf(source, statement) });
    }
  }
  return out;
}

/**
 * The name of the type a `port("label")<Type>()` serves, or undefined when the call is not one.
 * @param {ts.Node} node
 * @returns {{ label: string; type: string } | undefined}
 */
function portCall(node) {
  if (!ts.isCallExpression(node) || !ts.isCallExpression(node.expression)) return undefined;
  const inner = node.expression;
  if (!ts.isIdentifier(inner.expression) || inner.expression.text !== "port") return undefined;
  const [label] = inner.arguments;
  const [type] = node.typeArguments ?? [];
  if (!label || !ts.isStringLiteral(label) || !type) return undefined;
  const name = ts.isTypeReferenceNode(type) ? type.typeName.getText() : type.getText();
  return { label: label.text, type: name };
}

/**
 * Every component the composition declares: its label, the type it serves and where.
 * @param {string} src
 * @returns {{ label: string; type: string; file: string; line: number }[]}
 */
export function declaredComponents(src) {
  /** @type {{ label: string; type: string; file: string; line: number }[]} */
  const out = [];
  for (const file of tsFilesIn(path.join(src, "composition"))) {
    const source = parse(file);
    const relative = path.relative(src, file).split(path.sep).join("/");
    /** @param {ts.Node} node */
    const visit = (node) => {
      const call = portCall(node);
      if (call) out.push({ ...call, file: relative, line: lineOf(source, node) });
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
  }
  return out;
}

/**
 * The findings of the gate: a port nobody binds, and a label two components share.
 * @param {string} src
 * @returns {Finding[]}
 */
export function portsBound(src) {
  const components = declaredComponents(src);
  const served = new Set(components.map((c) => c.type));
  /** @type {Finding[]} */
  const findings = declaredPorts(src)
    .filter((port) => !served.has(port.name))
    .map((port) => ({
      file: port.file,
      line: port.line,
      rule: "ports-bound/unbound-port",
      message: `${port.name} is declared as a port and no composition module binds it`,
    }));
  /** @type {Map<string, string[]>} */
  const byLabel = new Map();
  for (const { label, file } of components) byLabel.set(label, [...(byLabel.get(label) ?? []), file]);
  for (const component of components) {
    const where = byLabel.get(component.label) ?? [];
    if (where.length > 1) {
      findings.push({
        file: component.file,
        line: component.line,
        rule: "ports-bound/duplicate-label",
        message: `the label "${component.label}" is declared by ${where.length} components`,
      });
    }
  }
  return findings;
}

/** @returns {number} */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const src = typeof args["src"] === "string" ? path.resolve(args["src"]) : path.join(repoRoot, "src");
  const findings = portsBound(src);
  if (args["json"] === true) {
    console.log(
      JSON.stringify({
        gate: "ports-bound",
        mode: "blocking",
        status: findings.length === 0 ? "pass" : "fail",
        findings,
      }),
    );
    return findings.length === 0 ? 0 : 1;
  }
  for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.message}`);
  if (findings.length > 0) {
    console.error(`check:ports-bound — ${findings.length} finding(s); bind them or remove them.`);
    return 1;
  }
  const ports = declaredPorts(src).length;
  console.log(`check:ports-bound — ${ports} ports declared, all bound, no label repeated.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
