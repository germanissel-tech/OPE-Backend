// check:language — everything a developer or an API consumer reads is in English (ADR-015).
//
//   node scripts/check-language.mjs [--root <dir>] [--dir <path>] [--json]
//
// Scope: src/, tests/, scripts/, contracts/, .github/, .claude/skills/*/scripts/ and the root
// configuration files. Exclusions come from .prettierignore (single list) plus this script's
// word list. For TypeScript/JavaScript only comments, strings and template literals are
// examined (never identifiers); for YAML/JSON every line is. Two detectors: characters that
// only Spanish uses, and Spanish function words (scripts/language-denylist.json) on word
// boundaries. An exception is declared on the line or the line before with
// `lang:es -- reason`; without a reason it fails. Exceptions are counted at the end.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { argString, parseArgs, rel, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

/** @typedef {{ file: string; line: number; rule: string; message: string }} Finding */

const SCOPE_DIRS = ["src", "tests", "scripts", "contracts", ".github"];
const SKILL_SCRIPTS = ".claude/skills";
const ROOT_FILES = [
  "eslint.config.mjs",
  ".dependency-cruiser.cjs",
  "vitest.config.ts",
  "lefthook.yml",
  "redocly.yaml",
  "package.json",
  "knip.json",
  "stryker.config.json",
];
const CODE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const TEXT_EXTENSIONS = [".yaml", ".yml", ".json"];
const EXTENSIONS = [...CODE_EXTENSIONS, ...TEXT_EXTENSIONS];
// The inventory policy names the (Spanish) columns of the documentation README, like the denylist names Spanish words.
const ALWAYS_EXCLUDED = [
  "scripts/language-denylist.json",
  "scripts/readme-inventory-policy.json",
  "patches/",
];
const SPANISH_CHARS = /[áéíóúñÁÉÍÓÚÑ¿¡]/u;
// The directive must open the comment: a mention of `lang:es` in prose is not an exception.
const ALLOW = /^\s*(?:\/\/|#|\/\*+|\*)?\s*lang:es(?:\s*--\s*(\S.*))?/;
const FRAGMENT_MAX = 80;

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(argString(args, "root") ?? repoRoot);
const dirArg = argString(args, "dir");
const json = args["json"] === true;

const denylist = /** @type {{ words: string[] }} */ (
  JSON.parse(readFileSync(path.join(repoRoot, "scripts", "language-denylist.json"), "utf8"))
);
// A hyphen counts as part of the word: slugs and fixture names (`wire-value`) are identifiers,
// not prose, and "-es" in English text is a suffix, not the Spanish verb.
const wordPattern = new RegExp(`(?<![\\p{L}_$-])(?:${denylist.words.join("|")})(?![\\p{L}_$-])`, "iu");

/**
 * Exclusion prefixes: .prettierignore entries (directories end with "/") plus the fixed ones.
 * @param {string} base
 * @returns {string[]}
 */
function exclusions(base) {
  const file = path.join(base, ".prettierignore");
  const fromIgnore = existsSync(file)
    ? readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== "" && !l.startsWith("#"))
    : [];
  return [...fromIgnore, ...ALWAYS_EXCLUDED];
}

/**
 * @param {string} relPath posix path relative to root
 * @param {readonly string[]} prefixes
 * @returns {boolean}
 */
function isExcluded(relPath, prefixes) {
  return prefixes.some((p) =>
    p.endsWith("/") ? relPath.startsWith(p) || relPath.includes(`/${p}`) : relPath === p,
  );
}

/**
 * @param {string} base
 * @returns {string[]}
 */
function collectFiles(base) {
  if (dirArg !== undefined) return walkFiles(path.resolve(base, dirArg), EXTENSIONS);
  const files = SCOPE_DIRS.flatMap((d) => walkFiles(path.join(base, d), EXTENSIONS));
  const skills = path.join(base, SKILL_SCRIPTS);
  if (existsSync(skills)) {
    for (const skill of walkFiles(skills, EXTENSIONS)) {
      if (rel(base, skill).split("/")[3] === "scripts") files.push(skill);
    }
  }
  for (const f of ROOT_FILES) if (existsSync(path.join(base, f))) files.push(path.join(base, f));
  return files;
}

/**
 * Offsets where each line starts, to map token positions to line numbers.
 * @param {string} text
 * @returns {number[]}
 */
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

/**
 * @param {number[]} starts
 * @param {number} pos
 * @returns {number} 1-based line
 */
function lineOf(starts, pos) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** @typedef {{ line: number; text: string; isComment: boolean }} Segment */

/**
 * Comments, strings and template parts of a TypeScript/JavaScript file, one entry per line.
 * @param {string} text
 * @returns {Segment[]}
 */
function codeSegments(text) {
  const starts = lineStarts(text);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  /** @type {Segment[]} */
  const out = [];
  /** @type {number[]} */
  const templateDepth = [];
  let braceDepth = 0;
  /** @param {ts.SyntaxKind} kind */
  const push = (kind) => {
    const isComment =
      kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia;
    const startLine = lineOf(starts, scanner.getTokenStart());
    scanner
      .getTokenText()
      .split(/\r?\n/)
      .forEach((piece, i) => out.push({ line: startLine + i, text: piece, isComment }));
  };
  /** A `}` either closes a template substitution (rescan as template) or a block. */
  const closeBrace = () => {
    if (templateDepth.length === 0 || templateDepth[templateDepth.length - 1] !== braceDepth) {
      braceDepth--;
      return;
    }
    const rescanned = scanner.reScanTemplateToken(false);
    push(rescanned);
    if (rescanned === ts.SyntaxKind.TemplateTail) templateDepth.pop();
  };
  let kind = scanner.scan();
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    switch (kind) {
      case ts.SyntaxKind.SingleLineCommentTrivia:
      case ts.SyntaxKind.MultiLineCommentTrivia:
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        push(kind);
        break;
      case ts.SyntaxKind.TemplateHead:
        push(kind);
        templateDepth.push(braceDepth);
        break;
      case ts.SyntaxKind.OpenBraceToken:
        braceDepth++;
        break;
      case ts.SyntaxKind.CloseBraceToken:
        closeBrace();
        break;
      default:
        break;
    }
    kind = scanner.scan();
  }
  return out;
}

/**
 * Every line of a YAML/JSON file counts as prose; `#` lines are comments.
 * @param {string} text
 * @returns {Segment[]}
 */
function textSegments(text) {
  return text
    .split(/\r?\n/)
    .map((line, i) => ({ line: i + 1, text: line, isComment: line.trim().startsWith("#") }));
}

/**
 * @param {string} text
 * @returns {string | null} the Spanish fragment found, or null
 */
function spanishIn(text) {
  const byChar = SPANISH_CHARS.exec(text);
  const byWord = wordPattern.exec(text);
  const hit = byChar ?? byWord;
  if (!hit) return null;
  const from = Math.max(0, hit.index - 20);
  const fragment = text.slice(from, from + FRAGMENT_MAX).trim();
  return from > 0 ? `…${fragment}` : fragment;
}

/**
 * @param {string} file absolute path
 * @param {string} shown path shown in findings
 * @returns {{ findings: Finding[]; exceptions: number }}
 */
function checkFile(file, shown) {
  const text = readFileSync(file, "utf8");
  const segments = CODE_EXTENSIONS.includes(path.extname(file)) ? codeSegments(text) : textSegments(text);
  /** @type {Finding[]} */
  const findings = [];
  /** @type {Set<number>} */
  const allowed = new Set();
  let exceptions = 0;
  for (const s of segments) {
    if (!s.isComment) continue;
    const m = ALLOW.exec(s.text);
    if (!m) continue;
    if (m[1] === undefined) {
      findings.push({
        file: shown,
        line: s.line,
        rule: "language/missing-reason",
        message: "`lang:es` without ` -- reason`",
      });
    } else {
      exceptions++;
    }
    allowed.add(s.line);
    allowed.add(s.line + 1);
  }
  for (const s of segments) {
    if (allowed.has(s.line) || ALLOW.test(s.text)) continue;
    const fragment = spanishIn(s.text);
    if (fragment !== null)
      findings.push({ file: shown, line: s.line, rule: "language/spanish", message: fragment });
  }
  return { findings, exceptions };
}

const prefixes = exclusions(root);
/** @type {Finding[]} */
const findings = [];
let exceptions = 0;
for (const file of collectFiles(root)) {
  const shown = rel(root, file);
  if (isExcluded(shown, prefixes)) continue;
  const r = checkFile(file, shown);
  findings.push(...r.findings);
  exceptions += r.exceptions;
}
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (json) {
  console.log(
    JSON.stringify({
      gate: "language",
      mode: "blocking",
      status: findings.length === 0 ? "pass" : "fail",
      findings,
      exceptions,
    }),
  );
} else {
  for (const f of findings) console.log(`${f.file}:${f.line}: ${f.message}`);
  if (findings.length > 0) console.log(`check:language — ${findings.length} finding(s) in Spanish.`);
  else console.log("check:language — everything in scope is in English.");
  console.log(`Language exceptions: ${exceptions}`);
}
process.exit(findings.length === 0 ? 0 : 1);
