// Lee contracts/problem-types.yaml desde una función custom de Spectral.
// Spectral empaqueta las funciones (sin `yaml` ni __dirname), así que el catálogo se parsea
// línea a línea: tiene forma fija (`namespace:` y una lista `types:` de slug/status/title).
"use strict";
const path = require("node:path");
const { readFileSync } = require("node:fs");

const cache = new Map();

/** Devuelve { namespace, types: Map<slug, {status, title, type}> } para el catálogo indicado. */
function loadCatalog(context, relativeFile) {
  const rulesetDir = path.dirname(context.rule.owner.source);
  const file = path.resolve(rulesetDir, relativeFile || "./problem-types.yaml");
  if (cache.has(file)) return cache.get(file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let namespace = "";
  const types = new Map();
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^namespace:\s*"?([^"]+)"?\s*$/))) {
      namespace = m[1];
    } else if ((m = line.match(/^\s*-\s*slug:\s*(\S+)\s*$/))) {
      current = { slug: m[1], status: undefined, title: "" };
      types.set(m[1], current);
    } else if (current && (m = line.match(/^\s+status:\s*(\d+)\s*$/))) {
      current.status = Number(m[1]);
    } else if (current && (m = line.match(/^\s+title:\s*(.+)$/))) {
      current.title = m[1].trim();
    }
  }
  for (const entry of types.values()) entry.type = `${namespace}${entry.slug}`;
  const catalog = { namespace, types };
  cache.set(file, catalog);
  return catalog;
}

module.exports = { loadCatalog };
