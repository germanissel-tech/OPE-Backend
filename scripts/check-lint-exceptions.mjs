// Cuenta las excepciones de lint vigentes (FR-003): directivas de desactivación del linter y
// del compilador fuera de fixtures y de las pruebas de tipos. Informativo: nunca falla; que una excepción
// tenga motivo lo exige ESLint (require-description) y ban-ts-comment.
//
//   node scripts/check-lint-exceptions.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { rel, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

// Se arma por partes para que este archivo no se cuente a sí mismo.
const WORDS = {
  lint: ["eslint", "disable"].join("-"),
  ignore: `@ts-${"ignore"}`,
  expect: `@ts-${"expect"}-error`,
};
const DIRECTIVE = new RegExp(
  `(${WORDS.lint}(?:-next-line|-line)?|${WORDS.ignore}|${WORDS.expect})\\b[^\\n]*`,
);
const IGNORE = ["node_modules", ".git", "dist", "fixtures", "generated"];

const roots = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "tests"),
  path.join(repoRoot, "scripts"),
  path.join(repoRoot, "contracts", "rules", "functions"),
];

/** @type {string[]} */
const found = [];
for (const root of roots) {
  for (const file of walkFiles(root, [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"], IGNORE)) {
    // Las pruebas de tipos desactivan el compilador a propósito (SC-007 de la 001).
    if (file.includes(`${path.sep}tests${path.sep}types${path.sep}`)) continue;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const m = DIRECTIVE.exec(line);
        if (m) found.push(`${rel(repoRoot, file)}:${i + 1}: ${m[0].trim()}`);
      });
  }
}
for (const f of found) console.log(f);
console.log(`Excepciones de lint: ${found.length}`);
