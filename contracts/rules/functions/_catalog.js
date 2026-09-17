// Reads contracts/problem-types.yaml from a Spectral custom function.
// Spectral bundles the functions (no `yaml`, no __dirname), so the catalogue is parsed line by
// line: it has a fixed shape (`namespace:` and a `types:` list of slug/status/title).
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");

/** @import { SpectralContext } from "./_walk.js" */

/** @typedef {{ slug: string; status: number | undefined; title: string; type: string }} CatalogEntry */
/** @typedef {{ namespace: string; types: Map<string, CatalogEntry> }} Catalog */

/** @type {Map<string, Catalog>} */
const cache = new Map();

/**
 * Returns the problem-type catalogue named in functionOptions (relative to the ruleset).
 * @param {SpectralContext} context
 * @param {unknown} relativeFile
 * @returns {Catalog}
 */
function loadCatalog(context, relativeFile) {
  const rulesetDir = path.dirname(context.rule.owner.source);
  const file = path.resolve(
    rulesetDir,
    typeof relativeFile === "string" ? relativeFile : "./problem-types.yaml",
  );
  const cached = cache.get(file);
  if (cached) return cached;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let namespace = "";
  /** @type {Map<string, CatalogEntry>} */
  const types = new Map();
  /** @type {CatalogEntry | null} */
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const ns = /^namespace:\s*"?([^"]+)"?\s*$/.exec(line);
    const slug = /^\s*-\s*slug:\s*(\S+)\s*$/.exec(line);
    const status = current && /^\s+status:\s*(\d+)\s*$/.exec(line);
    const title = current && /^\s+title:\s*(.+)$/.exec(line);
    if (ns?.[1] !== undefined) {
      namespace = ns[1];
    } else if (slug?.[1] !== undefined) {
      current = { slug: slug[1], status: undefined, title: "", type: "" };
      types.set(slug[1], current);
    } else if (current && status?.[1] !== undefined) {
      current.status = Number(status[1]);
    } else if (current && title?.[1] !== undefined) {
      current.title = title[1].trim();
    }
  }
  for (const entry of types.values()) entry.type = `${namespace}${entry.slug}`;
  const catalog = { namespace, types };
  cache.set(file, catalog);
  return catalog;
}

module.exports = { loadCatalog };
