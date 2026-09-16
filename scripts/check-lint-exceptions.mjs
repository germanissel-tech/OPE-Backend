// Counts the current lint exceptions (FR-003): linter and compiler disable directives outside
// fixtures and the type tests. Informative: it never fails; that an exception has a reason is
// demanded by ESLint (require-description) and ban-ts-comment.
//
//   node scripts/check-lint-exceptions.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { rel, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

// Assembled in parts so this file does not count itself.
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
    // The type tests disable the compiler on purpose (SC-007 of 001).
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
console.log(`Lint exceptions: ${found.length}`);
