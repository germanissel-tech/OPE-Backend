// check:identifiers — every identifier the governance documents cite between backticks exists
// with that exact name in the contract, its catalogues or the source (feature 016, R-06;
// constitution, data-contract section: the code and the contract are English).
//
//   node scripts/check-identifiers.mjs [--docs <dir,dir>] [--constitution <file>] [--bundle <file>]
//       [--instructions <file>] [--rules <dir>]
//       [--catalogs <file,file>] [--src <dir>] [--tooling <path,path>] [--allowlist <file>]
//
// A span counts as an identifier by its shape: snake_case or kebab-case with at least one
// separator, camelCase, or SCREAMING_CASE. Single words, paths, commands, dotted names, flags
// and anything with spaces or punctuation are prose and are not judged. Fenced code blocks are
// skipped, and a glossary note may cite its own `en` term. An identifier exists if it is a
// token of the bundle, a catalogue, a source file or the tooling of the repo (lint, contract
// rules, scripts, CI: the ADRs name their rules), or the name of a skill, which is its directory
// under .claude/skills/. The allowlist names the citations that are
// not identifiers of the system (markers, states, names of a replaced version) and every entry
// needs a reason.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  argString,
  exists,
  isRecord,
  parseArgs,
  parseFrontmatter,
  prop,
  rel,
  walkFiles,
} from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const SNAKE_OR_KEBAB = /^[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)+$/;
const CAMEL = /^[a-z]+(?:[A-Z][a-z0-9]*)+$/;
const SCREAMING = /^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const PROSE_CHARS = /[/. (:<$#@]/;
const SPAN = /`([^`]+)`/g;
const FENCE = /^\s*(```|~~~)/;

const args = parseArgs(process.argv.slice(2));
const root = repoRoot;
const docsDirs = (argString(args, "docs") ?? "docs/adr,docs/dominio")
  .split(",")
  .map((d) => path.resolve(root, d.trim()));
const constitution = path.resolve(
  argString(args, "constitution") ?? path.join(root, ".specify", "memory", "constitution.md"),
);
const bundle = path.resolve(argString(args, "bundle") ?? bundlePath);
const catalogs = (
  argString(args, "catalogs") ??
  "contracts/problem-types.yaml,contracts/no-op-reasons.yaml,contracts/api-map.yaml"
)
  .split(",")
  .map((f) => path.resolve(root, f.trim()));
const srcDir = path.resolve(argString(args, "src") ?? path.join(root, "src"));
const TOOLING_EXTENSIONS = [
  ".mjs",
  ".cjs",
  ".js",
  ".ts",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".gitattributes",
];
const DEFAULT_TOOLING = [
  "package.json",
  "tsconfig.json",
  "tsconfig.typecheck.json",
  "tsconfig.scripts.json",
  "tsconfig.lint-fixtures.json",
  "tsconfig.client.json",
  ".gitattributes",
  "client",
  "generated",
  "eslint.config.mjs",
  "redocly.yaml",
  "lefthook.yml",
  ".dependency-cruiser.cjs",
  "knip.json",
  "stryker.config.json",
  "schemathesis.toml",
  "vitest.config.ts",
  "vitest.mutation.config.ts",
  "contracts/.spectral.yaml",
  "contracts/rules",
  "scripts",
  ".github",
  ".claude/skills",
  "audit.profile.json",
].join(",");
const tooling = (argString(args, "tooling") ?? DEFAULT_TOOLING)
  .split(",")
  .map((f) => path.resolve(root, f.trim()))
  .flatMap((f) => (isDirectory(f) ? walkFiles(f, TOOLING_EXTENSIONS) : [f]));
const allowlistFile = path.resolve(
  argString(args, "allowlist") ?? path.join(root, "scripts", "identifiers-allowlist.json"),
);

/**
 * @param {string} file
 * @returns {boolean}
 */
function isDirectory(file) {
  try {
    return statSync(file).isDirectory();
  } catch {
    return false;
  }
}

/**
 * A skill's name is its directory under .claude/skills/, and only its SKILL.md frontmatter
 * repeats it. Walking prose for it would let any word in any skill vouch for any citation, so
 * the directory listing is the source: a skill that exists is a name that exists.
 * @param {string} dir
 * @returns {string[]}
 */
function skillNames(dir) {
  return isDirectory(dir) ? readdirSync(dir).filter((name) => exists(path.join(dir, name, "SKILL.md"))) : [];
}

/**
 * Whether a backtick span has the shape of an identifier of the system.
 * @param {string} span
 * @returns {boolean}
 */
function isIdentifier(span) {
  if (PROSE_CHARS.test(span) || span.startsWith("--") || /^\d/.test(span)) return false;
  return SNAKE_OR_KEBAB.test(span) || CAMEL.test(span) || SCREAMING.test(span);
}

/**
 * The identifiers a markdown cites, with their line, skipping fenced code blocks and the
 * `en` term the note itself defines.
 * @param {string} markdown
 * @returns {{ line: number; identifier: string }[]}
 */
function citedIdentifiers(markdown) {
  /** @type {{ line: number; identifier: string }[]} */
  const out = [];
  const own = prop(parseFrontmatter(markdown).data, "en");
  let fenced = false;
  markdown.split(/\r?\n/).forEach((text, i) => {
    if (FENCE.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    for (const m of text.matchAll(SPAN)) {
      const span = m[1] ?? "";
      if (span !== own && isIdentifier(span)) out.push({ line: i + 1, identifier: span });
    }
  });
  return out;
}

/**
 * The allowlist: identifiers with a reason. An entry without one is a problem of its own.
 * @param {string} file
 * @returns {{ allowed: Set<string>; problems: string[] }}
 */
function readAllowlist(file) {
  const allowed = new Set();
  /** @type {string[]} */
  const problems = [];
  if (!exists(file)) return { allowed, problems };
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(file, "utf8")));
  if (!Array.isArray(parsed)) return { allowed, problems: [`${file}: the allowlist is not an array`] };
  parsed.forEach((entry, i) => {
    const identifier = prop(entry, "identifier");
    const reason = prop(entry, "reason");
    if (!isRecord(entry) || typeof identifier !== "string") {
      problems.push(`${file}: entry ${i} has no "identifier"`);
      return;
    }
    if (typeof reason !== "string" || reason.trim() === "") {
      problems.push(`${file}: "${identifier}" is allowlisted without a reason`);
      return;
    }
    allowed.add(identifier);
  });
  return { allowed, problems };
}

/** @type {string[]} */
const sources = [bundle, ...catalogs, ...walkFiles(srcDir, [".ts"]), ...tooling].filter(exists);
const known = [
  ...sources.map((f) => readFileSync(f, "utf8")),
  ...skillNames(path.resolve(root, ".claude", "skills")),
].join("\n");
/** @type {Map<string, boolean>} */
const verdicts = new Map();
/** @param {string} identifier */
function isKnown(identifier) {
  let verdict = verdicts.get(identifier);
  if (verdict === undefined) {
    verdict = new RegExp(`\\b${identifier}\\b`).test(known);
    verdicts.set(identifier, verdict);
  }
  return verdict;
}

const { allowed, problems } = readAllowlist(allowlistFile);
// The agent instructions are a governance document like the others, and the two checks that
// already read them (check-adrs, check-markers) set the precedent. An argument and not a constant,
// so the fixtures of the governance test can point somewhere else (feature 024).
const instructions = path.resolve(root, argString(args, "instructions") ?? "CLAUDE.md");
const rulesDir = path.resolve(root, argString(args, "rules") ?? path.join(".claude", "rules"));
const documents = [
  constitution,
  instructions,
  // The scoped rules carry the detail the core used to hold, so they cite what it cited (025).
  // An argument like the rest, so the fixtures of the governance test point somewhere else.
  ...walkFiles(rulesDir, [".md"]),
  ...docsDirs.flatMap((d) => walkFiles(d, [".md"])),
].filter(exists);
let cited = 0;
/** @type {string[]} */
const unknown = [];
for (const file of documents) {
  for (const { line, identifier } of citedIdentifiers(readFileSync(file, "utf8"))) {
    cited += 1;
    if (allowed.has(identifier) || isKnown(identifier)) continue;
    unknown.push(`${rel(root, file)}:${line}: ${identifier}`);
  }
}

for (const p of problems) console.error(`  - ${p}`);
for (const u of unknown) console.error(u);
console.log(`Identifiers: ${cited} cited, ${unknown.length} unknown`);
process.exit(problems.length > 0 || unknown.length > 0 ? 1 : 0);
