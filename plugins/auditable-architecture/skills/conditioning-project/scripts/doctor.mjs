// doctor — is this repository auditable, and how far could an audit go today?
//
//   node doctor.mjs <root> [--json]
//
// Reads audit.profile.json and checks, per gate, that its adapter lists its rules and answers
// findings-v1 on an empty list (ready | degraded); per source kind, that a sample resolution
// finds something (ready | missing); that the criteria document exists and has no PLACEHOLDER
// (ready | degraded | missing). Then the verdict an audit could reach at most: `rejected` only
// with a blocking gate ready or a source of severity high ready; otherwise `changes-required`,
// and it says so. Exit 0 with a report (the report is the diagnosis, not a failure); 2 without
// a usable profile.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProfile, ProfileError } from "../../auditing-architecture/scripts/profile.mjs";

/** @typedef {import("../../auditing-architecture/scripts/profile.mjs").Profile} Profile */
/** @typedef {import("../../auditing-architecture/scripts/profile.mjs").Source} Source */
/** @typedef {{ id: string; mode: string; status: "ready" | "degraded"; reason?: string }} GateHealth */
/** @typedef {{ kind: string; severity: string; status: "ready" | "missing"; reason?: string }} SourceHealth */

/**
 * @param {string} root
 * @param {string} command
 * @returns {{ ok: boolean; stdout: string; stderr: string }}
 */
function sh(root, command) {
  const r = spawnSync(command, { cwd: root, encoding: "utf8", shell: true });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}

/** @param {string} text @returns {Record<string, unknown> | null} */
function json(text) {
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(text));
    return typeof parsed === "object" && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : null;
  } catch {
    return null;
  }
}

/**
 * A gate is ready when its adapter lists rules and answers findings-v1 on an empty scope.
 * @param {string} root
 * @param {Profile["gates"][number]} gate
 * @returns {GateHealth}
 */
function gateHealth(root, gate) {
  const rules = sh(root, `${gate.run} --list-rules`);
  const listed = json(rules.stdout);
  if (!rules.ok || listed === null || !Array.isArray(listed["rules"])) {
    return {
      id: gate.id,
      mode: gate.mode,
      status: "degraded",
      reason: `--list-rules: ${firstLine(rules.stderr || rules.stdout) || "no answer"}`,
    };
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), "audit-doctor-"));
  try {
    const list = path.join(tmp, "files.txt");
    writeFileSync(list, "", "utf8");
    const run = sh(root, `${gate.run} --files-from ${JSON.stringify(list)}`);
    const answered = json(run.stdout);
    if (!run.ok || answered === null || !Array.isArray(answered["findings"])) {
      return {
        id: gate.id,
        mode: gate.mode,
        status: "degraded",
        reason: `--files-from: ${firstLine(run.stderr || run.stdout) || "no answer"}`,
      };
    }
    return { id: gate.id, mode: gate.mode, status: "ready" };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** @param {string} text */
const firstLine = (text) => text.split(/\r?\n/u).find((l) => l.trim() !== "") ?? "";

/**
 * Whether a path pattern with `{id}` (or a directory) has at least one match.
 * @param {string} root
 * @param {string} pattern
 * @returns {boolean}
 */
function anyMatch(root, pattern) {
  const wild = pattern.replaceAll("{id}", "*");
  const segments = wild.split(/[\\/]+/u);
  /** @type {string[]} */
  let current = [path.isAbsolute(wild) ? path.parse(wild).root : root];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      current = current.map((c) => path.dirname(c));
      continue;
    }
    const regex = new RegExp(
      `^${segment
        .split("*")
        .map((p) => p.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join(".*")}$`,
      "u",
    );
    current = current.flatMap((c) =>
      existsSync(c)
        ? readdirSync(c)
            .filter((e) => regex.test(e))
            .map((e) => path.join(c, e))
        : [],
    );
    if (current.length === 0) return false;
  }
  return current.length > 0;
}

/**
 * A source kind is ready when a sample resolution finds something.
 * @param {string} root
 * @param {Profile} profile
 * @param {Source} source
 * @param {GateHealth[]} gates
 * @returns {SourceHealth}
 */
function sourceHealth(root, profile, source, gates) {
  const { resolve } = source;
  const base = { kind: source.kind, severity: source.severity };
  switch (resolve.type) {
    case "file-glob":
      return anyMatch(root, resolve.pattern)
        ? { ...base, status: "ready" }
        : { ...base, status: "missing", reason: `nothing matches ${resolve.pattern}` };
    case "markdown-heading":
    case "text-in-file": {
      const override =
        resolve.type === "markdown-heading" && resolve.dirEnv !== undefined
          ? process.env[resolve.dirEnv]
          : undefined;
      const pattern =
        override !== undefined && override !== ""
          ? path.join(override, path.basename(resolve.file))
          : resolve.file;
      return anyMatch(root, pattern)
        ? { ...base, status: "ready" }
        : { ...base, status: "missing", reason: `${pattern} is not readable` };
    }
    case "gate-rule": {
      const gate = gates.find((g) => g.id === resolve.gate);
      return gate?.status === "ready"
        ? { ...base, status: "ready" }
        : { ...base, status: "missing", reason: `gate ${resolve.gate} is not ready` };
    }
    default:
      return existsSync(path.join(root, profile.criteria))
        ? { ...base, status: "ready" }
        : { ...base, status: "missing", reason: `${profile.criteria} does not exist` };
  }
}

/**
 * @param {string} root
 * @param {Profile} profile
 * @returns {{ status: "ready" | "degraded" | "missing"; placeholders: number }}
 */
function criteriaHealth(root, profile) {
  const file = path.join(root, profile.criteria);
  if (!existsSync(file)) return { status: "missing", placeholders: 0 };
  const placeholders = (readFileSync(file, "utf8").match(/PLACEHOLDER/gu) ?? []).length;
  return { status: placeholders === 0 ? "ready" : "degraded", placeholders };
}

/**
 * @param {string} root
 * @param {Profile} profile
 * @returns {{ gates: GateHealth[]; sources: SourceHealth[]; criteria: { status: string; placeholders: number }; maxVerdict: "rejected" | "changes-required" }}
 */
export function diagnose(root, profile) {
  const gates = profile.gates.map((g) => gateHealth(root, g));
  const sources = profile.sources.map((s) => sourceHealth(root, profile, s, gates));
  const criteria = criteriaHealth(root, profile);
  const canReject =
    gates.some((g) => g.mode === "blocking" && g.status === "ready") ||
    sources.some((s) => s.severity === "high" && s.status === "ready");
  return { gates, sources, criteria, maxVerdict: canReject ? "rejected" : "changes-required" };
}

const argv = process.argv.slice(2);
const root = path.resolve(argv.find((a) => !a.startsWith("--")) ?? ".");
try {
  const profile = loadProfile(root);
  const report = diagnose(root, profile);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("gates:");
    for (const g of report.gates)
      console.log(`  ${g.status.padEnd(8)} ${g.id} [${g.mode}]${g.reason ? ` — ${g.reason}` : ""}`);
    console.log("sources:");
    for (const s of report.sources)
      console.log(`  ${s.status.padEnd(8)} ${s.kind} [${s.severity}]${s.reason ? ` — ${s.reason}` : ""}`);
    console.log(
      `criteria: ${report.criteria.status}${report.criteria.placeholders > 0 ? ` (${report.criteria.placeholders} PLACEHOLDER)` : ""}`,
    );
    console.log(
      `max verdict: ${report.maxVerdict}${report.maxVerdict === "changes-required" ? " — no blocking gate nor high source is ready: an audit cannot reject anything yet" : ""}`,
    );
  }
} catch (err) {
  if (err instanceof ProfileError) {
    console.error(err.message);
    process.exit(2);
  }
  throw err;
}
