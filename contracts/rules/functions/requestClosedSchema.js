// ope-request-closed-schema (FR-015, constitution VII): every object of a request body, nested
// ones included, declares additionalProperties: false. Undeclared fields are rejected.
// Exception: a `type: object` that only wraps a union (`oneOf`/`anyOf`, no `properties`) cannot
// be closed there (Ajv would reject everything); each branch of the union is checked anyway.
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
          "The request schema does not declare additionalProperties: false; undeclared fields must be rejected (constitution VII). Add it on this object.",
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
