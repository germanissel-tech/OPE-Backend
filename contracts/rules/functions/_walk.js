// Utilidades compartidas por las funciones custom de Spectral (CommonJS).
"use strict";

const SKIP_KEYS = new Set(["example", "examples"]);

/** Recorre todo objeto/array del documento invocando visit(node, path). Omite ejemplos y extensiones. */
function walk(node, path, visit) {
  if (node === null || typeof node !== "object") return;
  visit(node, path);
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, [...path, i], visit));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key) || key.startsWith("x-")) continue;
    walk(value, [...path, key], visit);
  }
}

const SCHEMA_CHILD_KEYS = ["allOf", "anyOf", "oneOf"];

/** Recorre un esquema JSON y sus sub-esquemas (properties, items, allOf/anyOf/oneOf, additionalProperties). */
function walkSchema(schema, path, visit, seen = new Set()) {
  if (schema === null || typeof schema !== "object" || seen.has(schema)) return;
  seen.add(schema);
  visit(schema, path);
  if (schema.properties && typeof schema.properties === "object") {
    for (const [name, sub] of Object.entries(schema.properties)) {
      walkSchema(sub, [...path, "properties", name], visit, seen);
    }
  }
  if (schema.items && typeof schema.items === "object")
    walkSchema(schema.items, [...path, "items"], visit, seen);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    walkSchema(schema.additionalProperties, [...path, "additionalProperties"], visit, seen);
  }
  for (const key of SCHEMA_CHILD_KEYS) {
    if (Array.isArray(schema[key])) {
      schema[key].forEach((sub, i) => walkSchema(sub, [...path, key, i], visit, seen));
    }
  }
}

function isObjectSchema(schema) {
  return schema.type === "object" || (schema.properties !== undefined && schema.type === undefined);
}

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

module.exports = { walk, walkSchema, isObjectSchema, HTTP_METHODS };
