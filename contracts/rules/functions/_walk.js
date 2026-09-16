// Utilidades y tipos compartidos por las funciones custom de Spectral (CommonJS).
// Tipos en JSDoc, verificados por tsconfig.scripts.json (checkJs).
"use strict";

/** @typedef {(string | number)[]} JsonPath */

/**
 * Contexto que Spectral pasa a una función custom. Sólo lo que las reglas de OPE usan.
 * @typedef {object} SpectralContext
 * @property {JsonPath} path ruta absoluta del valor recibido dentro del documento
 * @property {{ owner: { source: string } }} rule regla que invoca la función; `owner.source` es la ruta del ruleset
 * @property {{ data: unknown }} document documento sin resolver
 * @property {{ resolved: unknown } | undefined} [documentInventory] documento con los $ref resueltos
 */

/** @typedef {{ message: string; path?: JsonPath }} SpectralResult */

/**
 * Firma de una función custom de Spectral.
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
 * Lee una propiedad de un valor desconocido sin asumir su forma.
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown}
 */
function get(value, key) {
  return isObject(value) ? value[key] : undefined;
}

/**
 * Recorre todo objeto/array del documento invocando visit(node, path). Omite ejemplos y extensiones.
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
 * Recorre un esquema JSON y sus sub-esquemas (properties, items, allOf/anyOf/oneOf, additionalProperties).
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
