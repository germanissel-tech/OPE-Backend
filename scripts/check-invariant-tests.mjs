// check:invariant-tests — toda invariante declarada en el contrato tiene una prueba del servidor
// cuyo título contiene `[invariant:<slug>]` (FR-003; ADR-007).
//
//   node scripts/check-invariant-tests.mjs [--bundle <archivo>] [--tests-dir <dir>]
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, readYaml, rel, report, walkFiles } from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const bundle = path.resolve(args.bundle ?? bundlePath);
const testsDir = path.resolve(args["tests-dir"] ?? path.join(repoRoot, "tests"));

const doc = readYaml(bundle);

/** Junta { slug, path } de todo x-invariants del documento. */
const declared = [];
function collect(node, at) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => collect(item, `${at}/${i}`));
    return;
  }
  if (Array.isArray(node["x-invariants"])) {
    node["x-invariants"].forEach((inv) => {
      if (inv && typeof inv.type === "string") declared.push({ slug: inv.type, at });
    });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "x-invariants" || key === "example" || key === "examples") continue;
    collect(value, `${at}/${key}`);
  }
}
collect(doc, "#");

const tested = new Set();
// Los fixtures de las pruebas de gobernanza contienen marcadores de ejemplo: no cuentan.
for (const file of walkFiles(testsDir, [".test.ts"], ["node_modules", ".git", "dist", "fixtures"])) {
  for (const m of readFileSync(file, "utf8").matchAll(/\[invariant:([a-z0-9-]+)\]/g)) tested.add(m[1]);
}

const slugs = [...new Set(declared.map((d) => d.slug))];
const problems = slugs
  .filter((slug) => !tested.has(slug))
  .map((slug) => {
    const at = declared.find((d) => d.slug === slug).at;
    return `falta una prueba con [invariant:${slug}] en ${rel(repoRoot, testsDir) || "tests"}/**/*.test.ts (invariante declarada en ${at})`;
  });

const withTest = slugs.filter((slug) => tested.has(slug)).length;
process.exit(report(problems, `Invariantes: ${slugs.length} declaradas, ${withTest} con prueba`));
