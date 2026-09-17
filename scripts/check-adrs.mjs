// check:adrs — the decision record is well formed and no citation points at a nonexistent
// ADR (FR-020, FR-021).
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

const STATES = ["propuesta", "aceptada", "reemplazada", "abierta"];
const CITATION = /\bADR-(\d{3})\b/g;

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
    problems.push(`${where}: the name must be NNN-kebab-slug.md`);
    continue;
  }
  const { data, error } = parseFrontmatter(readFileSync(file, "utf8"));
  if (!data) {
    problems.push(`${where}: no valid frontmatter${error ? ` (${error})` : ""}`);
    continue;
  }
  for (const field of ["numero", "titulo", "estado", "fecha", "fuente"]) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      problems.push(`${where}: \`${field}\` is missing in the frontmatter`);
    }
  }
  if (data["numero"] !== undefined && Number(data["numero"]) !== Number(number)) {
    problems.push(`${where}: \`numero: ${String(data["numero"])}\` does not match the ${number} prefix`);
  }
  const state = data["estado"];
  if (state !== undefined && (typeof state !== "string" || !STATES.includes(state))) {
    problems.push(`${where}: invalid \`estado: ${String(state)}\`; use ${STATES.join(" | ")}`);
  }
  const rawDate = data["fecha"];
  const date = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : rawDate;
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    problems.push(`${where}: \`fecha\` must be YYYY-MM-DD`);
  }
  numbers.add(Number(number));
}

// Citations: in docs, specs, contract, guides and constitution.
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
    // What is quoted between backticks is an example, not a citation.
    for (const m of stripBackticks(raw).matchAll(CITATION)) {
      citations += 1;
      const cited = m[1] ?? "";
      if (!numbers.has(Number(cited))) {
        problems.push(
          `${rel(root, file)}:${i + 1}: cites ADR-${cited} but docs/adr/${cited}-*.md does not exist`,
        );
      }
    }
  });
}

process.exit(report(problems, `ADRs: ${numbers.size}, ${citations} citations, none broken`));
