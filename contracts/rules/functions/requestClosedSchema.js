// ope-request-closed-schema (FR-015, constitución VII): todo objeto de un request body, incluidos
// los anidados, declara additionalProperties: false. Los campos no declarados se rechazan.
// Excepción: un `type: object` que sólo envuelve una unión (`oneOf`/`anyOf`, sin `properties`)
// no puede cerrarse ahí (Ajv rechazaría todo); cada rama de la unión se verifica igual.
"use strict";
const { walkSchema, isObjectSchema } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

/** @type {SpectralFunction} */
const requestClosedSchema = (schema, _opts, context) => {
  /** @type {SpectralResult[]} */
  const results = [];
  walkSchema(schema, context.path, (node, nodePath) => {
    if (isObjectSchema(node) && node["additionalProperties"] !== false && !isUnionWrapper(node)) {
      results.push({
        message:
          "El esquema de request no declara additionalProperties: false; los campos no declarados deben rechazarse (constitución VII). Agregalo en este objeto.",
        path: nodePath,
      });
    }
  });
  return results;
};

/** @param {Record<string, unknown>} node */
function isUnionWrapper(node) {
  return node["properties"] === undefined && (Array.isArray(node["oneOf"]) || Array.isArray(node["anyOf"]));
}

module.exports = requestClosedSchema;
