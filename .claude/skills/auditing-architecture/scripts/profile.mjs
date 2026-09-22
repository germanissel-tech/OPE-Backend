// The audit profile (audit.profile.json at the root of the project): the only thing the skill
// knows about the project it audits. Loaded, checked against the shape of
// audit-profile.schema.json (by hand: the skill depends on nothing but Node) and refused when
// its version is not the one this skill understands. Shared by run-gates and verify-finding.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const PROFILE_FILE = "audit.profile.json";
/** The profile versions this skill understands. */
export const SUPPORTED_VERSIONS = [1];
const MODES = ["blocking", "informative"];
const SCOPES = ["module", "dir", "diff"];
const SEVERITIES = ["high", "medium", "low"];
const RESOLVERS = ["file-glob", "markdown-heading", "text-in-file", "gate-rule", "criteria-section"];

/**
 * @typedef {{ id: string; mode: "blocking" | "informative"; scopes?: string[]; run: string; format: "findings-v1" }} Gate
 * @typedef {{ type: "file-glob"; pattern: string } | { type: "markdown-heading"; file: string; dirEnv?: string } | { type: "text-in-file"; file: string; contains: string; refPattern?: string } | { type: "gate-rule"; gate: string } | { type: "criteria-section" }} Resolver
 * @typedef {{ kind: string; severity: "high" | "medium" | "low"; resolve: Resolver }} Source
 * @typedef {{ profileVersion: number; sourceRoot: string; scopes: { module: { roots: string[] }; diff: { base: string; include: string[] } }; gates: Gate[]; sources: Source[]; criteria: string; evals: string }} Profile
 */

/** Raised when the profile is missing, unreadable, of another version or malformed. */
export class ProfileError extends Error {}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** @param {unknown} value @returns {value is string[]} */
const isStringList = (value) => Array.isArray(value) && value.every((v) => typeof v === "string");
/** @param {unknown} value @returns {value is string} */
const isText = (value) => typeof value === "string" && value !== "";

/**
 * Reads the profile of a project.
 * @param {string} root absolute path of the repository
 * @returns {Profile}
 */
export function loadProfile(root) {
  const file = path.join(root, PROFILE_FILE);
  if (!existsSync(file)) {
    throw new ProfileError(`no ${PROFILE_FILE} in ${root}: run the conditioning-project skill to create one`);
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new ProfileError(
      `${PROFILE_FILE} is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  return checkProfile(parsed);
}

/**
 * The shape of audit-profile.schema.json, judged by hand; the version first.
 * @param {unknown} parsed
 * @returns {Profile}
 */
export function checkProfile(parsed) {
  if (!isObject(parsed)) throw new ProfileError(`${PROFILE_FILE}: not an object`);
  const version = parsed["profileVersion"];
  if (typeof version !== "number" || !SUPPORTED_VERSIONS.includes(version)) {
    throw new ProfileError(
      `profile version ${String(version)} not supported (this skill understands ${SUPPORTED_VERSIONS.join(", ")})`,
    );
  }
  const sourceRoot = parsed["sourceRoot"];
  if (!isText(sourceRoot)) throw new ProfileError(`${PROFILE_FILE}: sourceRoot must be a non-empty string`);
  const scopes = checkScopes(parsed["scopes"]);
  const gates = checkGates(parsed["gates"]);
  const sources = checkSources(parsed["sources"]);
  const criteria = parsed["criteria"];
  const evals = parsed["evals"];
  if (!isText(criteria)) throw new ProfileError(`${PROFILE_FILE}: criteria must be a path`);
  if (!isText(evals)) throw new ProfileError(`${PROFILE_FILE}: evals must be a path`);
  return { profileVersion: version, sourceRoot, scopes, gates, sources, criteria, evals };
}

/** @param {unknown} raw @returns {Profile["scopes"]} */
function checkScopes(raw) {
  const module = isObject(raw) ? raw["module"] : undefined;
  const diff = isObject(raw) ? raw["diff"] : undefined;
  const roots = isObject(module) ? module["roots"] : undefined;
  if (!isStringList(roots) || roots.length === 0 || !roots.every((r) => r.includes("{name}"))) {
    throw new ProfileError(`${PROFILE_FILE}: scopes.module.roots must be templates with {name}`);
  }
  const base = isObject(diff) ? diff["base"] : undefined;
  const include = isObject(diff) ? diff["include"] : undefined;
  if (!isText(base) || !isStringList(include) || include.length === 0) {
    throw new ProfileError(`${PROFILE_FILE}: scopes.diff needs base and include`);
  }
  return { module: { roots }, diff: { base, include } };
}

/** @param {unknown} raw @returns {Gate[]} */
function checkGates(raw) {
  if (!Array.isArray(raw)) throw new ProfileError(`${PROFILE_FILE}: gates must be a list`);
  return raw.map((gate, i) => {
    const where = `${PROFILE_FILE}: gates[${i}]`;
    if (!isObject(gate)) throw new ProfileError(`${where}: not an object`);
    const id = gate["id"];
    const mode = gate["mode"];
    const run = gate["run"];
    const format = gate["format"];
    const scopes = gate["scopes"];
    if (!isText(id) || !/^[a-z][a-z0-9-]*$/u.test(id))
      throw new ProfileError(`${where}.id: a lowercase slug`);
    if (typeof mode !== "string" || !MODES.includes(mode))
      throw new ProfileError(`${where}.mode: ${MODES.join(" | ")}`);
    if (!isText(run)) throw new ProfileError(`${where}.run: the adapter's command line`);
    if (format !== "findings-v1") throw new ProfileError(`${where}.format: findings-v1`);
    if (scopes !== undefined && (!isStringList(scopes) || !scopes.every((s) => SCOPES.includes(s)))) {
      throw new ProfileError(`${where}.scopes: a list of ${SCOPES.join(" | ")}`);
    }
    return {
      id,
      mode: /** @type {Gate["mode"]} */ (mode),
      run,
      format: /** @type {const} */ ("findings-v1"),
      ...(scopes === undefined ? {} : { scopes }),
    };
  });
}

/** @param {unknown} raw @returns {Source[]} */
function checkSources(raw) {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new ProfileError(`${PROFILE_FILE}: sources must be a non-empty list`);
  return raw.map((source, i) => {
    const where = `${PROFILE_FILE}: sources[${i}]`;
    if (!isObject(source)) throw new ProfileError(`${where}: not an object`);
    const kind = source["kind"];
    const severity = source["severity"];
    const resolve = source["resolve"];
    if (!isText(kind) || kind.length < 2)
      throw new ProfileError(`${where}.kind: a prefix of at least two characters`);
    if (typeof severity !== "string" || !SEVERITIES.includes(severity)) {
      throw new ProfileError(`${where}.severity: ${SEVERITIES.join(" | ")}`);
    }
    return {
      kind,
      severity: /** @type {Source["severity"]} */ (severity),
      resolve: checkResolver(resolve, where),
    };
  });
}

/** @param {unknown} raw @param {string} where @returns {Resolver} */
function checkResolver(raw, where) {
  const type = isObject(raw) ? raw["type"] : undefined;
  if (!isObject(raw) || typeof type !== "string" || !RESOLVERS.includes(type)) {
    throw new ProfileError(`${where}.resolve.type: ${RESOLVERS.join(" | ")}`);
  }
  const text = (/** @type {string} */ key) => {
    const value = raw[key];
    if (!isText(value)) throw new ProfileError(`${where}.resolve.${key}: required for ${type}`);
    return value;
  };
  const optional = (/** @type {string} */ key) => (isText(raw[key]) ? { [key]: raw[key] } : {});
  switch (type) {
    case "file-glob":
      return { type, pattern: text("pattern") };
    case "markdown-heading":
      return { type, file: text("file"), ...optional("dirEnv") };
    case "text-in-file":
      return { type, file: text("file"), contains: text("contains"), ...optional("refPattern") };
    case "gate-rule":
      return { type, gate: text("gate") };
    default:
      return { type: "criteria-section" };
  }
}

/**
 * The source kind a citation belongs to (the longest declared prefix that matches), or null.
 * @param {Profile} profile
 * @param {string} citation `rule.source` of a finding
 * @returns {Source | null}
 */
export function sourceOf(profile, citation) {
  const matching = profile.sources.filter((s) => citation.startsWith(s.kind));
  matching.sort((a, b) => b.kind.length - a.kind.length);
  return matching[0] ?? null;
}
