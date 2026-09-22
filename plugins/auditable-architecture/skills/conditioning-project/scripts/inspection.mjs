// What the conditioning skill can detect of a repository by presence, never by assumption:
// sources of truth (a spec-kit constitution, ADRs, an agent guide, feature specs), quality
// tools (by their config file or their entry in package.json), the gate adapters already
// written (scripts/audit/gate-*.mjs), the organisation of the source root (rings that share
// module names) and the git base of a diff. Shared by inspect, write-profile and doctor.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** @typedef {{ found: boolean; path?: string }} Presence */
/** @typedef {{ found: boolean; path?: string; gate: string; adapter?: string }} ToolPresence */
/** @typedef {{ key: string; question: string; options: string[]; suggested: string }} Question */
/** @typedef {{ sources: Record<string, Presence>; tools: Record<string, ToolPresence>; adapters: string[]; modules: { roots: string[] } | null; sourceRoot: string; diffBase: string | null; existingProfile: Record<string, unknown> | null; questions: Question[] }} Inspection */

const ADAPTERS_DIR = "scripts/audit";
const PROFILE_FILE = "audit.profile.json";

/** Sources of truth, by the file or directory that proves them. */
const SOURCE_FILES = /** @type {const} */ ({
  constitution: [".specify/memory/constitution.md"],
  adr: ["docs/adr", "docs/decisions", "adr"],
  guide: ["CLAUDE.md", "AGENTS.md"],
  specs: ["specs"],
});

/** Quality tools, by config file or package.json entry, and the conventional gate each one backs. */
const TOOLS = /** @type {const} */ ([
  {
    id: "eslint",
    gate: "lint",
    files: [
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
      ".eslintrc",
      ".eslintrc.json",
      ".eslintrc.cjs",
    ],
    packageKeys: ["eslint"],
  },
  {
    id: "dependency-cruiser",
    gate: "arch",
    files: [
      ".dependency-cruiser.cjs",
      ".dependency-cruiser.js",
      ".dependency-cruiser.mjs",
      ".dependency-cruiser.json",
    ],
    packageKeys: ["dependency-cruiser"],
  },
  { id: "jscpd", gate: "duplication", files: [".jscpd.json"], packageKeys: ["jscpd"] },
  { id: "knip", gate: "dead-code", files: ["knip.json", "knip.ts", "knip.jsonc"], packageKeys: ["knip"] },
  {
    id: "stryker",
    gate: "mutation",
    files: ["stryker.config.json", "stryker.config.mjs", "stryker.config.js", "stryker.conf.json"],
    packageKeys: ["@stryker-mutator/core"],
  },
  { id: "ruff", gate: "lint", files: ["ruff.toml", ".ruff.toml"], packageKeys: [] },
  { id: "golangci-lint", gate: "lint", files: [".golangci.yml", ".golangci.yaml"], packageKeys: [] },
]);

/** @param {string} root @param {string} rel */
const has = (root, rel) => existsSync(path.join(root, rel));

/** @param {string} root @returns {Record<string, Presence>} */
export function detectSources(root) {
  /** @type {Record<string, Presence>} */
  const out = {};
  for (const [kind, candidates] of Object.entries(SOURCE_FILES)) {
    const found = candidates.find((c) => has(root, c));
    out[kind] = found === undefined ? { found: false } : { found: true, path: found };
  }
  return out;
}

/** The dependency names of package.json (all sections), or none. */
function packageDependencies(/** @type {string} */ root) {
  const file = path.join(root, "package.json");
  if (!existsSync(file)) return new Set();
  try {
    const pkg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(file, "utf8")));
    const names = ["dependencies", "devDependencies", "optionalDependencies"].flatMap((section) => {
      const deps = pkg[section];
      return typeof deps === "object" && deps !== null ? Object.keys(deps) : [];
    });
    return new Set(names);
  } catch {
    return new Set();
  }
}

/** The gate adapters already present (scripts/audit/gate-<id>.mjs), by gate id. */
export function detectAdapters(/** @type {string} */ root) {
  const dir = path.join(root, ADAPTERS_DIR);
  if (!existsSync(dir)) return /** @type {string[]} */ ([]);
  return readdirSync(dir)
    .filter((f) => /^gate-[a-z0-9-]+\.mjs$/u.test(f))
    .map((f) => f.slice("gate-".length, -".mjs".length))
    .sort();
}

/** @param {string} root @returns {Record<string, ToolPresence>} */
export function detectTools(root) {
  const deps = packageDependencies(root);
  const adapters = detectAdapters(root);
  /** @type {Record<string, ToolPresence>} */
  const out = {};
  for (const tool of TOOLS) {
    const file = tool.files.find((f) => has(root, f));
    const found = file !== undefined || tool.packageKeys.some((k) => deps.has(k));
    const adapter = adapters.includes(tool.gate) ? `${ADAPTERS_DIR}/gate-${tool.gate}.mjs` : undefined;
    out[tool.id] = {
      found,
      gate: tool.gate,
      ...(file === undefined ? {} : { path: file }),
      ...(adapter === undefined ? {} : { adapter }),
    };
  }
  return out;
}

/**
 * The source root: `src` when it exists, else the first of the usual names, else null.
 * @param {string} root
 * @returns {string | null}
 */
export function detectSourceRoot(root) {
  return (
    ["src", "lib", "app", "packages"].find(
      (d) => has(root, d) && statSync(path.join(root, d)).isDirectory(),
    ) ?? null
  );
}

/**
 * Rings that share module names: a module is a directory name that appears under at least
 * two first-level directories of the source root; a ring is a first-level directory holding at
 * least two modules. Ordered from the inside out when the rings carry the usual names
 * (domain, application, adapters, infrastructure), else by how many modules each one holds.
 * @param {string} root
 * @param {string | null} sourceRoot
 * @returns {{ roots: string[] } | null}
 */
export function detectModules(root, sourceRoot) {
  if (sourceRoot === null) return null;
  const base = path.join(root, sourceRoot);
  const dirs = readdirSync(base).filter((d) => statSync(path.join(base, d)).isDirectory());
  /** @type {Map<string, Set<string>>} */
  const children = new Map(
    dirs.map((d) => [
      d,
      new Set(readdirSync(path.join(base, d)).filter((c) => statSync(path.join(base, d, c)).isDirectory())),
    ]),
  );
  /** @type {Map<string, number>} */
  const seen = new Map();
  for (const set of children.values()) for (const name of set) seen.set(name, (seen.get(name) ?? 0) + 1);
  const modules = new Set([...seen].filter(([, n]) => n >= 2).map(([name]) => name));
  const rings = dirs
    .map((d) => ({ dir: d, count: [...(children.get(d) ?? [])].filter((c) => modules.has(c)).length }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => ringRank(a.dir) - ringRank(b.dir) || b.count - a.count || a.dir.localeCompare(b.dir));
  return rings.length === 0 ? null : { roots: rings.map((r) => `${sourceRoot}/${r.dir}/{name}`) };
}

/** The usual ring names, from the inside out; anything else after them. */
const RING_ORDER = [
  "domain",
  "application",
  "interface-adapters",
  "adapters",
  "presentation",
  "infrastructure",
  "composition",
];
const ringRank = (/** @type {string} */ dir) => {
  const index = RING_ORDER.indexOf(dir);
  return index === -1 ? RING_ORDER.length : index;
};

/** The default branch of the remote (`origin/main`), or null without a remote. */
export function detectDiffBase(/** @type {string} */ root) {
  const git = (/** @type {string[]} */ args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : "";
  };
  const head = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (head !== "") return head;
  for (const candidate of ["origin/main", "origin/master"]) {
    if (git(["rev-parse", "--verify", "--quiet", candidate]) !== "") return candidate;
  }
  return null;
}

/** The existing profile, parsed, or null. */
export function existingProfile(/** @type {string} */ root) {
  const file = path.join(root, PROFILE_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(file, "utf8")));
    return typeof parsed === "object" && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : null;
  } catch {
    return null;
  }
}

/**
 * The full inspection with the questions only the owner can answer: what was detected is not
 * asked; what an existing profile already answers is not asked either.
 * @param {string} root
 * @returns {Inspection}
 */
export function inspect(root) {
  const sources = detectSources(root);
  const tools = detectTools(root);
  const adapters = detectAdapters(root);
  const sourceRoot = detectSourceRoot(root) ?? "src";
  const modules = detectModules(root, detectSourceRoot(root));
  const diffBase = detectDiffBase(root);
  const profile = existingProfile(root);
  /** @type {Question[]} */
  const questions = [];
  if (modules === null && profile === null) {
    questions.push({
      key: "moduleRoots",
      question: "How does a module resolve to directories? Templates with {name}.",
      options: [
        `${sourceRoot}/{name}`,
        `${sourceRoot}/modules/{name}`,
        `${sourceRoot}/domain/{name},${sourceRoot}/application/{name}`,
      ],
      suggested: `${sourceRoot}/{name}`,
    });
  }
  if (profile === null) {
    const detected = Object.values(tools)
      .filter((t) => t.found && t.adapter !== undefined)
      .map((t) => t.gate);
    const gates = [...new Set([...detected, ...adapters])].sort();
    questions.push({
      key: "blockingGates",
      question: "Which gates block the verdict (a blocking gate in fail decides rejected)?",
      options: gates.length === 0 ? ["none"] : ["all", "none", ...gates],
      suggested: gates.length === 0 ? "none" : "all",
    });
  }
  if (diffBase === null && profile === null) {
    questions.push({
      key: "diffBase",
      question: "Which git reference does --diff compare against?",
      options: ["origin/main", "origin/master", "main"],
      suggested: "origin/main",
    });
  }
  return { sources, tools, adapters, modules, sourceRoot, diffBase, existingProfile: profile, questions };
}
