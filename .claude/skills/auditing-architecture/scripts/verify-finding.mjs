// verify-finding — mechanical verification of audit findings (ADR-016, FR-064).
//
//   node .claude/skills/auditing-architecture/scripts/verify-finding.mjs <findings.json>
//
// Input: a JSON array of findings (or { findings: [...] }) as `references/formato-hallazgo.md`
// describes. Each one is validated against audit-finding.schema.json, then its file and line must
// exist and its rule.source must resolve:
//   ADR-NNN                 → docs/adr/NNN-*.md exists
//   constitution#<section>  → a heading of .specify/memory/constitution.md contains <section>
//   guide#<section>         → a heading of CLAUDE.md contains <section>
//   lint:<rule>             → the rule id appears in eslint.config.mjs
//   arch:<rule>             → a rule named <rule> exists in .dependency-cruiser.cjs (context-map:* included)
//   clarity:<slug>          → always resolves (low severity, no formal source)
// Output: the same findings with `verified` and, when false, `reason`. Exit 1 if any is false.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The schema is draft 2020-12: Ajv's default class only knows draft-07. The CommonJS build exposes
// the class both as default and as a named export; the named one keeps its constructor type.
import ajv2020 from "ajv/dist/2020.js";

const { Ajv2020 } = ajv2020;

/** @typedef {{ id: string; file: string; line: number; rule: { id: string; source: string }; severity: string; status: string; verified?: boolean; reason?: string }} Finding */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");
const schema = /** @type {object} */ (JSON.parse(readFileSync(path.join(here, "audit-finding.schema.json"), "utf8")));

/**
 * @param {string} file
 * @param {string} needle
 * @returns {boolean}
 */
function headingContains(file, needle) {
  if (!existsSync(file)) return false;
  const wanted = needle.toLowerCase();
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .some((line) => /^#{1,6}\s/.test(line) && line.toLowerCase().includes(wanted));
}

/**
 * @param {string} number
 * @returns {string | null}
 */
function resolveAdr(number) {
  const dir = path.join(repoRoot, "docs", "adr");
  const found = existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(`${number}-`) && f.endsWith(".md"));
  return found ? null : `docs/adr/${number}-*.md does not exist`;
}

/** One resolver per source prefix: returns why the rest of the source does not resolve, or null. */
const RESOLVERS = /** @type {Record<string, (rest: string) => string | null>} */ ({
  "constitution#": (section) =>
    headingContains(path.join(repoRoot, ".specify", "memory", "constitution.md"), section)
      ? null
      : `no heading of the constitution contains "${section}"`,
  "guide#": (section) =>
    headingContains(path.join(repoRoot, "CLAUDE.md"), section) ? null : `no heading of CLAUDE.md contains "${section}"`,
  "lint:": (rule) =>
    readFileSync(path.join(repoRoot, "eslint.config.mjs"), "utf8").includes(`"${rule}"`)
      ? null
      : `rule ${rule} is not in eslint.config.mjs`,
  "arch:": (rule) => {
    const config = readFileSync(path.join(repoRoot, ".dependency-cruiser.cjs"), "utf8");
    const named = config.includes(`name: "${rule}"`) || (rule.startsWith("context-map:") && config.includes("context-map:${mod}"));
    return named ? null : `rule ${rule} is not in .dependency-cruiser.cjs`;
  },
  "clarity:": () => null,
});

/**
 * @param {string} source
 * @returns {string | null} why it does not resolve, or null
 */
function resolveSource(source) {
  const adr = /^ADR-(\d{3})$/.exec(source);
  if (adr?.[1] !== undefined) return resolveAdr(adr[1]);
  const prefix = Object.keys(RESOLVERS).find((p) => source.startsWith(p));
  const resolver = prefix === undefined ? undefined : RESOLVERS[prefix];
  if (prefix === undefined || resolver === undefined) return `unknown source form: ${source}`;
  return resolver(source.slice(prefix.length));
}

/**
 * @param {Finding} finding
 * @returns {string | null}
 */
function verifyLocation(finding) {
  const file = path.join(repoRoot, finding.file);
  if (!existsSync(file)) return `file ${finding.file} does not exist`;
  const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
  if (finding.line > lines) return `line ${finding.line} is beyond the end of ${finding.file} (${lines} lines)`;
  return null;
}

/**
 * @param {Finding[]} findings
 * @returns {Finding[]}
 */
export function verifyAll(findings) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  return findings.map((finding) => {
    const reasons = [];
    if (!validate(finding)) {
      const errors = /** @type {{ instancePath: string; message?: string }[]} */ (validate.errors ?? []);
      reasons.push(`schema: ${errors.map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`).join("; ")}`);
    }
    const location = typeof finding.file === "string" && typeof finding.line === "number" ? verifyLocation(finding) : null;
    if (location) reasons.push(location);
    const source = typeof finding.rule?.source === "string" ? resolveSource(finding.rule.source) : null;
    if (source) reasons.push(`source: ${source}`);
    return reasons.length === 0 ? { ...finding, verified: true } : { ...finding, verified: false, reason: reasons.join(" | ") };
  });
}

const input = process.argv[2];
if (input !== undefined) {
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path.resolve(input), "utf8")));
  const wrapped = /** @type {{ findings?: Finding[] }} */ (parsed);
  // An array of findings, `{ findings: [...] }`, or a single finding (an eval's expected.json).
  const findings = Array.isArray(parsed)
    ? /** @type {Finding[]} */ (parsed)
    : (wrapped.findings ?? [/** @type {Finding} */ (parsed)]);
  const verified = verifyAll(findings);
  console.log(JSON.stringify(verified, null, 2));
  process.exit(verified.every((f) => f.verified) ? 0 : 1);
}
