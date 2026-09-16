// check:glossary — the ubiquitous language against the contract (FR-010..FR-014; ADR-008).
//
//   node scripts/check-glossary.mjs [--bundle f] [--glossary d] [--constitution f] [--mvp-docs d]
//
// 1. Every contract noun (path segments, schema names) resolves to the `en` of a note in
//    docs/dominio/ or to the technical list (_tecnicos.json).
// 2. Every note has a complete frontmatter and a `fuente` (source).
// 3. The source exists: `constitucion#X` (a heading containing X), `mvp:file#X` (under the MVP
//    documents directory, if available; otherwise a warning), or a repo path.
// 4. Every note unused in the contract declares `uso: disponible | pendiente`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  argString,
  exists,
  parseArgs,
  parseFrontmatter,
  prop,
  readYaml,
  rel,
  report,
  walkFiles,
} from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const bundle = path.resolve(argString(args, "bundle") ?? bundlePath);
const glossaryDir = path.resolve(argString(args, "glossary") ?? path.join(repoRoot, "docs", "dominio"));
const constitution = path.resolve(
  argString(args, "constitution") ?? path.join(repoRoot, ".specify", "memory", "constitution.md"),
);
const mvpDocs = path.resolve(
  argString(args, "mvp-docs") ?? process.env["OPE_MVP_DOCS"] ?? path.join(repoRoot, ".."),
);

/**
 * The MVP documents are available if the directory has some `NN-*.md`. The directory existing
 * is not enough: in CI the repo's parent exists and is empty.
 * @returns {boolean}
 */
function mvpDocsAvailable() {
  if (!exists(mvpDocs)) return false;
  return readdirSync(mvpDocs).some((name) => /^\d{2}-.*\.md$/.test(name));
}

const STATES = ["aprobado", "propuesto"];
const USES = ["disponible", "pendiente"];
const SUFFIXES = ["Request", "Response", "List", "Create", "Update"];

/** @type {string[]} */
const problems = [];
/** @type {string[]} */
const warnings = [];

// --- Technical list ------------------------------------------------------------------
const technicalFile = path.join(glossaryDir, "_tecnicos.json");
/** @returns {string[]} */
function loadTechnical() {
  if (!exists(technicalFile)) return [];
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(technicalFile, "utf8")));
  const terms = prop(parsed, "terms");
  return Array.isArray(terms) ? terms.map((t) => String(t).toLowerCase()) : [];
}
const technical = new Set(loadTechnical());

// --- Sources -------------------------------------------------------------------------
/**
 * @param {string} file
 * @param {string | undefined} section
 * @returns {boolean}
 */
function headingExists(file, section) {
  if (!section) return true;
  const needle = section.toLowerCase();
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .some((line) => /^#{1,6}\s/.test(line) && line.toLowerCase().includes(needle));
}

/**
 * @param {string} source
 * @param {string} where
 */
function checkSource(source, where) {
  const [ref = "", section] = source.split("#");
  if (ref === "constitucion") {
    if (!exists(constitution)) {
      problems.push(`${where}: source \`${source}\` but the constitution does not exist at ${constitution}`);
    } else if (!headingExists(constitution, section)) {
      problems.push(
        `${where}: source \`${source}\`: no heading of the constitution contains "${String(section)}"`,
      );
    }
    return;
  }
  if (ref.startsWith("mvp:")) {
    const file = path.join(mvpDocs, ref.slice(4));
    if (!mvpDocsAvailable()) {
      warnings.push(
        `${where}: source \`${source}\` not verifiable: the MVP documents directory is missing (${mvpDocs}); set OPE_MVP_DOCS to verify it`,
      );
      return;
    }
    if (!exists(file)) {
      problems.push(`${where}: source \`${source}\`: ${file} does not exist`);
    } else if (!headingExists(file, section)) {
      problems.push(
        `${where}: source \`${source}\`: no heading of ${ref.slice(4)} contains "${String(section)}"`,
      );
    }
    return;
  }
  const file = path.resolve(repoRoot, ref);
  if (!exists(file)) {
    problems.push(`${where}: source \`${source}\`: ${ref} does not exist`);
  } else if (!headingExists(file, section)) {
    problems.push(`${where}: source \`${source}\`: no heading contains "${String(section)}"`);
  }
}

// --- Notes -------------------------------------------------------------------------
/** @typedef {{ where: string; en: string; use: unknown; used: boolean }} Note */
/** @type {Note[]} */
const notes = [];
for (const file of walkFiles(glossaryDir, [".md"]).filter((f) => path.basename(f) !== "README.md")) {
  const where = rel(repoRoot, file) || path.basename(file);
  const { data, error } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!data) {
    problems.push(`${where}: no valid frontmatter${error ? ` (${error})` : ""}`);
    continue;
  }
  for (const field of ["es", "en", "contexto", "estado", "fuente"]) {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      problems.push(`${where}: \`${field}\` is missing in the frontmatter`);
    }
  }
  const state = data["estado"];
  if (state !== undefined && (typeof state !== "string" || !STATES.includes(state))) {
    problems.push(`${where}: invalid \`estado: ${String(state)}\` (${STATES.join(" | ")})`);
  }
  const use = data["uso"];
  if (use !== undefined && (typeof use !== "string" || !USES.includes(use))) {
    problems.push(`${where}: invalid \`uso: ${String(use)}\` (${USES.join(" | ")})`);
  }
  const source = data["fuente"];
  if (typeof source === "string") checkSource(source, where);
  const en = data["en"];
  if (typeof en === "string") notes.push({ where, en: en.toLowerCase(), use, used: false });
}

// --- Contract nouns -------------------------------------------------------
const doc = exists(bundle) ? readYaml(bundle) : null;
if (!doc) problems.push(`bundle ${rel(repoRoot, bundle)} does not exist; run npm run contract:bundle`);

/**
 * Singular candidates of an English word (`widgets` → widget; `boxes` → box;
 * `exposures` → exposure, not `exposur`; `policies` → policy).
 * @param {string} w
 * @returns {string[]}
 */
const singulars = (w) => {
  if (w.endsWith("ies")) return [`${w.slice(0, -3)}y`];
  if (w.endsWith("es") && !w.endsWith("ses")) return [w.slice(0, -1), w.slice(0, -2)];
  if (w.endsWith("s")) return [w.slice(0, -1)];
  return [];
};
const byEn = new Map(notes.map((n) => [n.en, n]));

/**
 * @param {string} word
 * @returns {boolean}
 */
function resolveWord(word) {
  const w = word.toLowerCase();
  for (const candidate of [w, ...singulars(w)]) {
    if (technical.has(candidate)) return true;
    const note = byEn.get(candidate);
    if (note) {
      note.used = true;
      return true;
    }
  }
  return false;
}

/**
 * A compound name resolves as a whole (`foo-bar`, `foobar` or, for the wire values of a
 * discriminator, `foo_bar`), or word by word.
 * @param {string[]} words
 * @param {string} label
 * @param {string} at
 */
function resolveCompound(words, label, at) {
  const lower = words.map((w) => w.toLowerCase());
  if (["-", "", "_"].some((sep) => resolveWord(lower.join(sep)))) return;
  const orphan = words.filter((w) => !resolveWord(w));
  const first = orphan[0];
  if (first !== undefined) {
    problems.push(
      `${at}: noun "${label}" does not resolve to the glossary (orphan: ${orphan.join(", ")}); add docs/dominio/<term>.md with en: ${first.toLowerCase()} or add it to _tecnicos.json if it is technical vocabulary`,
    );
  }
}

/**
 * Keys of an object-shaped value, or none.
 * @param {unknown} value
 * @returns {string[]}
 */
const keysOf = (value) => Object.keys(value !== null && typeof value === "object" ? value : {});

/**
 * Every path segment that is not a parameter or a version prefix must resolve.
 * @param {string} route
 */
function resolveRoute(route) {
  for (const segment of route.split("/").filter(Boolean)) {
    if (segment.startsWith("{") || /^v\d+$/.test(segment)) continue;
    resolveCompound(segment.split("-"), segment, `paths ${route}`);
  }
}

/**
 * A schema name resolves without its technical suffix, split by PascalCase words.
 * @param {string} name
 */
function resolveSchema(name) {
  let stem = name;
  for (const suffix of SUFFIXES) {
    if (stem.endsWith(suffix) && stem.length > suffix.length) stem = stem.slice(0, -suffix.length);
  }
  const words = stem.split(/(?=[A-Z])/).filter(Boolean);
  resolveCompound(words, name, `components.schemas.${name}`);
}

if (doc) {
  for (const route of keysOf(prop(doc, "paths"))) resolveRoute(route);
  for (const name of keysOf(prop(prop(doc, "components"), "schemas"))) resolveSchema(name);
}

// --- Unused notes ----------------------------------------------------------------------
for (const note of notes) {
  if (!note.used && note.use === undefined) {
    problems.push(
      `${note.where}: term "${note.en}" is not used in the contract; declare \`uso: disponible\` (vocabulary no endpoint exposes) or \`uso: pendiente\` (contract yet to be written)`,
    );
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
const used = notes.filter((n) => n.used).length;
process.exit(
  report(problems, `Glossary: ${notes.length} terms, all with a source; ${used} used in the contract`),
);
