// Reads the `consumers` section of contracts/api-map.yaml from a Spectral custom function
// (ADR-019, ADR-020). The tag of an operation fixes its consumer; the consumer fixes its
// security scheme and its vocabulary of capabilities.
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parse } = require("yaml");
const { get, isObject } = require("./_walk.js");

/** @import { SpectralContext } from "./_walk.js" */

/** @typedef {{ name: string; scheme: string | null; tags: string[]; capabilities: string[] }} Consumer */
/** @typedef {{ consumers: Map<string, Consumer>; byTag: Map<string, Consumer> }} ApiMap */

/** @type {Map<string, ApiMap>} */
const cache = new Map();

/** @param {unknown} value @returns {string[]} */
const strings = (value) => (Array.isArray(value) ? value.map(String) : []);

/**
 * Returns the map named in functionOptions (relative to the ruleset).
 * @param {SpectralContext} context
 * @param {unknown} relativeFile
 * @returns {ApiMap}
 */
function loadApiMap(context, relativeFile) {
  const rulesetDir = path.dirname(context.rule.owner.source);
  const file = path.resolve(rulesetDir, typeof relativeFile === "string" ? relativeFile : "./api-map.yaml");
  const cached = cache.get(file);
  if (cached) return cached;
  const raw = get(/** @type {unknown} */ (parse(readFileSync(file, "utf8"))), "consumers");
  /** @type {Map<string, Consumer>} */
  const consumers = new Map();
  /** @type {Map<string, Consumer>} */
  const byTag = new Map();
  for (const [name, entry] of Object.entries(isObject(raw) ? raw : {})) {
    const scheme = get(entry, "securityScheme");
    const consumer = {
      name,
      scheme: typeof scheme === "string" ? scheme : null,
      tags: strings(get(entry, "tags")),
      capabilities: strings(get(entry, "capabilities")),
    };
    consumers.set(name, consumer);
    for (const tag of consumer.tags) byTag.set(tag, consumer);
  }
  const map = { consumers, byTag };
  cache.set(file, map);
  return map;
}

/**
 * The consumer of an operation, by its (single) tag; undefined if the tag is not in the map.
 * @param {ApiMap} map
 * @param {Record<string, unknown>} operation
 * @returns {Consumer | undefined}
 */
function consumerOf(map, operation) {
  const tags = operation["tags"];
  const tag = Array.isArray(tags) ? tags[0] : undefined;
  return typeof tag === "string" ? map.byTag.get(tag) : undefined;
}

module.exports = { loadApiMap, consumerOf };
