// verify-finding — mechanical verification of audit findings against the project's profile.
//
//   node verify-finding.mjs <findings.json> [--root <repo>]
//
// Input: a JSON array of findings, `{ findings: [...] }` or a single finding, as
// references/formato-hallazgo.md describes (the shape is audit-finding.schema.json, judged by
// hand: the skill depends on nothing but Node). Each one must have the shape, its file and line
// must exist, its `rule.source` must start with a kind the profile declares and resolve by that
// kind's resolver, and its severity must be the one the kind imposes. Output: the same findings
// with `verified` and, when false, `reason`. Exit 1 if any is false; 2 without a usable profile.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadProfile, ProfileError, sourceOf } from "./profile.mjs";

/** @typedef {{ id: string; file: string; line: number; rule: { id: string; source: string }; severity: string; status: string; refutation?: string; closure?: unknown; verified?: boolean; reason?: string }} Finding */
/** @typedef {import("./profile.mjs").Profile} Profile */
/** @typedef {import("./profile.mjs").Source} Source */

const SEVERITIES = ["high", "medium", "low"];
const STATUSES = ["proposed", "confirmed", "refuted"];
const CLOSURES = ["resolved", "absorbed-by", "rejected"];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** @param {unknown} value @returns {value is string} */
const isText = (value) => typeof value === "string" && value !== "";

const KNOWN_FIELDS = [
  "id",
  "file",
  "line",
  "rule",
  "severity",
  "evidence",
  "proposal",
  "coveringTest",
  "status",
  "refutation",
  "closure",
  "verified",
  "reason",
];

/**
 * The shape of audit-finding.schema.json: what is required, closed, enumerated or patterned.
 * @param {unknown} finding
 * @returns {string[]} problems, `<path> <message>` each
 */
export function shapeProblems(finding) {
  if (!isObject(finding)) return ["/ must be an object"];
  return [
    ...Object.keys(finding)
      .filter((key) => !KNOWN_FIELDS.includes(key))
      .map((key) => `/${key} is not a field of a finding`),
    ...identityProblems(finding),
    ...contentProblems(finding),
    ...statusProblems(finding),
  ];
}

/** @param {Record<string, unknown>} finding @returns {string[]} */
function identityProblems(finding) {
  const problems = [];
  if (!isText(finding["id"]) || !/^F-\d{3}$/u.test(finding["id"]))
    problems.push("/id must match ^F-[0-9]{3}$");
  if (!isText(finding["file"]) || finding["file"].includes("\\")) {
    problems.push("/file must be a repo-relative path with forward slashes");
  }
  const line = finding["line"];
  if (!Number.isInteger(line) || /** @type {number} */ (line) < 1)
    problems.push("/line must be an integer >= 1");
  const rule = finding["rule"];
  if (!isObject(rule) || !isText(rule["id"]) || !isText(rule["source"]))
    problems.push("/rule must carry id and source");
  if (!SEVERITIES.includes(String(finding["severity"]))) {
    problems.push(`/severity must be one of ${SEVERITIES.join(", ")}`);
  }
  return problems;
}

/** @param {Record<string, unknown>} finding @returns {string[]} */
function contentProblems(finding) {
  const problems = [];
  const evidence = finding["evidence"];
  if (!isText(evidence) || evidence.length > 2000) {
    problems.push("/evidence must be a non-empty string of at most 2000 characters");
  }
  const proposal = finding["proposal"];
  if (
    !isObject(proposal) ||
    typeof proposal["before"] !== "string" ||
    typeof proposal["after"] !== "string"
  ) {
    problems.push("/proposal must carry before and after");
  }
  if (!isText(finding["coveringTest"])) problems.push("/coveringTest must be a non-empty string");
  return problems;
}

/** @param {Record<string, unknown>} finding @returns {string[]} */
function statusProblems(finding) {
  const problems = [];
  const status = String(finding["status"]);
  if (!STATUSES.includes(status)) problems.push(`/status must be one of ${STATUSES.join(", ")}`);
  if (status === "refuted" && !isText(finding["refutation"])) {
    problems.push("/refutation is required when status is refuted");
  }
  const closure = finding["closure"];
  if (closure !== undefined && !isClosure(closure)) {
    problems.push(`/closure must carry status (${CLOSURES.join(", ")}), by and feature (NNN)`);
  }
  return problems;
}

/** @param {unknown} closure @returns {boolean} */
function isClosure(closure) {
  return (
    isObject(closure) &&
    CLOSURES.includes(String(closure["status"])) &&
    isText(closure["by"]) &&
    /^\d{3}$/u.test(String(closure["feature"]))
  );
}

/**
 * @param {string} file
 * @param {string} needle
 * @returns {boolean}
 */
function headingContains(file, needle) {
  if (!existsSync(file)) return false;
  const wanted = needle.toLowerCase();
  return readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .some((line) => /^#{1,6}\s/u.test(line) && line.toLowerCase().includes(wanted));
}

/**
 * The first path matching a pattern whose segments may carry a wildcard (the ADR file
 * `013-*.md`, the spec directory of feature 013): each wildcard segment takes the first
 * directory entry that matches.
 * @param {string} root
 * @param {string} pattern repo-relative or absolute
 * @returns {string | undefined} absolute path
 */
function firstMatch(root, pattern) {
  const absolute = path.isAbsolute(pattern) ? pattern : path.join(root, pattern);
  const segments = absolute.split(/[\\/]+/u);
  let current = segments[0] === "" ? path.sep : `${segments[0] ?? ""}${path.sep}`;
  for (const segment of segments.slice(1)) {
    if (segment === "") continue;
    if (!segment.includes("*")) {
      current = path.join(current, segment);
      continue;
    }
    if (!existsSync(current)) return undefined;
    const escaped = segment.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
    const regex = new RegExp(`^${escaped.join(".*")}$`, "u");
    const name = readdirSync(current).find((entry) => regex.test(entry));
    if (name === undefined) return undefined;
    current = path.join(current, name);
  }
  return existsSync(current) ? current : undefined;
}

/**
 * Rules a gate lists (`--list-rules`), cached per gate.
 * @type {Map<string, string[] | null>}
 */
const rulesCache = new Map();
/**
 * @param {string} root
 * @param {Profile} profile
 * @param {string} gateId
 * @returns {string[] | null} null when the gate is not declared or does not answer
 */
function rulesOf(root, profile, gateId) {
  const cached = rulesCache.get(gateId);
  if (cached !== undefined) return cached;
  const gate = profile.gates.find((g) => g.id === gateId);
  let rules = null;
  if (gate !== undefined) {
    const r = spawnSync(`${gate.run} --list-rules`, { cwd: root, encoding: "utf8", shell: true });
    try {
      const parsed = /** @type {unknown} */ (JSON.parse(r.stdout));
      const list = isObject(parsed) ? parsed["rules"] : undefined;
      rules = Array.isArray(list) ? list.filter((x) => typeof x === "string") : null;
    } catch {
      rules = null;
    }
  }
  rulesCache.set(gateId, rules);
  return rules;
}

/**
 * Why the rest of a citation does not resolve by its kind, or null when it does.
 * @param {string} root
 * @param {Profile} profile
 * @param {Source} source
 * @param {string} rest the citation without the kind prefix
 * @returns {string | null}
 */
export function resolveRest(root, profile, source, rest) {
  const { resolve } = source;
  switch (resolve.type) {
    case "file-glob":
      return resolveFileGlob(root, resolve.pattern, rest);
    case "markdown-heading":
      return resolveHeading(root, resolve, rest);
    case "text-in-file":
      return resolveTextInFile(root, resolve, rest);
    case "gate-rule":
      return resolveGateRule(root, profile, resolve.gate, rest);
    default:
      return existsSync(path.join(root, profile.criteria))
        ? null
        : `criteria document ${profile.criteria} does not exist`;
  }
}

/** `<id>#<section>` split at the first `#`; the id is empty when there is none. */
function splitCitation(/** @type {string} */ rest) {
  const hash = rest.indexOf("#");
  return hash === -1 ? { id: "", section: rest } : { id: rest.slice(0, hash), section: rest.slice(hash + 1) };
}

/** @param {string} root @param {string} pattern @param {string} id @returns {string | null} */
function resolveFileGlob(root, pattern, id) {
  const resolved = pattern.replaceAll("{id}", id);
  return firstMatch(root, resolved) === undefined ? `${resolved} does not exist` : null;
}

/**
 * @param {string} root
 * @param {{ file: string; dirEnv?: string }} resolve
 * @param {string} rest
 * @returns {string | null}
 */
function resolveHeading(root, resolve, rest) {
  const { id, section } = splitCitation(rest);
  if (resolve.file.includes("{id}") && id === "") return `citation must be <id>#<section>, got ${rest}`;
  let pattern = resolve.file.replaceAll("{id}", id);
  const dirOverride = resolve.dirEnv === undefined ? undefined : process.env[resolve.dirEnv];
  if (dirOverride !== undefined && dirOverride !== "")
    pattern = path.join(dirOverride, path.basename(pattern));
  const file = firstMatch(root, pattern);
  if (file === undefined) return `${pattern} is not readable`;
  return headingContains(file, section) ? null : `no heading of ${path.basename(file)} contains "${section}"`;
}

/**
 * @param {string} root
 * @param {{ file: string; contains: string; refPattern?: string }} resolve
 * @param {string} rest
 * @returns {string | null}
 */
function resolveTextInFile(root, resolve, rest) {
  const { id, section: ref } = splitCitation(rest);
  if (!rest.includes("#")) return `citation must be <id>#<ref>, got ${rest}`;
  if (resolve.refPattern !== undefined && !new RegExp(resolve.refPattern, "u").test(ref)) {
    return `${ref} does not match ${resolve.refPattern}`;
  }
  const pattern = resolve.file.replaceAll("{id}", id);
  const file = firstMatch(root, pattern);
  if (file === undefined) return `${pattern} does not exist`;
  const needle = resolve.contains.replaceAll("{ref}", ref);
  if (readFileSync(file, "utf8").includes(needle)) return null;
  return `${path.relative(root, file).split(path.sep).join("/")} does not declare ${ref}`;
}

/** @param {string} root @param {Profile} profile @param {string} gate @param {string} rule @returns {string | null} */
function resolveGateRule(root, profile, gate, rule) {
  const rules = rulesOf(root, profile, gate);
  if (rules === null) return `gate ${gate} does not list its rules`;
  return rules.includes(rule) ? null : `rule ${rule} is not in gate ${gate}`;
}

/**
 * @param {string} root
 * @param {Finding} finding
 * @returns {string | null}
 */
function verifyLocation(root, finding) {
  const file = path.join(root, finding.file);
  if (!existsSync(file)) return `file ${finding.file} does not exist`;
  const lines = readFileSync(file, "utf8").split(/\r?\n/u).length;
  if (finding.line > lines)
    return `line ${finding.line} is beyond the end of ${finding.file} (${lines} lines)`;
  return null;
}

/**
 * The reasons a citation does not hold: undeclared kind, unresolved rest, wrong severity.
 * @param {string} root
 * @param {Profile} profile
 * @param {Finding} finding
 * @returns {string[]}
 */
function sourceProblems(root, profile, finding) {
  const citation = typeof finding.rule?.source === "string" ? finding.rule.source : undefined;
  if (citation === undefined) return [];
  const source = sourceOf(profile, citation);
  if (source === null) return [`source: kind of "${citation}" not declared in profile`];
  const problems = [];
  const why = resolveRest(root, profile, source, citation.slice(source.kind.length));
  if (why) problems.push(`source: ${why}`);
  if (finding.severity !== source.severity) {
    problems.push(
      `severity: must be ${source.severity} for a ${source.kind} source, got ${String(finding.severity)}`,
    );
  }
  return problems;
}

/**
 * @param {string} root
 * @param {Profile} profile
 * @param {Finding[]} findings
 * @returns {Finding[]}
 */
export function verifyAll(root, profile, findings) {
  return findings.map((finding) => {
    const shape = shapeProblems(finding);
    const located = typeof finding.file === "string" && typeof finding.line === "number";
    const location = located ? verifyLocation(root, finding) : null;
    const reasons = [
      ...(shape.length > 0 ? [`schema: ${shape.join("; ")}`] : []),
      ...(location ? [location] : []),
      ...sourceProblems(root, profile, finding),
    ];
    return reasons.length === 0
      ? { ...finding, verified: true }
      : { ...finding, verified: false, reason: reasons.join(" | ") };
  });
}

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf("--root");
const root = path.resolve(rootFlag !== -1 ? (argv[rootFlag + 1] ?? ".") : process.cwd());
const input = argv.find((a, i) => !a.startsWith("--") && (i === 0 || argv[i - 1] !== "--root"));
if (input !== undefined) {
  try {
    const profile = loadProfile(root);
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path.resolve(input), "utf8")));
    const wrapped = /** @type {{ findings?: Finding[] }} */ (parsed);
    const findings = Array.isArray(parsed)
      ? /** @type {Finding[]} */ (parsed)
      : (wrapped.findings ?? [/** @type {Finding} */ (parsed)]);
    const verified = verifyAll(root, profile, findings);
    console.log(JSON.stringify(verified, null, 2));
    process.exit(verified.every((f) => f.verified) ? 0 : 1);
  } catch (err) {
    if (err instanceof ProfileError) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
}
