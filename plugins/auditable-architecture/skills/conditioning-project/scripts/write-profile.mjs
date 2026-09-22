// write-profile — makes a repository auditable: writes audit.profile.json from what inspect
// detected plus the owner's answers, the design criteria document from the template (pre-filled
// with what the constitution and the ADRs already say; PLACEHOLDER where nothing was decided),
// and records every detected tool that lacks a gate adapter as pending. Idempotent: a file
// equal to what would be generated is left alone; a file that differs (a manual edit) is never
// overwritten, the difference is reported.
//
//   node write-profile.mjs <root> [--answers <json>] [--dry-run]
//
// Answers: { moduleRoots?: string[], blockingGates?: "all" | "none" | string[], diffBase?: string }.
// Unanswered questions stop the run (exit 1) naming them; answers are kept in the profile
// (conditioning.answers) so a second run regenerates the same files without asking again.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "./inspection.mjs";

/** @typedef {import("./inspection.mjs").Inspection} Inspection */
/** @typedef {{ moduleRoots?: string[]; blockingGates?: "all" | "none" | string[]; diffBase?: string }} Answers */

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(here, "..", "templates", "criterios-diseno.template.md");
const CRITERIA_FILE = "docs/auditoria/criterios-diseno.md";
const EVALS_DIR = "tests/audit/evals";

const TEXTS = path.join(here, "..", "templates", "criterios.json");

/**
 * @typedef {{ criteria: { title: string; keywords: string[] }[]; section: Record<"definition" | "source" | "sourceMissing" | "violates" | "complies" | "gate", string>; gates: { none: string; each: string } }} Texts
 */

/** The text of the criteria document (the documentation language) lives with the templates. */
function texts() {
  return /** @type {Texts} */ (JSON.parse(readFileSync(TEXTS, "utf8")));
}

/**
 * `--key value` and `--flag` pairs.
 * @param {readonly string[]} argv
 * @returns {Record<string, string | true>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[arg.slice(2)] = next;
      i += 1;
    } else out[arg.slice(2)] = true;
  }
  return out;
}

/**
 * The answers: the flag first, then what the existing profile recorded.
 * @param {Inspection} inspection
 * @param {string | undefined} flag
 * @returns {Answers}
 */
function answersOf(inspection, flag) {
  const recorded = inspection.existingProfile?.["conditioning"];
  const previous =
    typeof recorded === "object" && recorded !== null ? Reflect.get(recorded, "answers") : undefined;
  const fromProfile =
    typeof previous === "object" && previous !== null ? /** @type {Answers} */ (previous) : {};
  const fromFlag = flag === undefined ? {} : /** @type {Answers} */ (JSON.parse(flag));
  return { ...fromProfile, ...fromFlag };
}

/**
 * What an adapter says of itself (`--describe`: mode, scopes), or nothing.
 * @param {string} root
 * @param {string} gate
 * @returns {{ mode?: string; scopes?: string[] }}
 */
function describeAdapter(root, gate) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "audit", `gate-${gate}.mjs`), "--describe"],
    { cwd: root, encoding: "utf8" },
  );
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(r.stdout));
    return typeof parsed === "object" && parsed !== null
      ? /** @type {{ mode?: string; scopes?: string[] }} */ (parsed)
      : {};
  } catch {
    return {};
  }
}

/**
 * The gates: one per adapter present, with the mode and scopes the adapter declares and the
 * owner's answer on what blocks.
 * @param {string} root
 * @param {Inspection} inspection
 * @param {Answers} answers
 * @returns {{ id: string; mode: string; scopes?: string[]; run: string; format: string }[]}
 */
function gatesOf(root, inspection, answers) {
  const blocking = answers.blockingGates ?? "all";
  return inspection.adapters.map((gate) => {
    const described = describeAdapter(root, gate);
    const blocks =
      blocking === "all" ? described.mode !== "informative" : blocking !== "none" && blocking.includes(gate);
    return {
      id: gate,
      mode: blocks ? "blocking" : "informative",
      ...(described.scopes === undefined ? {} : { scopes: described.scopes }),
      run: `node scripts/audit/gate-${gate}.mjs`,
      format: "findings-v1",
    };
  });
}

/**
 * The sources of truth: the conventional ones are declared even when absent (with their usual
 * path: the doctor lists them as missing and the owner knows what to create), the specs only
 * when found, one gate-rule kind per gate, and clarity.
 * @param {Inspection} inspection
 * @param {{ id: string }[]} gates
 * @returns {Record<string, unknown>[]}
 */
function sourcesOf(inspection, gates) {
  const s = inspection.sources;
  const at = (/** @type {string} */ kind, /** @type {string} */ fallback) => s[kind]?.path ?? fallback;
  const sources = [
    {
      kind: "constitution#",
      severity: "high",
      resolve: { type: "markdown-heading", file: at("constitution", ".specify/memory/constitution.md") },
    },
    {
      kind: "ADR-",
      severity: "high",
      resolve: { type: "file-glob", pattern: `${at("adr", "docs/adr")}/{id}-*.md` },
    },
    {
      kind: "guide#",
      severity: "medium",
      resolve: { type: "markdown-heading", file: at("guide", "CLAUDE.md") },
    },
  ];
  if (s["specs"]?.found) {
    sources.push({
      kind: "spec:",
      severity: "high",
      resolve: {
        type: "text-in-file",
        file: `${s["specs"].path}/{id}-*/spec.md`,
        contains: "**{ref}**",
        refPattern: "^(FR|SC)-[0-9]{3}$",
      },
    });
  }
  for (const gate of gates)
    sources.push({ kind: `${gate.id}:`, severity: "medium", resolve: { type: "gate-rule", gate: gate.id } });
  sources.push({ kind: "clarity:", severity: "low", resolve: { type: "criteria-section" } });
  return sources;
}

/**
 * The profile, from the inspection and the answers.
 * @param {string} root
 * @param {Inspection} inspection
 * @param {Answers} answers
 * @returns {Record<string, unknown>}
 */
export function buildProfile(root, inspection, answers) {
  const gates = gatesOf(root, inspection, answers);
  const pending = Object.entries(inspection.tools)
    .filter(([, t]) => t.found && t.adapter === undefined)
    .map(([tool, t]) => ({ tool, gate: t.gate, adapter: `scripts/audit/gate-${t.gate}.mjs` }));
  return {
    $schema:
      "./plugins/auditable-architecture/skills/auditing-architecture/scripts/audit-profile.schema.json",
    profileVersion: 1,
    sourceRoot: inspection.sourceRoot,
    scopes: {
      module: { roots: answers.moduleRoots ?? inspection.modules?.roots ?? [] },
      diff: { base: answers.diffBase ?? inspection.diffBase ?? "", include: [`${inspection.sourceRoot}/`] },
    },
    gates,
    sources: sourcesOf(inspection, gates),
    criteria: CRITERIA_FILE,
    evals: EVALS_DIR,
    conditioning: { answers, ...(pending.length === 0 ? {} : { pending }) },
  };
}

/** A keyword counts at the start of a word only (`port` finds "ports", not "report"). */
function mentions(/** @type {string} */ text, /** @type {string} */ keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}`, "iu").test(text);
}

/**
 * The headings of a markdown file (level 1 to 3).
 * @param {string} file
 * @returns {string[]}
 */
function headingsOf(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((l) => /^#{1,3}\s/u.test(l))
    .map((l) => l.replace(/^#+\s*/u, "").trim());
}

/**
 * The ADR files as `NNN` and title, from their names.
 * @param {string} dir
 * @returns {{ number: string; title: string }[]}
 */
function adrsOf(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{3}-.*\.md$/u.test(f))
    .map((f) => ({ number: f.slice(0, 3), title: f.slice(4, -3).replaceAll("-", " ") }));
}

/**
 * The criteria document: per criterion, the constitution sections and ADRs whose titles match
 * its keywords as sources, or PLACEHOLDER.
 * @param {string} root
 * @param {Inspection} inspection
 * @param {Record<string, unknown>} profile
 * @returns {string}
 */
export function buildCriteria(root, inspection, profile) {
  const { criteria, section, gates: gateTexts } = texts();
  const constitution = inspection.sources["constitution"];
  const adr = inspection.sources["adr"];
  const headings =
    constitution?.found && constitution.path !== undefined
      ? headingsOf(path.join(root, constitution.path))
      : [];
  const adrs = adr?.found && adr.path !== undefined ? adrsOf(path.join(root, adr.path)) : [];
  const sections = criteria.map(({ title, keywords }) => {
    const found = [
      ...headings.filter((h) => keywords.some((k) => mentions(h, k))).map((h) => `\`constitution#${h}\``),
      ...adrs
        .filter((x) => keywords.some((k) => mentions(x.title, k)))
        .map((x) => `\`ADR-${x.number}\` (${x.title})`),
    ];
    const source = found.length === 0 ? section.sourceMissing : found.join(", ");
    return [
      `## ${title}`,
      "",
      section.definition,
      section.source.replaceAll("{{SOURCE}}", source),
      section.violates,
      section.complies,
      section.gate,
    ].join("\n");
  });
  const gates = /** @type {{ id: string; mode: string }[]} */ (profile["gates"]);
  const gateLines =
    gates.length === 0
      ? [gateTexts.none]
      : gates.map((g) => gateTexts.each.replaceAll("{{ID}}", g.id).replaceAll("{{MODE}}", g.mode));
  const template = readFileSync(TEMPLATE, "utf8");
  return `${template.replace("{{CRITERIA}}", sections.join("\n\n")).replace("{{GATES}}", gateLines.join("\n")).trimEnd()}\n`;
}

/**
 * Writes a file when it is absent; reports it unchanged when equal; refuses to overwrite a
 * different one (a manual edit), reporting the difference.
 * @param {string} root
 * @param {string} rel
 * @param {string} content
 * @param {boolean} dryRun
 * @returns {string} one line of report
 */
function place(root, rel, content, dryRun) {
  const file = path.join(root, rel);
  if (!existsSync(file)) {
    if (!dryRun) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, "utf8");
    }
    return `${rel}: ${dryRun ? "would be written" : "written"}`;
  }
  const current = readFileSync(file, "utf8").replace(/\r\n/gu, "\n");
  if (current === content) return `${rel}: unchanged`;
  const theirs = current.split("\n");
  const ours = content.split("\n");
  const at = ours.findIndex((line, i) => line !== theirs[i]);
  return `${rel}: differs from what would be generated (first difference at line ${at + 1}); kept as it is — the owner's edits are not overwritten`;
}

const argv = process.argv.slice(2);
const root = path.resolve(argv.find((a) => !a.startsWith("--")) ?? ".");
const args = parseArgs(argv);
const dryRun = args["dry-run"] === true;
const inspection = inspect(root);
const answers = answersOf(inspection, typeof args["answers"] === "string" ? args["answers"] : undefined);
const unanswered = inspection.questions.filter((q) => !(q.key in answers));
if (unanswered.length > 0) {
  console.error(`unanswered: ${unanswered.map((q) => q.key).join(", ")} (pass --answers '{...}')`);
  process.exit(1);
}
const profile = buildProfile(root, inspection, answers);
const files = {
  "audit.profile.json": `${JSON.stringify(profile, null, 2)}\n`,
  [CRITERIA_FILE]: buildCriteria(root, inspection, profile),
};
if (dryRun) {
  console.log(JSON.stringify({ files, answers, questions: inspection.questions }, null, 2));
} else {
  for (const [rel, content] of Object.entries(files)) console.log(place(root, rel, content, false));
  const pending =
    /** @type {{ pending?: { tool: string; adapter: string }[] }} */ (profile["conditioning"]).pending ?? [];
  for (const p of pending) console.log(`pending: ${p.tool} has no gate adapter yet (${p.adapter})`);
}
