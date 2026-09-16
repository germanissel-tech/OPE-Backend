// ope-no-generic-422 (FR-004; ADR-001, ADR-007): toda respuesta 422 de una operación documenta,
// con sus ejemplos, exactamente qué invariante la produce: ningún ejemplo usa el tipo genérico
// `unprocessable` y todos corresponden a una invariante declarada en la operación o en el
// schema de su request body.
"use strict";
const { walkSchema } = require("./_walk.js");
const { loadCatalog } = require("./_catalog.js");

function exampleTypes(media) {
  const out = [];
  if (!media || typeof media !== "object") return out;
  if (media.example && typeof media.example === "object") out.push(media.example.type);
  if (media.examples && typeof media.examples === "object") {
    for (const ex of Object.values(media.examples)) {
      if (ex && typeof ex === "object" && ex.value && typeof ex.value === "object") out.push(ex.value.type);
    }
  }
  return out.filter((t) => typeof t === "string");
}

function declaredInvariants(operation) {
  const slugs = new Set();
  const collect = (node) => {
    if (node && Array.isArray(node["x-invariants"])) {
      for (const inv of node["x-invariants"]) if (inv && typeof inv.type === "string") slugs.add(inv.type);
    }
  };
  collect(operation);
  const content = operation.requestBody && operation.requestBody.content;
  if (content && typeof content === "object") {
    for (const media of Object.values(content)) {
      if (media && media.schema) walkSchema(media.schema, [], (schema) => collect(schema));
    }
  }
  return slugs;
}

module.exports = (operation, opts, context) => {
  if (!operation || typeof operation !== "object") return [];
  const response = operation.responses && operation.responses["422"];
  if (!response) return [];
  const { namespace } = loadCatalog(context, opts && opts.catalog);
  const id = operation.operationId || "(sin operationId)";
  const at = [...context.path, "responses", "422"];
  const media = response.content && response.content["application/problem+json"];
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
