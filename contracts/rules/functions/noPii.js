// ope-no-pii (FR-016): no property, parameter or header may be named like a personal datum from
// contracts/rules/pii-denylist.json. Applies to the whole resolved document. The one exception is
// declared on the schema that carries the datum (`x-personal-datum: { property, reason }`, ADR-044):
// it travels with the schema, so it holds wherever the resolved document repeats it.
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

/** The one way a schema may carry a denied name: declared on the schema itself, with its reason (ADR-044). */
const EXCEPTION = "x-personal-datum";

/**
 * The exception a schema declares: `x-personal-datum: { property, reason }`. It travels with the
 * schema wherever the resolved document repeats it, which is why it lives there and not in the
 * ruleset. A malformed one is reported at the schema and allows nothing.
 * @param {Record<string, unknown>} schema
 * @param {(string | number)[]} at
 * @param {SpectralResult[]} results
 * @returns {string | undefined} the property it excuses
 */
function exceptionOf(schema, at, results) {
  const raw = schema[EXCEPTION];
  if (raw === undefined) return undefined;
  const property = get(raw, "property");
  const reason = get(raw, "reason");
  if (typeof property !== "string" || property.trim() === "") {
    results.push({ message: `${EXCEPTION} names the one property it excuses.`, path: [...at, EXCEPTION] });
    return undefined;
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    results.push({
      message: `${EXCEPTION} (${property}) is written with its reason.`,
      path: [...at, EXCEPTION],
    });
    return undefined;
  }
  const properties = get(schema, "properties");
  if (!properties || typeof properties !== "object" || !(property in properties)) {
    results.push({
      message: `${EXCEPTION} excuses '${property}', which this schema does not declare.`,
      path: [...at, EXCEPTION],
    });
    return undefined;
  }
  return property;
}

/**
 * The denied names a schema declares as properties, minus the one its own exception excuses.
 * @param {Record<string, unknown>} node
 * @param {(string | number)[]} at
 * @param {Set<string>} deny
 * @param {SpectralResult[]} results
 */
function deniedProperties(node, at, deny, results) {
  const properties = node["properties"];
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return;
  const excused = exceptionOf(node, at, results);
  for (const name of Object.keys(properties)) {
    if (deny.has(name.toLowerCase()) && name !== excused) {
      results.push({ message: message(name), path: [...at, "properties", name] });
    }
  }
}

/**
 * Under `headers` the keys are the names: the denied ones among them.
 * @param {Record<string, unknown>} node
 * @param {(string | number)[]} nodePath
 * @param {(string | number)[]} at
 * @param {Set<string>} deny
 * @returns {SpectralResult[]}
 */
function deniedHeaders(node, nodePath, at, deny) {
  if (nodePath[nodePath.length - 1] !== "headers") return [];
  return Object.keys(node)
    .filter((name) => deny.has(name.toLowerCase()))
    .map((name) => ({ message: message(name), path: [...at, name] }));
}

/**
 * A parameter is named in `name`: the denied ones among a node's parameters.
 * @param {Record<string, unknown>} node
 * @param {(string | number)[]} at
 * @param {Set<string>} deny
 * @returns {SpectralResult[]}
 */
function deniedParameters(node, at, deny) {
  const parameters = node["parameters"];
  if (!Array.isArray(parameters)) return [];
  /** @type {SpectralResult[]} */
  const results = [];
  parameters.forEach((param, i) => {
    const name = get(param, "name");
    if (typeof name === "string" && deny.has(name.toLowerCase())) {
      results.push({ message: message(name), path: [...at, "parameters", i, "name"] });
    }
  });
  return results;
}

/** @type {SpectralFunction} */
const noPii = (document, opts, context) => {
  const denylist = get(opts, "denylist");
  const deny = loadDenylist(context, typeof denylist === "string" ? denylist : "./rules/pii-denylist.json");
  /** @type {SpectralResult[]} */
  const results = [];
  const base = context.path;
  walk(document, [], (node, nodePath) => {
    if (Array.isArray(node)) return;
    const at = [...base, ...nodePath];
    deniedProperties(node, at, deny, results);
    results.push(...deniedHeaders(node, nodePath, at, deny), ...deniedParameters(node, at, deny));
  });
  return results;
};

module.exports = noPii;
