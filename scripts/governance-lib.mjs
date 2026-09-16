// Utilidades compartidas por los scripts de gobernanza (check-adrs, check-markers,
// check-glossary, check-invariant-tests). Sin dependencias de shell.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/** Recorre `dir` recursivamente y devuelve los archivos con alguna de las extensiones dadas. */
export function walkFiles(dir, extensions, ignore = ["node_modules", ".git", "dist"]) {
  const out = [];
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

export function exists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

/** Separa el frontmatter YAML (`---` … `---`) del cuerpo de un markdown. */
export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: null, body: markdown };
  let data;
  try {
    data = parse(match[1]) ?? {};
  } catch (err) {
    return { data: null, body: match[2], error: err.message };
  }
  return { data, body: match[2] };
}

export function readYaml(file) {
  return parse(readFileSync(file, "utf8"));
}

/** Quita los spans entre backticks de una línea (lo citado no cuenta como marcador). */
export function stripBackticks(line) {
  return line.replace(/`[^`]*`/g, "");
}

/** Imprime problemas (si hay) y devuelve el exit code. */
export function report(problems, okMessage) {
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`${problems.length} problema(s).`);
    return 1;
  }
  console.log(okMessage);
  return 0;
}

/** Ruta relativa al root, con separadores POSIX, para mensajes estables entre plataformas. */
export function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Parseo mínimo de argumentos `--clave valor` y `--flag`. */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
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
