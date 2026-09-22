// run-gates — the deterministic gates of the project on one scope, as JSON the skill treats as
// facts. Everything about the project comes from audit.profile.json (profile.mjs): how a scope
// resolves to files and which adapters emit findings (protocol findings-v1: `--files-from
// <file>` in, `{ findings: [{ file, line, rule, message }] }` out; exit ≠ 0 = degraded).
//
//   node run-gates.mjs --module <name> [--json] [--root <repo>]
//   node run-gates.mjs --dir <path> [--json] [--root <repo>]
//   node run-gates.mjs --diff [--json] [--root <repo>]
//
// Exit 0 always once the profile loads: the skill decides. Without a profile, or with one of a
// version this skill does not understand, it says so and exits 2.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProfile, ProfileError } from "./profile.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */
/** @typedef {{ gate: string; mode: string; status: "pass" | "fail" | "degraded"; findings: Finding[]; reason?: string }} GateResult */
/** @typedef {import("./profile.mjs").Profile} Profile */
/** @typedef {import("./profile.mjs").Gate} Gate */

/**
 * `--key value` and `--flag` pairs.
 * @param {readonly string[]} argv
 * @returns {Record<string, string | true>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[arg.slice(2)] = next;
      i += 1;
    } else out[arg.slice(2)] = true;
  }
  return out;
}

/** @param {string} p */
const posix = (p) => p.split(path.sep).join("/");

/**
 * @param {string} root absolute repository root
 * @param {string} dir absolute
 * @returns {string[]} repo-relative posix paths of the source files under dir
 */
function filesUnder(root, dir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(root, full));
    else if (!/\.(md|json|ya?ml)$/u.test(name)) out.push(posix(path.relative(root, full)));
  }
  return out;
}

/**
 * @param {string} root
 * @param {string[]} args
 * @returns {string}
 */
function git(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout : "";
}

/**
 * Scope → files, by the profile.
 * @param {string} root
 * @param {Profile} profile
 * @param {Record<string, string | true>} args
 * @returns {{ scope: string; kind: "module" | "dir" | "diff"; files: string[] }}
 */
export function resolveScope(root, profile, args) {
  const module = args["module"];
  const dir = args["dir"];
  if (typeof module === "string") {
    const roots = profile.scopes.module.roots.map((t) => path.join(root, t.replaceAll("{name}", module)));
    return {
      scope: `module:${module}`,
      kind: "module",
      files: roots.flatMap((r) => filesUnder(root, r)).sort(),
    };
  }
  if (typeof dir === "string") {
    return {
      scope: `dir:${posix(dir)}`,
      kind: "dir",
      files: filesUnder(root, path.resolve(root, dir)).sort(),
    };
  }
  if (args["diff"] === true) {
    const { base, include } = profile.scopes.diff;
    const mergeBase = git(root, ["merge-base", base, "HEAD"]).trim() || base;
    const changed = git(root, ["diff", "--name-only", mergeBase]).split(/\r?\n/u);
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/u);
    const files = [...new Set([...changed, ...untracked])]
      .filter((f) => f !== "" && include.some((prefix) => f.startsWith(prefix)))
      .filter((f) => existsSync(path.join(root, f)))
      .sort();
    return { scope: `diff:${mergeBase.slice(0, 12)}...working-tree`, kind: "diff", files };
  }
  throw new Error("Give a scope: --module <name>, --dir <path> or --diff");
}

/**
 * Runs one adapter on the files (protocol findings-v1).
 * @param {string} root
 * @param {Gate} gate
 * @param {string[]} files
 * @param {string} listFile the temp file with one path per line
 * @returns {GateResult}
 */
export function runGate(root, gate, files, listFile) {
  writeFileSync(listFile, files.join("\n"), "utf8");
  // `run` is a command line: the shell parses it, and the list file is appended quoted.
  const r = spawnSync(`${gate.run} --files-from ${JSON.stringify(listFile)}`, {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  const degraded = (/** @type {string} */ reason) => ({
    gate: gate.id,
    mode: gate.mode,
    status: /** @type {const} */ ("degraded"),
    findings: [],
    reason: reason.split(/\r?\n/u).find((l) => l.trim() !== "") ?? "no output",
  });
  if (r.status !== 0) return degraded(r.stderr || r.stdout || `exit ${String(r.status)}`);
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    return degraded(`not findings-v1 JSON: ${r.stdout.slice(0, 120)}`);
  }
  const raw = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "findings") : undefined;
  if (!Array.isArray(raw)) return degraded("not findings-v1: no findings list");
  const findings = raw.flatMap((f) => {
    const file = Reflect.get(f, "file");
    const line = Reflect.get(f, "line");
    const rule = Reflect.get(f, "rule");
    const message = Reflect.get(f, "message");
    if (typeof file !== "string" || typeof line !== "number" || typeof rule !== "string") return [];
    return [{ file, line, rule, message: typeof message === "string" ? message : "" }];
  });
  if (findings.length === 0 && raw.length > 0) return degraded("every finding lacks file or line");
  return { gate: gate.id, mode: gate.mode, status: findings.length === 0 ? "pass" : "fail", findings };
}

/**
 * Every gate of the profile that applies to the scope.
 * @param {string} root
 * @param {Profile} profile
 * @param {"module" | "dir" | "diff"} kind
 * @param {string[]} files
 * @returns {GateResult[]}
 */
export function runGates(root, profile, kind, files) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "audit-gates-"));
  try {
    return profile.gates
      .filter((gate) => gate.scopes === undefined || gate.scopes.includes(kind))
      .map((gate) => runGate(root, gate, files, path.join(tmp, `${gate.id}.txt`)));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * @param {string} scope
 * @param {string[]} files
 * @param {GateResult[]} gates
 */
function report(scope, files, gates) {
  console.log(`scope: ${scope} (${files.length} file(s))`);
  for (const g of gates) {
    const label = g.status === "pass" ? "PASS" : g.status === "fail" ? "FAIL" : "DEGRADED";
    console.log(`${label} ${g.gate} [${g.mode}]${g.reason ? ` — ${g.reason}` : ""}`);
    for (const f of g.findings) console.log(`  ${f.file}:${f.line}: [${f.rule}] ${f.message}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(typeof args["root"] === "string" ? args["root"] : process.cwd());
try {
  const profile = loadProfile(root);
  const { scope, kind, files } = resolveScope(root, profile, args);
  const gates = runGates(root, profile, kind, files);
  if (args["json"] === true) console.log(JSON.stringify({ scope, files, gates }));
  else report(scope, files, gates);
} catch (err) {
  if (err instanceof ProfileError) {
    console.error(err.message);
    process.exit(2);
  }
  throw err;
}
