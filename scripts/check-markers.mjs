// check:markers — lista los marcadores de estado epistémico (ABIERTO, PROPUESTO, PLACEHOLDER)
// en el contrato y la documentación; con --strict falla si queda alguno bloqueante (FR-022, FR-023).
//
//   node scripts/check-markers.mjs [--root <dir>] [--strict]
//
// No cuentan: lo escrito entre backticks (para poder nombrarlos en las guías) ni el campo
// `estado:` del frontmatter. specs/ y .specify/ quedan fuera: son históricos.
import { readFileSync } from "node:fs";
import path from "node:path";
import { exists, parseArgs, rel, stripBackticks, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

const TOKENS = /\b(ABIERTO|PROPUESTO|PLACEHOLDER)\b/g;
const BLOCKING = new Set(["ABIERTO", "PLACEHOLDER"]);

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? repoRoot);
const strict = args.strict === true;

const files = [
  ...walkFiles(path.join(root, "contracts"), [".yaml", ".yml"]),
  ...walkFiles(path.join(root, "docs"), [".md"]),
  ...["README.md", "CLAUDE.md"].map((f) => path.join(root, f)).filter(exists),
];

const found = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inFrontmatter = false;
  lines.forEach((raw, i) => {
    if (i === 0 && raw.trim() === "---") {
      inFrontmatter = true;
      return;
    }
    if (inFrontmatter) {
      if (raw.trim() === "---") inFrontmatter = false;
      if (/^\s*estado\s*:/.test(raw)) return;
    }
    const line = stripBackticks(raw);
    for (const m of line.matchAll(TOKENS)) {
      found.push({ file: rel(root, file), line: i + 1, token: m[1], text: raw.trim() });
    }
  });
}

const count = (token) => found.filter((f) => f.token === token).length;
for (const f of found) console.log(`${f.file}:${f.line}: ${f.token} — ${f.text}`);
console.log(`Marcadores: ${count("ABIERTO")} abiertos, ${count("PROPUESTO")} propuestos, ${count("PLACEHOLDER")} placeholders`);

const blocking = found.filter((f) => BLOCKING.has(f.token)).length;
if (strict) {
  if (blocking > 0) {
    console.error(`release-check: quedan ${blocking} marcadores bloqueantes (ABIERTO/PLACEHOLDER). Resolvelos o registrá la decisión como ADR.`);
    process.exit(1);
  }
  const proposed = count("PROPUESTO");
  if (proposed > 0) console.log(`aviso: ${proposed} PROPUESTO pendientes de aprobación`);
}
process.exit(0);
