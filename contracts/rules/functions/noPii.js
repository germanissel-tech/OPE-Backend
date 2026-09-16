// ope-no-pii (FR-016): ninguna propiedad, parámetro ni header puede llamarse como un dato personal
// de contracts/rules/pii-denylist.json. Se aplica al documento resuelto completo.
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { walk } = require("./_walk.js");

// Spectral empaqueta las funciones (sin __dirname ni require de JSON): la lista se lee con
// node:fs, resolviendo la ruta de functionOptions.denylist respecto del ruleset.
const cache = new Map();
function loadDenylist(context, relativeFile) {
  const rulesetDir = path.dirname(context.rule.owner.source);
  const file = path.resolve(rulesetDir, relativeFile);
  if (!cache.has(file)) {
    const deny = JSON.parse(readFileSync(file, "utf8")).deny;
    cache.set(file, new Set(deny.map((n) => String(n).toLowerCase())));
  }
  return cache.get(file);
}

function message(name) {
  return `'${name}' es un dato personal prohibido (contracts/rules/pii-denylist.json). OPE no almacena información identificatoria: quitá la propiedad o reemplazala por una clave seudónima.`;
}

module.exports = (document, opts, context) => {
  const DENY = loadDenylist(context, (opts && opts.denylist) || "./rules/pii-denylist.json");
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
        if (param && typeof param.name === "string" && DENY.has(param.name.toLowerCase())) {
          results.push({ message: message(param.name), path: [...base, ...nodePath, i, "name"] });
        }
      });
    }
  });
  return results;
};
