// Utilities and types shared by the Spectral custom functions (CommonJS).
// Types in JSDoc, verified by tsconfig.scripts.json (checkJs).
"use strict";

/** @typedef {(string | number)[]} JsonPath */

/**
 * Context Spectral passes to a custom function. Only what OPE's rules use.
 * @typedef {object} SpectralContext
 * @property {JsonPath} path absolute path of the received value within the document
 * @property {{ owner: { source: string } }} rule rule invoking the function; `owner.source` is the ruleset path
 * @property {{ data: unknown }} document unresolved document
 * @property {{ resolved: unknown } | undefined} [documentInventory] document with $refs resolved
 */

/** @typedef {{ message: string; path?: JsonPath }} SpectralResult */

/**
 * Signature of a Spectral custom function.
 * @typedef {(input: unknown, options: unknown, context: SpectralContext) => SpectralResult[]} SpectralFunction
 */

/** @typedef {Record<string, unknown>} JsonObject */

const SKIP_KEYS = new Set(["example", "examples"]);

/**
 * @param {unknown} value
 * @returns {value is JsonObject}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reads a property of an unknown value without assuming its shape.
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown}
 */
function get(value, key) {
  return isObject(value) ? value[key] : undefined;
}

/**
 * Walks every object/array of the document invoking visit(node, path). Skips examples and extensions.
 * @param {unknown} node
 * @param {JsonPath} path
 * @param {(node: JsonObject | unknown[], path: JsonPath) => void} visit
 */
function walk(node, path, visit) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    visit(node, path);
    node.forEach((item, i) => {
      walk(item, [...path, i], visit);
    });
    return;
  }
  const obj = /** @type {JsonObject} */ (node);
  visit(obj, path);
  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_KEYS.has(key) || key.startsWith("x-")) continue;
    walk(value, [...path, key], visit);
  }
}

const SCHEMA_CHILD_KEYS = ["allOf", "anyOf", "oneOf"];

/**
 * Walks a JSON schema and its sub-schemas (properties, items, allOf/anyOf/oneOf, additionalProperties).
 * @param {unknown} schema
 * @param {JsonPath} path
 * @param {(schema: JsonObject, path: JsonPath) => void} visit
 * @param {Set<unknown>} [seen]
 */
function walkSchema(schema, path, visit, seen = new Set()) {
  if (!isObject(schema) || seen.has(schema)) return;
  seen.add(schema);
  visit(schema, path);
  const properties = schema["properties"];
  if (isObject(properties)) {
    for (const [name, sub] of Object.entries(properties)) {
      walkSchema(sub, [...path, "properties", name], visit, seen);
    }
  }
  if (isObject(schema["items"])) walkSchema(schema["items"], [...path, "items"], visit, seen);
  if (isObject(schema["additionalProperties"])) {
    walkSchema(schema["additionalProperties"], [...path, "additionalProperties"], visit, seen);
  }
  for (const key of SCHEMA_CHILD_KEYS) {
    const subs = schema[key];
    if (Array.isArray(subs)) {
      subs.forEach((sub, i) => {
        walkSchema(sub, [...path, key, i], visit, seen);
      });
    }
  }
}

/**
 * @param {JsonObject} schema
 * @returns {boolean}
 */
function isObjectSchema(schema) {
  return schema["type"] === "object" || (schema["properties"] !== undefined && schema["type"] === undefined);
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

module.exports = { walk, walkSchema, isObjectSchema, isObject, get, HTTP_METHODS };
