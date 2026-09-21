// README with inventory (ADR-032 §2, feature 019 D-06): every top-level directory that is not
// code carries a README.md whose `## Inventario` table names each of its first-level entries.
// Pure functions over text and file lists; `tests/docs/readmes.test.ts` feeds them the
// repository (entries come from `git ls-files`, so whatever git ignores never counts).

/**
 * @typedef {object} DirectoryPolicy
 * @property {string} dir top-level directory, no trailing slash
 * @property {readonly string[]} [exclude] first-level entries the inventory need not name
 * @property {readonly string[]} [columns] columns the directory requires beyond the fixed ones
 * @property {readonly SectionPolicy[]} [sections] extra tables the README must carry
 */
/**
 * @typedef {object} SectionPolicy
 * @property {string} heading `## <heading>`
 * @property {readonly string[]} columns
 */
/**
 * @typedef {object} InventoryTable
 * @property {string[]} columns header cells
 * @property {InventoryRow[]} rows
 */
/**
 * @typedef {object} InventoryRow
 * @property {string} entry first cell without the code quotes (`dir/` for a directory)
 * @property {boolean} pattern whether the entry is a pattern (`<…>` or `NNN`)
 * @property {string[]} cells every cell, the entry included
 */

/**
 * The policy (`scripts/readme-inventory-policy.json`; the documentation vocabulary is Spanish,
 * so the file lives outside the language check like the denylist does).
 * @typedef {object} InventoryPolicy
 * @property {readonly string[]} fixedColumns columns every inventory carries
 * @property {readonly string[]} globalExcludes top-level directories that are code or tooling homes
 * @property {readonly DirectoryPolicy[]} directories the directories with an inventory README
 */

/**
 * Reads and checks the shape of the policy file.
 * @param {string} json the file content
 * @returns {InventoryPolicy}
 */
export function parsePolicy(json) {
  const parsed = /** @type {unknown} */ (JSON.parse(json));
  if (typeof parsed !== "object" || parsed === null) throw new Error("policy: not an object");
  const fixedColumns = Reflect.get(parsed, "fixedColumns");
  const globalExcludes = Reflect.get(parsed, "globalExcludes");
  const directories = Reflect.get(parsed, "directories");
  if (!isStringArray(fixedColumns)) throw new Error("policy: fixedColumns must be a string array");
  if (!isStringArray(globalExcludes)) throw new Error("policy: globalExcludes must be a string array");
  if (!Array.isArray(directories) || !directories.every(isDirectoryPolicy)) {
    throw new Error("policy: directories must be a list of { dir, exclude?, columns?, sections? }");
  }
  return { fixedColumns, globalExcludes, directories };
}

/** @param {unknown} value @returns {value is string[]} */
function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** @param {unknown} value @returns {value is DirectoryPolicy} */
function isDirectoryPolicy(value) {
  if (typeof value !== "object" || value === null) return false;
  const dir = Reflect.get(value, "dir");
  const exclude = Reflect.get(value, "exclude");
  const columns = Reflect.get(value, "columns");
  return (
    typeof dir === "string" &&
    (exclude === undefined || isStringArray(exclude)) &&
    (columns === undefined || isStringArray(columns))
  );
}

/** A figure of state in prose (living documentation): the tests count, the README does not. */
const PROSE_FIGURE = /\b\d+\s+(archivos|reglas|pruebas|operaciones|términos)\b/iu;

/**
 * First-level entries of a directory from a list of tracked paths: `name` for a file,
 * `name/` for a directory.
 * @param {readonly string[]} trackedPaths repo-relative, POSIX separators
 * @param {string} dir
 * @param {readonly string[]} [exclude]
 * @returns {string[]} sorted, unique
 */
export function entriesOf(trackedPaths, dir, exclude = []) {
  const prefix = `${dir}/`;
  const entries = new Set();
  for (const file of trackedPaths) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const slash = rest.indexOf("/");
    const entry = slash === -1 ? rest : `${rest.slice(0, slash)}/`;
    if (entry === "README.md") continue;
    if (exclude.includes(entry.replace(/\/$/u, ""))) continue;
    entries.add(entry);
  }
  return [...entries].sort();
}

/**
 * Top-level directories of the repository from tracked paths, minus the global excludes.
 * @param {readonly string[]} trackedPaths
 * @param {readonly string[]} globalExcludes
 * @returns {string[]}
 */
export function topLevelDirectories(trackedPaths, globalExcludes) {
  const dirs = new Set();
  for (const file of trackedPaths) {
    const slash = file.indexOf("/");
    if (slash !== -1) dirs.add(file.slice(0, slash));
  }
  return [...dirs].filter((d) => !globalExcludes.includes(d)).sort();
}

/**
 * The lines of a `## <heading>` section (up to the next `## `), or null when absent.
 * @param {string} markdown
 * @param {string} heading
 * @returns {string[] | null}
 */
export function sectionOf(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/u.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The first markdown table of a section: header cells and rows whose first cell is an entry
 * in code quotes.
 * @param {readonly string[]} sectionLines
 * @returns {InventoryTable | null}
 */
export function parseTable(sectionLines) {
  const tableLines = sectionLines.map((l) => l.trim()).filter((l) => l.startsWith("|"));
  if (tableLines.length < 2) return null;
  const cellsOf = (/** @type {string} */ line) =>
    line
      .replace(/^\|/u, "")
      .replace(/\|$/u, "")
      .split("|")
      .map((c) => c.trim());
  const columns = cellsOf(tableLines[0] ?? "");
  const rows = [];
  for (const line of tableLines.slice(1)) {
    if (/^\|\s*-+/u.test(line)) continue;
    const cells = cellsOf(line);
    const first = cells[0] ?? "";
    const quoted = /^`([^`]+)`$/u.exec(first);
    if (!quoted) continue;
    const entry = quoted[1] ?? "";
    rows.push({ entry, pattern: /<[^>]+>|NNN/u.test(entry), cells });
  }
  return { columns, rows };
}

/**
 * Whether an entry matches an inventory row (exact, or by pattern: `<x>` is one segment,
 * `NNN` three digits).
 * @param {InventoryRow} row
 * @param {string} entry
 * @returns {boolean}
 */
export function rowMatches(row, entry) {
  if (!row.pattern) return row.entry === entry;
  const source = row.entry
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/NNN/gu, "\\d{3}")
    .replace(/<[^>]+>/gu, "[^/]+");
  return new RegExp(`^${source}$`, "u").test(entry);
}

/**
 * Compares a README against the entries of its directory and its policy.
 * @param {string} markdown the README
 * @param {readonly string[]} entries first-level entries (`entriesOf`)
 * @param {DirectoryPolicy} policy
 * @param {readonly string[]} fixedColumns
 * @returns {string[]} problems, empty when the README is complete
 */
export function checkInventory(markdown, entries, policy, fixedColumns) {
  const where = `${policy.dir}/README.md`;
  const section = sectionOf(markdown, "Inventario");
  if (section === null) return [`${where}: no "## Inventario" section`];
  const table = parseTable(section);
  if (table === null) return [`${where}: "## Inventario" has no table`];
  const problems = [
    ...missingColumns(table, [...fixedColumns, ...(policy.columns ?? [])]).map(
      (column) => `${where}: column "${column}" missing`,
    ),
    ...rowProblems(table, entries, policy).map((problem) => `${where}: ${problem}`),
    ...sectionProblems(markdown, policy.sections ?? []).map((problem) => `${where}: ${problem}`),
  ];
  const figure = PROSE_FIGURE.exec(markdown);
  if (figure) problems.push(`${where}: figure of state in prose ("${figure[0]}")`);
  return problems;
}

/**
 * @param {InventoryTable} table
 * @param {readonly string[]} required
 * @returns {string[]} the required columns the table lacks
 */
function missingColumns(table, required) {
  return required.filter((column) => !table.columns.includes(column));
}

/**
 * Every entry has a row (by name or by pattern); every row names an entry, an excluded entry
 * or a pattern that matches something.
 * @param {InventoryTable} table
 * @param {readonly string[]} entries
 * @param {DirectoryPolicy} policy
 * @returns {string[]}
 */
function rowProblems(table, entries, policy) {
  const problems = entries
    .filter((entry) => !table.rows.some((row) => rowMatches(row, entry)))
    .map((entry) => `entry "${entry}" is not in the inventory`);
  for (const row of table.rows) {
    if (row.pattern && !entries.some((e) => rowMatches(row, e))) {
      problems.push(`pattern "${row.entry}" matches nothing`);
    } else if (!row.pattern && !entries.includes(row.entry) && !excluded(policy, row.entry)) {
      problems.push(`"${row.entry}" is in the inventory but not in the directory`);
    }
  }
  return problems;
}

/**
 * Every extra section a policy declares has a table with its columns.
 * @param {string} markdown
 * @param {readonly SectionPolicy[]} sections
 * @returns {string[]}
 */
function sectionProblems(markdown, sections) {
  const problems = [];
  for (const extra of sections) {
    const lines = sectionOf(markdown, extra.heading);
    const table = lines === null ? null : parseTable(lines);
    if (table === null) {
      problems.push(`section "## ${extra.heading}" with a table is required`);
      continue;
    }
    for (const column of missingColumns(table, extra.columns)) {
      problems.push(`column "${column}" missing in "## ${extra.heading}"`);
    }
  }
  return problems;
}

/** An excluded entry (derived, ignored by git) may still be documented; it just need not be. */
function excluded(/** @type {DirectoryPolicy} */ policy, /** @type {string} */ entry) {
  return (policy.exclude ?? []).includes(entry.replace(/\/$/u, ""));
}

/**
 * Every top-level directory has a policy (and so a README), and every policy names a directory.
 * @param {readonly string[]} topLevel from `topLevelDirectories`
 * @param {readonly DirectoryPolicy[]} policies
 * @returns {string[]}
 */
export function checkPolicies(topLevel, policies) {
  const problems = [];
  const known = policies.map((p) => p.dir);
  for (const dir of topLevel) {
    if (!known.includes(dir))
      problems.push(`${dir}/: top-level directory without an inventory README policy`);
  }
  for (const dir of known) {
    if (!topLevel.includes(dir)) problems.push(`${dir}/: policy for a directory that does not exist`);
  }
  return problems;
}

/** What a generated file's first line (or `$comment` for JSON) must say. */
const GENERATED_HEADER = /^(?:\/\/ )?GENERATED by (scripts\/\S+\.mjs) from /u;

/**
 * The script a generated file claims to come from, or null when the header is missing.
 * @param {string} name file name (the extension decides where the header lives)
 * @param {string} content
 * @returns {string | null}
 */
export function generatedBy(name, content) {
  let header = content.split(/\r?\n/u, 1)[0] ?? "";
  if (name.endsWith(".json")) {
    try {
      const parsed = /** @type {unknown} */ (JSON.parse(content));
      const comment =
        typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "$comment") : undefined;
      header = typeof comment === "string" ? comment : "";
    } catch {
      header = "";
    }
  }
  const match = GENERATED_HEADER.exec(header);
  return match ? (match[1] ?? null) : null;
}

/**
 * A patch declares what it fixes and when it retires, in its leading `#` comments.
 * @param {string} content
 * @returns {string[]} the missing lines (`# Fix:` / `# Retire:`)
 */
export function patchHeaderProblems(content) {
  const leading = [];
  for (const line of content.split(/\r?\n/u)) {
    if (!line.startsWith("#")) break;
    leading.push(line);
  }
  const problems = [];
  if (!leading.some((l) => /^# Fix:/u.test(l))) problems.push("# Fix:");
  if (!leading.some((l) => /^# Retire:/u.test(l))) problems.push("# Retire:");
  return problems;
}

/**
 * A script opens with a comment that says what it does (a shebang may come first).
 * @param {string} content
 * @returns {boolean}
 */
export function scriptHasHeader(content) {
  const lines = content.split(/\r?\n/u);
  const first = lines[0]?.startsWith("#!") ? (lines[1] ?? "") : (lines[0] ?? "");
  return first.startsWith("//");
}
