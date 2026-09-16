// ope-no-generic-422 (FR-004; ADR-001, ADR-007): toda respuesta 422 de una operación documenta,
// con sus ejemplos, exactamente qué invariante la produce: ningún ejemplo usa el tipo genérico
// `unprocessable` y todos corresponden a una invariante declarada en la operación o en el
// schema de su request body.
"use strict";
const { loadCatalog } = require("./_catalog.js");
const { get, isObject, walkSchema } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

/**
 * @param {unknown} media
 * @returns {string[]}
 */
function exampleTypes(media) {
  /** @type {unknown[]} */
  const out = [];
  if (!isObject(media)) return [];
  const example = media["example"];
  if (isObject(example)) out.push(example["type"]);
  const examples = media["examples"];
  if (isObject(examples)) {
    for (const ex of Object.values(examples)) {
      const value = get(ex, "value");
      if (isObject(value)) out.push(value["type"]);
    }
  }
  return out.filter((t) => typeof t === "string");
}

/**
 * @param {Record<string, unknown>} operation
 * @returns {Set<string>}
 */
function declaredInvariants(operation) {
  /** @type {Set<string>} */
  const slugs = new Set();
  /** @param {unknown} node */
  const collect = (node) => {
    const declared = get(node, "x-invariants");
    if (!Array.isArray(declared)) return;
    for (const inv of declared) {
      const type = get(inv, "type");
      if (typeof type === "string") slugs.add(type);
    }
  };
  collect(operation);
  const content = get(operation["requestBody"], "content");
  if (isObject(content)) {
    for (const media of Object.values(content)) {
      const schema = get(media, "schema");
      if (schema) walkSchema(schema, [], (node) => collect(node));
    }
  }
  return slugs;
}

/** @type {SpectralFunction} */
const noGeneric422 = (operation, opts, context) => {
  if (!isObject(operation)) return [];
  const response = get(operation["responses"], "422");
  if (!response) return [];
  const { namespace } = loadCatalog(context, get(opts, "catalog"));
  const id = String(operation["operationId"] ?? "(sin operationId)");
  const at = [...context.path, "responses", "422"];
  const media = get(get(response, "content"), "application/problem+json");
  const types = exampleTypes(media);
  if (types.length === 0) {
    return [
      {
        message: `La respuesta 422 de ${id} debe tener al menos un ejemplo con el type de la invariante que la produce.`,
        path: at,
      },
    ];
  }
  const declared = declaredInvariants(operation);
  /** @type {SpectralResult[]} */
  const results = [];
  for (const type of types) {
    const slug = type.startsWith(namespace) ? type.slice(namespace.length) : type;
    if (slug === "unprocessable") {
      results.push({
        message: `La respuesta 422 de ${id} usa el tipo genérico 'unprocessable'; declará la invariante (x-invariants) con su tipo propio y usalo en el ejemplo.`,
        path: at,
      });
    } else if (!declared.has(slug)) {
      results.push({
        message: `La respuesta 422 de ${id} nombra '${slug}' pero ninguna x-invariants de la operación ni de su request body lo declara.`,
        path: at,
      });
    }
  }
  return results;
};

module.exports = noGeneric422;
