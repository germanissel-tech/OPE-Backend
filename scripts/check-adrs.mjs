// check:adrs — el registro de decisiones está bien formado y ninguna cita apunta a un ADR
// inexistente (FR-020, FR-021).
//
//   node scripts/check-adrs.mjs [--root <dir>]
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  argString,
  exists,
  parseArgs,
  parseFrontmatter,
  rel,
  report,
  stripBackticks,
  walkFiles,
} from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

const ESTADOS = ["propuesta", "aceptada", "reemplazada", "abierta"];
const CITA = /\bADR-(\d{3})\b/g;

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const adrDir = path.join(root, "docs", "adr");

/** @type {string[]} */
const problems = [];
/** @type {Set<number>} */
const numbers = new Set();

for (const file of walkFiles(adrDir, [".md"])) {
  const name = path.basename(file);
  if (name === "README.md") continue;
  const where = rel(root, file);
  const prefix = /^(\d{3})-[a-z0-9-]+\.md$/.exec(name);
  const number = prefix?.[1];
  if (number === undefined) {
    problems.push(`${where}: el nombre debe ser NNN-slug-en-kebab.md`);
    continue;
  }
  const { data, error } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!data) {
    problems.push(`${where}: sin frontmatter válido${error ? ` (${error})` : ""}`);
    continue;
  }
  for (const field of ["numero", "titulo", "estado", "fecha", "fuente"]) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      problems.push(`${where}: falta \`${field}\` en el frontmatter`);
    }
  }
  if (data["numero"] !== undefined && Number(data["numero"]) !== Number(number)) {
    problems.push(`${where}: \`numero: ${String(data["numero"])}\` no coincide con el prefijo ${number}`);
  }
  const estado = data["estado"];
  if (estado !== undefined && (typeof estado !== "string" || !ESTADOS.includes(estado))) {
    problems.push(`${where}: \`estado: ${String(estado)}\` inválido; usar ${ESTADOS.join(" | ")}`);
  }
  const rawFecha = data["fecha"];
  const fecha = rawFecha instanceof Date ? rawFecha.toISOString().slice(0, 10) : rawFecha;
  if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
    problems.push(`${where}: \`fecha\` debe ser YYYY-MM-DD`);
  }
  numbers.add(Number(number));
}

// Citas: en docs, specs, contrato, guías y constitución.
const citing = [
  ...walkFiles(path.join(root, "docs"), [".md"]),
  ...walkFiles(path.join(root, "specs"), [".md"]),
  ...walkFiles(path.join(root, "contracts"), [".yaml", ".yml"]),
  ...["README.md", "CLAUDE.md", path.join(".specify", "memory", "constitution.md")]
    .map((f) => path.join(root, f))
    .filter(exists),
];
let citations = 0;
for (const file of citing) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    // Lo citado entre backticks es un ejemplo, no una cita.
    for (const m of stripBackticks(raw).matchAll(CITA)) {
      citations += 1;
      const cited = m[1] ?? "";
      if (!numbers.has(Number(cited))) {
        problems.push(`${rel(root, file)}:${i + 1}: cita ADR-${cited} pero no existe docs/adr/${cited}-*.md`);
      }
    }
  });
}

process.exit(report(problems, `ADRs: ${numbers.size}, ${citations} citas, sin citas rotas`));
