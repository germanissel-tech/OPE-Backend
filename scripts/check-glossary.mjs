// check:glossary — el lenguaje ubicuo contra el contrato (FR-010..FR-014; ADR-008).
//
//   node scripts/check-glossary.mjs [--bundle f] [--glossary d] [--constitution f] [--mvp-docs d]
//
// 1. Todo sustantivo del contrato (segmentos de ruta, nombres de schema) resuelve al `en` de
//    una nota de docs/dominio/ o a la lista técnica (_tecnicos.json).
// 2. Toda nota tiene frontmatter completo y `fuente`.
// 3. La fuente existe: `constitucion#X` (encabezado que contiene X), `mvp:archivo#X` (bajo el
//    directorio de documentos del MVP, si está disponible; si no, aviso), o ruta del repo.
// 4. Toda nota sin uso en el contrato declara `uso: disponible | pendiente`.
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
 * Los documentos del MVP están disponibles si el directorio tiene algún `NN-*.md`. Que exista
 * el directorio no alcanza: en CI el padre del repo existe y está vacío.
 * @returns {boolean}
 */
function mvpDocsAvailable() {
  if (!exists(mvpDocs)) return false;
  return readdirSync(mvpDocs).some((name) => /^\d{2}-.*\.md$/.test(name));
}

const ESTADOS = ["aprobado", "propuesto"];
const USOS = ["disponible", "pendiente"];
const SUFFIXES = ["Request", "Response", "List", "Create", "Update"];

/** @type {string[]} */
const problems = [];
/** @type {string[]} */
const warnings = [];

// --- Lista técnica --------------------------------------------------------------------
const technicalFile = path.join(glossaryDir, "_tecnicos.json");
/** @returns {string[]} */
function loadTechnical() {
  if (!exists(technicalFile)) return [];
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(technicalFile, "utf8")));
  const terms = prop(parsed, "terms");
  return Array.isArray(terms) ? terms.map((t) => String(t).toLowerCase()) : [];
}
const technical = new Set(loadTechnical());

// --- Fuentes ---------------------------------------------------------------------------
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
 * @param {string} fuente
 * @param {string} where
 */
function checkSource(fuente, where) {
  const [ref = "", section] = fuente.split("#");
  if (ref === "constitucion") {
    if (!exists(constitution)) {
      problems.push(`${where}: fuente \`${fuente}\` pero no existe la constitución en ${constitution}`);
    } else if (!headingExists(constitution, section)) {
      problems.push(
        `${where}: fuente \`${fuente}\`: ningún encabezado de la constitución contiene "${String(section)}"`,
      );
    }
    return;
  }
  if (ref.startsWith("mvp:")) {
    const file = path.join(mvpDocs, ref.slice(4));
    if (!mvpDocsAvailable()) {
      warnings.push(
        `${where}: fuente \`${fuente}\` no verificable: no está el directorio de documentos del MVP (${mvpDocs}); definí OPE_MVP_DOCS para verificarla`,
      );
      return;
    }
    if (!exists(file)) {
      problems.push(`${where}: fuente \`${fuente}\`: no existe ${file}`);
    } else if (!headingExists(file, section)) {
      problems.push(
        `${where}: fuente \`${fuente}\`: ningún encabezado de ${ref.slice(4)} contiene "${String(section)}"`,
      );
    }
    return;
  }
  const file = path.resolve(repoRoot, ref);
  if (!exists(file)) {
    problems.push(`${where}: fuente \`${fuente}\`: no existe ${ref}`);
  } else if (!headingExists(file, section)) {
    problems.push(`${where}: fuente \`${fuente}\`: ningún encabezado contiene "${String(section)}"`);
  }
}

// --- Notas ---------------------------------------------------------------------------
/** @typedef {{ where: string; en: string; uso: unknown; used: boolean }} Note */
/** @type {Note[]} */
const notes = [];
for (const file of walkFiles(glossaryDir, [".md"]).filter((f) => path.basename(f) !== "README.md")) {
  const where = rel(repoRoot, file) || path.basename(file);
  const { data, error } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!data) {
    problems.push(`${where}: sin frontmatter válido${error ? ` (${error})` : ""}`);
    continue;
  }
  for (const field of ["es", "en", "contexto", "estado", "fuente"]) {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      problems.push(`${where}: falta \`${field}\` en el frontmatter`);
    }
  }
  const estado = data["estado"];
  if (estado !== undefined && (typeof estado !== "string" || !ESTADOS.includes(estado))) {
    problems.push(`${where}: \`estado: ${String(estado)}\` inválido (${ESTADOS.join(" | ")})`);
  }
  const uso = data["uso"];
  if (uso !== undefined && (typeof uso !== "string" || !USOS.includes(uso))) {
    problems.push(`${where}: \`uso: ${String(uso)}\` inválido (${USOS.join(" | ")})`);
  }
  const fuente = data["fuente"];
  if (typeof fuente === "string") checkSource(fuente, where);
  const en = data["en"];
  if (typeof en === "string") notes.push({ where, en: en.toLowerCase(), uso, used: false });
}

// --- Sustantivos del contrato ---------------------------------------------------------
const doc = exists(bundle) ? readYaml(bundle) : null;
if (!doc) problems.push(`no existe el bundle ${rel(repoRoot, bundle)}; corré npm run contract:bundle`);

/**
 * Candidatos a singular de una palabra en inglés (`widgets` → widget; `boxes` → box;
 * `exposures` → exposure, no `exposur`; `policies` → policy).
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
 * Un nombre compuesto resuelve entero (`foo-bar`, `foobar` o, para los valores de cable de
 * un discriminador, `foo_bar`), o palabra por palabra.
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
      `${at}: el sustantivo "${label}" no resuelve al glosario (huérfano: ${orphan.join(", ")}); agregá docs/dominio/<termino>.md con en: ${first.toLowerCase()} o sumalo a _tecnicos.json si es vocabulario técnico`,
    );
  }
}

if (doc) {
  const paths = prop(doc, "paths");
  for (const route of Object.keys(paths !== null && typeof paths === "object" ? paths : {})) {
    for (const segment of route.split("/").filter(Boolean)) {
      if (segment.startsWith("{") || /^v\d+$/.test(segment)) continue;
      resolveCompound(segment.split("-"), segment, `paths ${route}`);
    }
  }
  const schemas = prop(prop(doc, "components"), "schemas");
  for (const name of Object.keys(schemas !== null && typeof schemas === "object" ? schemas : {})) {
    let stem = name;
    for (const suffix of SUFFIXES) {
      if (stem.endsWith(suffix) && stem.length > suffix.length) stem = stem.slice(0, -suffix.length);
    }
    const words = stem.split(/(?=[A-Z])/).filter(Boolean);
    resolveCompound(words, name, `components.schemas.${name}`);
  }
}

// --- Notas sin uso ------------------------------------------------------------------------
for (const note of notes) {
  if (!note.used && note.uso === undefined) {
    problems.push(
      `${note.where}: el término "${note.en}" no se usa en el contrato; declará \`uso: disponible\` (vocabulario que ningún endpoint expone) o \`uso: pendiente\` (contrato por escribir)`,
    );
  }
}

for (const w of warnings) console.log(`aviso: ${w}`);
const used = notes.filter((n) => n.used).length;
process.exit(
  report(problems, `Glosario: ${notes.length} términos, todos con fuente; ${used} usados en el contrato`),
);
