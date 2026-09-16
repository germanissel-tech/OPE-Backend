// check:markers — lists the epistemic-state markers (ABIERTO, PROPUESTO, PLACEHOLDER) in the
// contract and the documentation; with --strict it fails if a blocking one remains (FR-022, FR-023).
//
//   node scripts/check-markers.mjs [--root <dir>] [--strict]
//
// Not counted: what is written between backticks (so guides can name them) and the `estado:`
// frontmatter field. specs/ and .specify/ are left out: they are historical.
import { readFileSync } from "node:fs";
import path from "node:path";
import { argString, exists, parseArgs, rel, stripBackticks, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

const TOKENS = /\b(ABIERTO|PROPUESTO|PLACEHOLDER)\b/g;
const BLOCKING = new Set(["ABIERTO", "PLACEHOLDER"]);

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const strict = args["strict"] === true;

const files = [
  ...walkFiles(path.join(root, "contracts"), [".yaml", ".yml"]),
  ...walkFiles(path.join(root, "docs"), [".md"]),
  ...["README.md", "CLAUDE.md"].map((f) => path.join(root, f)).filter(exists),
];

/** @typedef {{ file: string; line: number; token: string; text: string }} Marker */
/** @type {Marker[]} */
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
      found.push({ file: rel(root, file), line: i + 1, token: m[1] ?? "", text: raw.trim() });
    }
  });
}

/** @param {string} token */
const count = (token) => found.filter((f) => f.token === token).length;
for (const f of found) console.log(`${f.file}:${f.line}: ${f.token} — ${f.text}`);
console.log(
  `Markers: ${count("ABIERTO")} open, ${count("PROPUESTO")} proposed, ${count("PLACEHOLDER")} placeholders`,
);

const blocking = found.filter((f) => BLOCKING.has(f.token)).length;
if (strict) {
  if (blocking > 0) {
    console.error(
      `release-check: ${blocking} blocking markers remain (ABIERTO/PLACEHOLDER). Resolve them or record the decision as an ADR.`,
    );
    process.exit(1);
  }
  const proposed = count("PROPUESTO");
  if (proposed > 0) console.log(`warning: ${proposed} PROPUESTO pending approval`);
}
process.exit(0);
