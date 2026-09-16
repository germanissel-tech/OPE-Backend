// Utilidades compartidas por los scripts de gobernanza (check-adrs, check-markers,
// check-glossary, check-invariant-tests). Sin dependencias de shell. Tipos en JSDoc.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/**
 * Recorre `dir` recursivamente y devuelve los archivos con alguna de las extensiones dadas.
 * @param {string} dir
 * @param {readonly string[]} extensions
 * @param {readonly string[]} [ignore] nombres de directorio que no se recorren
 * @returns {string[]}
 */
export function walkFiles(dir, extensions, ignore = ["node_modules", ".git", "dist"]) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} current */
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  };
  if (exists(dir)) visit(dir);
  return out.sort();
}

/**
 * @param {string} file
 * @returns {boolean}
 */
export function exists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

/** @typedef {Record<string, unknown>} Frontmatter */

/**
 * Separa el frontmatter YAML (`---` … `---`) del cuerpo de un markdown.
 * @param {string} markdown
 * @returns {{ data: Frontmatter | null; body: string; error?: string }}
 */
export function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match) return { data: null, body: markdown };
  const [, front = "", body = ""] = match;
  try {
    const data = /** @type {unknown} */ (parse(front));
    if (data !== null && data !== undefined && (typeof data !== "object" || Array.isArray(data))) {
      return { data: null, body, error: "el frontmatter no es un objeto" };
    }
    return { data: /** @type {Frontmatter} */ (data ?? {}), body };
  } catch (err) {
    return { data: null, body, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Lee y parsea un YAML. El tipo del contenido lo decide quien lo consume.
 * @param {string} file
 * @returns {unknown}
 */
export function readYaml(file) {
  return /** @type {unknown} */ (parse(readFileSync(file, "utf8")));
}

/**
 * Quita los spans entre backticks de una línea (lo citado no cuenta como marcador).
 * @param {string} line
 * @returns {string}
 */
export function stripBackticks(line) {
  return line.replace(/`[^`]*`/g, "");
}

/**
 * Imprime problemas (si hay) y devuelve el exit code.
 * @param {readonly string[]} problems
 * @param {string} okMessage
 * @returns {0 | 1}
 */
export function report(problems, okMessage) {
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`${problems.length} problema(s).`);
    return 1;
  }
  console.log(okMessage);
  return 0;
}

/**
 * Ruta relativa al root, con separadores POSIX, para mensajes estables entre plataformas.
 * @param {string} root
 * @param {string} file
 * @returns {string}
 */
export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** @typedef {Record<string, string | true>} ParsedArgs */

/**
 * Parseo mínimo de argumentos `--clave valor` y `--flag`.
 * @param {readonly string[]} argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined || !a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/**
 * Valor string de un argumento parseado, o undefined si no vino o vino como flag.
 * @param {ParsedArgs} args
 * @param {string} key
 * @returns {string | undefined}
 */
export function argString(args, key) {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Lee una propiedad de un objeto desconocido sin asumir su forma.
 * @param {unknown} obj
 * @param {string} key
 * @returns {unknown}
 */
export function prop(obj, key) {
  if (obj !== null && typeof obj === "object" && key in obj) {
    return /** @type {Record<string, unknown>} */ (obj)[key];
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
