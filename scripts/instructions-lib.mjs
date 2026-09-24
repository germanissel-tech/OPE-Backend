// Contract of the agent instructions (ADR-032 §3, feature 024): what `CLAUDE.md` cites between
// backticks has to exist, and every section of it has to be classified. Pure functions over text
// and a policy; `scripts/check-instructions.mjs` feeds them the repository and
// `tests/docs/instructions.test.ts` feeds them fixtures.
//
// Three kinds of citation, three sources of truth: an identifier is judged by
// `check-identifiers.mjs`, a path against the file system, a command against `package.json`. The
// point of separating them is that a path judged as an identifier is invisible (that is why a
// retired directory survived two features) and an identifier judged as a path is a false positive.

/** A root that is absolute, on either platform: these functions stay free of `node:path`. */
const ESCAPES_REPOSITORY = /^(?:\/|[A-Za-z]:)/;

/**
 * @typedef {object} Policy
 * @property {number} coreMaxLines what the core may not exceed. 200, and the number is the one the
 *   official documentation publishes, with its reason: a longer file is obeyed worse. It lives here
 *   and not in the script because it governs behaviour (constitution XI).
 * @property {readonly string[]} implicitRoots roots a path may be abbreviated against, in order
 * @property {NotPaths} notPaths what is written with slashes and does not name a place
 * @property {string} commandsSection the heading of the table the commands are read from
 * @property {string} commandsInventory the file that describes the commands the core does not name
 * @property {readonly InstructionFile[]} files the core and every scoped rule, with their sections
 * @property {readonly Exception[]} exceptions citations that deliberately do not resolve
 */
/**
 * @typedef {object} InstructionFile
 * @property {string} file path from the repository root
 * @property {"core" | "rule"} role the core loads at launch; a rule loads when its paths match
 * @property {readonly string[]} [paths] what a rule is scoped to. **Without this a rule loads at
 *   launch and saves nothing**, so a rule with neither this nor `unscopedReason` is an error.
 * @property {string} [unscopedReason] why this rule is deliberately not scoped
 * @property {readonly Section[]} sections every heading of that file, with its kind
 */
/**
 * @typedef {object} NotPaths
 * @property {readonly string[]} shapeNames a bare name that names a convention, not one file
 * @property {readonly string[]} namespacePrefixes a prefix that is not a directory
 */
/**
 * @typedef {object} Section
 * @property {string} heading the heading text, without the leading hashes
 * @property {"normative" | "descriptive" | "mixed"} kind
 * @property {string} [reason] why it is mixed; required for `mixed`
 */
/**
 * @typedef {object} Exception
 * @property {string} [cite] the citation that does not resolve
 * @property {string} [script] the command that is deliberately undocumented
 * @property {string} reason why
 */
/**
 * @typedef {object} Citation
 * @property {number} line 1-based
 * @property {string} text what is between the backticks
 */

const FENCE = /^\s*(```|~~~)/;
const SPAN = /`([^`\n]+)`/g;
// From the title down. A rule file's only heading is its title, and the core's title carries the
// language convention: leaving the first level out left a section nobody had to classify (025).
const HEADING = /^#{1,6}\s+(.+?)\s*$/;
/** The table writes a command three ways, and a combined cell uses all three: `npm run x`, `npm x`, `x`. */
const NPM_RUN = /^npm (?:run )?([a-z0-9:-]+)$/;
const BARE_SCRIPT = /^[a-z][a-z0-9]*(?::[a-z0-9-]+)*$/;
/** A template (`<module>`) or a glob (`*`) names a shape, never one file. */
const TEMPLATE = /[<>*]/;
/** What a path may end with when it has no slash to give it away. */
const FILE_EXTENSION = /\.(ts|mts|cts|js|mjs|cjs|json|yaml|yml|md|html|patch)$/;
/** `a/b.{js,d.ts}` names two files; both are checked. */
const BRACES = /^(.*)\{([^}]*)\}(.*)$/;
const KINDS = ["normative", "descriptive", "mixed"];

/**
 * The citations of a markdown document, with their line. Fenced blocks are skipped: a code block
 * shows code, and code that does not compile there is not a broken reference.
 * @param {string} markdown
 * @returns {Citation[]}
 */
export function citations(markdown) {
  /** @type {Citation[]} */
  const found = [];
  let fenced = false;
  markdown.split("\n").forEach((text, index) => {
    if (FENCE.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    for (const m of text.matchAll(SPAN)) found.push({ line: index + 1, text: m[1] ?? "" });
  });
  return found;
}

/**
 * The files a citation names: one, or the branches of its braces.
 * @param {string} cite
 * @returns {string[]}
 */
export function branches(cite) {
  const m = BRACES.exec(cite);
  if (!m) return [cite];
  return (m[2] ?? "").split(",").map((part) => `${m[1] ?? ""}${part.trim()}${m[3] ?? ""}`);
}

/**
 * Whether a citation is meant to name a place in the repository. Everything excluded here is
 * excluded **by its shape**, not by a list of names: a list of names is a list that ages.
 * @param {string} cite
 * @param {Policy} policy
 * @returns {boolean}
 */
export function namesAPlace(cite, policy) {
  if (/\s/.test(cite)) return false;
  if (!cite.includes("/") && !FILE_EXTENSION.test(cite)) return false;
  if (TEMPLATE.test(cite)) return false;
  if (cite.startsWith("/")) return false;
  if (policy.notPaths.namespacePrefixes.some((prefix) => cite.startsWith(prefix))) return false;
  if (policy.notPaths.shapeNames.includes(cite)) return false;
  return true;
}

/**
 * The citations that name a place and do not resolve against any declared root.
 * @param {readonly Citation[]} cites
 * @param {Policy} policy
 * @param {(file: string) => boolean} exists
 * @returns {{ problems: string[], checked: number }}
 */
export function pathProblems(cites, policy, exists) {
  const excused = new Set(policy.exceptions.map((e) => e.cite).filter((c) => typeof c === "string"));
  /** @type {string[]} */
  const problems = [];
  let checked = 0;
  for (const { line, text } of cites) {
    if (!namesAPlace(text, policy) || excused.has(text)) continue;
    checked += 1;
    for (const one of branches(text)) {
      const bare = one.endsWith("/") ? one.slice(0, -1) : one;
      if (policy.implicitRoots.some((root) => exists(`${root}${bare}`))) continue;
      problems.push(`${line}: path that does not exist: ${text}`);
    }
  }
  return { problems, checked };
}

/**
 * The lines a section spans, from its heading to the next heading of the same or higher level.
 * @param {string} markdown
 * @param {string} heading
 * @returns {{ from: number, to: number } | undefined}
 */
export function sectionRange(markdown, heading) {
  const lines = markdown.split("\n");
  let depth = 0;
  let from = 0;
  for (const [index, text] of lines.entries()) {
    const m = /^(#{2,})\s+(.+?)\s*$/.exec(text);
    if (!m) continue;
    const level = (m[1] ?? "").length;
    if (from === 0) {
      if (m[2] !== heading) continue;
      depth = level;
      from = index + 1;
      continue;
    }
    if (level <= depth) return { from, to: index };
  }
  return from === 0 ? undefined : { from, to: lines.length };
}

/**
 * The commands the table names, with the line that names them.
 *
 * Only the **first cell** of each row: the second one describes what the command does, in prose
 * that cites other things (`tsc`, `uvx`, the name of a Vitest project). Reading the whole row
 * reports four commands that do not exist and were never meant to — measured.
 * @param {string} markdown
 * @param {{ from: number, to: number }} table
 * @returns {Map<string, number>}
 */
function documentedCommands(markdown, table) {
  /** @type {Map<string, number>} */
  const documented = new Map();
  const lines = markdown.split("\n");
  for (let line = table.from; line <= Math.min(table.to, lines.length); line += 1) {
    const text = lines[line - 1] ?? "";
    if (!text.trimStart().startsWith("|")) continue;
    for (const m of (text.split("|")[1] ?? "").matchAll(SPAN)) {
      const cell = m[1] ?? "";
      const named = NPM_RUN.exec(cell)?.[1] ?? (BARE_SCRIPT.test(cell) ? cell : undefined);
      if (named !== undefined && !documented.has(named)) documented.set(named, line);
    }
  }
  return documented;
}

/**
 * The commands **of the table** against the scripts of the repository, in both directions: one
 * documented that does not exist turns the table into a false promise; one that exists and is not
 * documented is the hole this feature found.
 *
 * Only the table counts, and that is the faithful reading of what it promises. A combined cell
 * —`npm run build` / `dev` / `typecheck`— names three commands in three shapes, so all three are
 * read; scoping to the section is what keeps a bare word like `dev` from counting as documentation
 * anywhere else in the document.
 *
 * **Two places count, not one** (feature 025). The core names the handful an agent runs in its
 * loop; the rest are described in the inventory of `scripts/`, which its own test already verifies
 * row by row. Asking the core to list all of them was what made that table a second copy of the
 * inventory — the same coupling this work exists to remove. What may not happen is a command
 * described in *neither*.
 * @param {string} markdown
 * @param {readonly string[]} scripts
 * @param {Policy} policy
 * @param {{ table: { from: number, to: number } | undefined, inventory: string }} where the table
 *   of the core and the markdown of the inventory that describes the rest
 * @returns {{ problems: string[], checked: number }}
 */
export function commandProblems(markdown, scripts, policy, where) {
  const { table, inventory } = where;
  if (!table) {
    return { problems: ["0: the commands section of the policy is not in the document"], checked: 0 };
  }
  const excused = new Set(policy.exceptions.map((e) => e.script).filter((s) => typeof s === "string"));
  const documented = documentedCommands(markdown, table);
  const elsewhere = new Set(
    [...inventory.matchAll(SPAN)]
      .map((m) => NPM_RUN.exec(m[1] ?? "")?.[1] ?? (BARE_SCRIPT.test(m[1] ?? "") ? m[1] : undefined))
      .filter((name) => typeof name === "string"),
  );
  /** @type {string[]} */
  const problems = [];
  for (const [name, line] of documented) {
    if (!scripts.includes(name)) problems.push(`${line}: command that does not exist: ${name}`);
  }
  for (const name of scripts) {
    if (documented.has(name) || elsewhere.has(name) || excused.has(name)) continue;
    problems.push(`0: command of the repository that the table does not name: ${name}`);
  }
  return { problems, checked: documented.size };
}

/**
 * The headings of a markdown document, in order, outside fenced blocks.
 * @param {string} markdown
 * @returns {{ line: number, heading: string }[]}
 */
export function headings(markdown) {
  /** @type {{ line: number, heading: string }[]} */
  const found = [];
  let fenced = false;
  markdown.split("\n").forEach((text, index) => {
    if (FENCE.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const m = HEADING.exec(text);
    if (m?.[1] !== undefined) found.push({ line: index + 1, heading: m[1] });
  });
  return found;
}

/**
 * Sections against the policy **in both directions**. The second direction is the half that gets
 * forgotten, and it is the one that forces a decision: a section cannot be opened in silence.
 * @param {string} markdown
 * @param {InstructionFile} entry
 * @returns {{ problems: string[], checked: number }}
 */
export function sectionProblems(markdown, entry) {
  const declared = new Map(entry.sections.map((s) => [s.heading, s]));
  const present = headings(markdown);
  /** @type {string[]} */
  const problems = [];
  for (const { line, heading } of present) {
    const section = declared.get(heading);
    if (!section) {
      problems.push(`${line}: section without a policy: ${heading}`);
      continue;
    }
    if (!KINDS.includes(section.kind)) {
      problems.push(`${line}: unknown kind "${section.kind}": ${heading}`);
    }
    if (section.kind === "mixed" && (section.reason ?? "").trim() === "") {
      problems.push(`${line}: mixed section without a reason: ${heading}`);
    }
  }
  const seen = new Set(present.map((h) => h.heading));
  for (const section of entry.sections) {
    if (!seen.has(section.heading)) {
      problems.push(`0: policy for a section that does not exist: ${section.heading}`);
    }
  }
  return { problems, checked: present.length };
}

/**
 * The core may not exceed what the policy declares.
 *
 * The number is not ours: the official documentation publishes it, and its reason is the one that
 * matters — a longer file is **obeyed worse**, which is a bigger problem than the tokens it costs.
 * It counts the pointers that the moved sections leave behind, which is what makes it honest: a
 * core that fits only by not counting what it carries does not fit (feature 025).
 * @param {string} markdown
 * @param {number} max
 * @returns {string[]}
 */
export function coreSizeProblems(markdown, max) {
  const lines = markdown.split("\n").length;
  return lines > max ? [`0: the core has ${lines} lines; the limit is ${max}`] : [];
}

/**
 * Every rule is scoped, and scoped to something that is there.
 *
 * The first half is the decision that cannot be skipped: a rule without `paths` loads at launch
 * like the core, so it saves nothing and the file grows back without anyone noticing. The second is
 * what keeps a scoped rule from being dead weight: one that matches no file never loads, and
 * nothing would say so.
 * @param {Policy} policy
 * @param {(pattern: string) => boolean} matchesSomething
 * @returns {string[]}
 */
export function scopeProblems(policy, matchesSomething) {
  /** @type {string[]} */
  const problems = [];
  for (const entry of policy.files) {
    if (entry.role !== "rule") continue;
    const scoped = entry.paths ?? [];
    if (scoped.length === 0) {
      if ((entry.unscopedReason ?? "").trim() === "") {
        problems.push(`0: rule that is not scoped and gives no reason: ${entry.file}`);
      }
      continue;
    }
    for (const pattern of scoped) {
      if (!matchesSomething(pattern)) {
        problems.push(`0: the scope matches no file: ${entry.file} → ${pattern}`);
      }
    }
  }
  return problems;
}

/**
 * The policy itself: every exception needs a reason and names one thing or the other, and every
 * file declares a role the checks know.
 * @param {unknown} parsed
 * @returns {string[]}
 */
export function policyProblems(parsed) {
  /** @type {string[]} */
  const problems = [];
  const policy = /** @type {Policy} */ (parsed);
  for (const [index, exception] of policy.exceptions.entries()) {
    const names = [exception.cite, exception.script].filter((x) => typeof x === "string");
    if (names.length !== 1) {
      problems.push(`0: exception ${index} names neither a citation nor a script, or names both`);
    }
    if ((exception.reason ?? "").trim() === "") {
      problems.push(`0: exception without a reason: ${names[0] ?? index}`);
    }
  }
  // A root that climbs out of the repository makes the gate answer differently on every machine:
  // it passed locally, where the MVP documents sit in the parent directory, and could never pass
  // on CI, which checks out the repository alone (feature 026). What lives outside the repository
  // is an exception with its reason, not a root.
  for (const root of policy.implicitRoots) {
    if (ESCAPES_REPOSITORY.test(root) || root.split("/").includes("..")) {
      problems.push(`0: implicit root outside the repository: ${root}`);
    }
  }
  const cores = policy.files.filter((f) => f.role === "core");
  if (cores.length !== 1) problems.push(`0: the policy declares ${cores.length} cores; it declares one`);
  for (const entry of policy.files) {
    if (entry.role !== "core" && entry.role !== "rule") {
      problems.push(`0: unknown role "${entry.role}": ${entry.file}`);
    }
  }
  return problems;
}
