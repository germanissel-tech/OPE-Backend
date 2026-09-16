// ope-no-pii (FR-016): no property, parameter or header may be named like a personal datum from
// contracts/rules/pii-denylist.json. Applies to the whole resolved document.
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { get, walk } = require("./_walk.js");

/** @import { SpectralContext, SpectralFunction, SpectralResult } from "./_walk.js" */

// Spectral bundles the functions (no __dirname, no JSON require): the list is read with
// node:fs, resolving the functionOptions.denylist path relative to the ruleset.
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
  return `'${name}' is a forbidden personal datum (contracts/rules/pii-denylist.json). OPE stores no identifying information: remove the property or replace it with a pseudonymous key.`;
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
    // Schema properties and response/encoding headers: the keys are the names.
    if ((parentKey === "properties" || parentKey === "headers") && !Array.isArray(node)) {
      for (const name of Object.keys(node)) {
        if (DENY.has(name.toLowerCase()))
          results.push({ message: message(name), path: [...base, ...nodePath, name] });
      }
    }
    // Parameters: the name is in `name`.
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
