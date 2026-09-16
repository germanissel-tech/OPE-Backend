// ope-no-pii (FR-016): ninguna propiedad, parámetro ni header puede llamarse como un dato personal
// de contracts/rules/pii-denylist.json. Se aplica al documento resuelto completo.
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { get, walk } = require("./_walk.js");

/** @import { SpectralContext, SpectralFunction, SpectralResult } from "./_walk.js" */

// Spectral empaqueta las funciones (sin __dirname ni require de JSON): la lista se lee con
// node:fs, resolviendo la ruta de functionOptions.denylist respecto del ruleset.
/** @type {Map<string, Set<string>>} */
const cache = new Map();

/**
 * @param {SpectralContext} context
 * @param {string} relativeFile
 * @returns {Set<string>}
 */
function loadDenylist(context, relativeFile) {
  const rulesetDir = path.dirname(context.rule.owner.source);
  const file = path.resolve(rulesetDir, relativeFile);
  const cached = cache.get(file);
  if (cached) return cached;
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(file, "utf8")));
  const deny = get(parsed, "deny");
  const names = Array.isArray(deny) ? deny.map((n) => String(n).toLowerCase()) : [];
  const set = new Set(names);
  cache.set(file, set);
  return set;
}

/** @param {string} name */
function message(name) {
  return `'${name}' es un dato personal prohibido (contracts/rules/pii-denylist.json). OPE no almacena información identificatoria: quitá la propiedad o reemplazala por una clave seudónima.`;
}

/** @type {SpectralFunction} */
const noPii = (document, opts, context) => {
  const denylist = get(opts, "denylist");
  const DENY = loadDenylist(context, typeof denylist === "string" ? denylist : "./rules/pii-denylist.json");
  /** @type {SpectralResult[]} */
  const results = [];
  const base = context.path;
  walk(document, [], (node, nodePath) => {
    const parentKey = nodePath[nodePath.length - 1];
    // Propiedades de esquema y headers de respuesta/encoding: las claves son los nombres.
    if ((parentKey === "properties" || parentKey === "headers") && !Array.isArray(node)) {
      for (const name of Object.keys(node)) {
        if (DENY.has(name.toLowerCase()))
          results.push({ message: message(name), path: [...base, ...nodePath, name] });
      }
    }
    // Parámetros: el nombre está en `name`.
    if (parentKey === "parameters" && Array.isArray(node)) {
      node.forEach((param, i) => {
        const name = get(param, "name");
        if (typeof name === "string" && DENY.has(name.toLowerCase())) {
          results.push({ message: message(name), path: [...base, ...nodePath, i, "name"] });
        }
      });
    }
  });
  return results;
};

module.exports = noPii;
