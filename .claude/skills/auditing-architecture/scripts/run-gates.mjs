// run-gates — the deterministic gates on one scope, as JSON the skill treats as facts (FR-060).
//
//   node .claude/skills/auditing-architecture/scripts/run-gates.mjs --module <name> [--json]
//   node .claude/skills/auditing-architecture/scripts/run-gates.mjs --dir <path> [--json]
//   node .claude/skills/auditing-architecture/scripts/run-gates.mjs --diff [--json]
//
// Scope → files: a module is src/domain/<name>, src/application/<name> and every file whose path
// contains /<name>/ under src/interface-adapters; a dir is that directory; --diff is every src/
// file changed against origin/main (merge base to working tree). Gates: lint (ESLint on the files),
// arch (dependency-cruiser violations touching the files), shape (scripts/shape-rules.mjs on the
// scope root), duplication, dead-code and language (repo-wide, findings filtered to the files)
// and, with --diff, mutation (scripts/mutation-diff.mjs). Exit 0 always: the skill decides.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @typedef {{ file: string; line?: number; rule: string; message: string; mode?: string }} Finding */
/** @typedef {{ gate: string; mode: string; status: "pass" | "fail"; findings: Finding[]; error?: string }} GateResult */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");
const lib = await import(pathToFileURL(path.join(repoRoot, "scripts", "lib.mjs")).href);
const governance = await import(pathToFileURL(path.join(repoRoot, "scripts", "governance-lib.mjs")).href);
const shape = await import(pathToFileURL(path.join(repoRoot, "scripts", "shape-rules.mjs")).href);
const lintConfig = await import(pathToFileURL(path.join(repoRoot, "eslint.config.mjs")).href);
const { capture } = /** @type {{ capture: (cmd: string, args: string[], options?: object) => { status: number; stdout: string; stderr: string } }} */ (lib);
const { parseArgs, argString } = /** @type {{ parseArgs: (argv: readonly string[]) => Record<string, string | true>; argString: (args: Record<string, string | true>, key: string) => string | undefined }} */ (governance);
const { shapeFindings } = /** @type {{ shapeFindings: (root: string, bundle: string) => Finding[] }} */ (shape);
const { SRC_ONLY_RULES } = /** @type {{ SRC_ONLY_RULES: Record<string, unknown> }} */ (lintConfig);

/**
 * @param {string} dir absolute
 * @returns {string[]} repo-relative posix paths of .ts files
 */
function tsFilesUnder(dir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full));
    else if (name.endsWith(".ts")) out.push(path.relative(repoRoot, full).split(path.sep).join("/"));
  }
  return out;
}

/**
 * The source root the structural gates (arch, shape) run on: the repo's src/, or the scoped
 * directory itself when it is a source tree of its own (an eval fixture with its own src/).
 * @param {string | undefined} dir
 * @returns {string} repo-relative posix path
 */
function sourceRoot(dir) {
  if (dir === undefined) return "src";
  const abs = path.resolve(repoRoot, dir);
  const own = ["domain", "application", "interface-adapters", "infrastructure", "composition"].some((ring) =>
    existsSync(path.join(abs, ring)),
  );
  return own ? path.relative(repoRoot, abs).split(path.sep).join("/") : "src";
}

/**
 * @param {Record<string, string | true>} args
 * @returns {{ scope: string; files: string[]; root: string; diff: boolean }}
 */
function resolveScope(args) {
  const module = argString(args, "module");
  const dir = argString(args, "dir");
  if (module !== undefined) {
    const roots = [path.join(repoRoot, "src", "domain", module), path.join(repoRoot, "src", "application", module)];
    const adapters = tsFilesUnder(path.join(repoRoot, "src", "interface-adapters")).filter((f) => f.includes(`/${module}/`));
    return { scope: `module:${module}`, files: [...roots.flatMap(tsFilesUnder), ...adapters].sort(), root: "src", diff: false };
  }
  if (dir !== undefined) {
    return { scope: `dir:${dir}`, files: tsFilesUnder(path.resolve(repoRoot, dir)), root: sourceRoot(dir), diff: false };
  }
  if (args["diff"] === true) {
    const base = capture("git", ["merge-base", "origin/main", "HEAD"]).stdout.trim() || "origin/main";
    const names = capture("git", ["diff", "--name-only", base, "--", "src"]).stdout.split(/\r?\n/).filter(Boolean);
    return { scope: `diff:${base.slice(0, 12)}...working-tree`, files: names.filter((f) => existsSync(path.join(repoRoot, f))), root: "src", diff: true };
  }
  throw new Error("Give a scope: --module <name>, --dir <path> or --diff");
}

/**
 * @param {string[]} files
 * @param {string} root
 * @returns {GateResult}
 */
function lintGate(files, root) {
  if (files.length === 0) return { gate: "lint", mode: "blocking", status: "pass", findings: [] };
  const eslint = path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
  // The src-only rules match `src/**` of the repo; a fixture with its own src/ gets them by flag.
  const srcOnly =
    root === "src" ? [] : Object.entries(SRC_ONLY_RULES).flatMap(([rule, level]) => ["--rule", JSON.stringify({ [rule]: level })]);
  // Files are explicit: `--no-ignore` lets the eval fixtures (under an ignored folder) be linted.
  const r = capture(process.execPath, [eslint, "--no-ignore", "--format", "json", ...srcOnly, ...files]);
  /** @type {{ filePath: string; messages: { line: number; ruleId: string | null; message: string }[] }[]} */
  let results;
  try {
    results = JSON.parse(r.stdout);
  } catch {
    return { gate: "lint", mode: "blocking", status: "fail", findings: [], error: r.stderr || r.stdout };
  }
  const findings = results.flatMap((f) =>
    f.messages.map((m) => ({
      file: path.relative(repoRoot, f.filePath).split(path.sep).join("/"),
      line: m.line,
      rule: `lint/${m.ruleId ?? "parse"}`,
      message: m.message,
    })),
  );
  return { gate: "lint", mode: "blocking", status: findings.length === 0 ? "pass" : "fail", findings };
}

/**
 * @param {string[]} files
 * @param {string} root
 * @returns {GateResult}
 */
function archGate(files, root) {
  const depcruise = path.join(repoRoot, "node_modules", "dependency-cruiser", "bin", "dependency-cruiser.mjs");
  const r = capture(process.execPath, [depcruise, "--config", ".dependency-cruiser.cjs", "--output-type", "json", root]);
  /** @type {{ summary: { violations: { rule: { name: string }; from: string; to: string }[] } }} */
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    return { gate: "arch", mode: "blocking", status: "fail", findings: [], error: r.stderr || r.stdout };
  }
  const inScope = new Set(files);
  const findings = report.summary.violations
    .filter((v) => inScope.size === 0 || inScope.has(v.from) || inScope.has(v.to))
    .map((v) => ({ file: v.from, rule: `arch/${v.rule.name}`, message: `${v.from} -> ${v.to}` }));
  return { gate: "arch", mode: "blocking", status: findings.length === 0 ? "pass" : "fail", findings };
}

/**
 * @param {string[]} files
 * @param {string} root
 * @returns {GateResult}
 */
function shapeGate(files, root) {
  const bundle = path.join(repoRoot, "contracts", "dist", "openapi.yaml");
  const all = shapeFindings(path.join(repoRoot, root), bundle)
    .map((f) => ({ ...f, file: `${root}/${f.file}` }))
    // A partial tree (an eval fixture) cannot hold every controller of the contract: that rule is for src/.
    .filter((f) => root === "src" || f.rule !== "shape/one-controller-per-operation");
  const inScope = new Set(files);
  const findings = all.filter((f) => inScope.size === 0 || inScope.has(f.file) || f.file.includes("<module>"));
  return { gate: "shape", mode: "blocking", status: findings.length === 0 ? "pass" : "fail", findings };
}

/**
 * A repo-wide script that speaks --json, with its findings narrowed to the scope.
 * @param {string} script
 * @param {string[]} files
 * @param {string[]} [extra]
 * @returns {GateResult}
 */
function scriptGate(script, files, extra = []) {
  const r = capture(process.execPath, [path.join(repoRoot, "scripts", script), "--json", ...extra]);
  try {
    const parsed = /** @type {GateResult} */ (JSON.parse(r.stdout));
    const inScope = new Set(files);
    const findings = parsed.findings.filter((f) => inScope.size === 0 || inScope.has(f.file));
    const blocking = findings.filter((f) => f.mode !== "informative");
    return { ...parsed, findings, status: parsed.error ? "fail" : blocking.length === 0 ? "pass" : "fail" };
  } catch {
    return { gate: script.replace(/\.mjs$/, ""), mode: "blocking", status: "fail", findings: [], error: r.stderr || r.stdout };
  }
}

const args = parseArgs(process.argv.slice(2));
const { scope, files, root, diff } = resolveScope(args);
const gates = [
  lintGate(files, root),
  archGate(files, root),
  shapeGate(files, root),
  scriptGate("check-duplication.mjs", files),
  scriptGate("check-dead-code.mjs", files),
  scriptGate("check-language.mjs", files),
  ...(diff ? [scriptGate("mutation-diff.mjs", files)] : []),
];
const out = { scope, files, gates };
if (args["json"] === true) {
  console.log(JSON.stringify(out));
} else {
  console.log(`scope: ${scope} (${files.length} file(s))`);
  for (const g of gates) {
    console.log(`${g.status === "pass" ? "PASS" : "FAIL"} ${g.gate}${g.error ? ` — ${g.error.split("\n")[0]}` : ""}`);
    for (const f of g.findings) console.log(`  ${f.file}${f.line ? `:${f.line}` : ""}: [${f.rule}] ${f.message}`);
  }
}
