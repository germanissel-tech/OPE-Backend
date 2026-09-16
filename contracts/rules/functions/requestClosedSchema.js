// ope-request-closed-schema (FR-015, constitución VII): todo objeto de un request body, incluidos
// los anidados, declara additionalProperties: false. Los campos no declarados se rechazan.
"use strict";
const { walkSchema, isObjectSchema } = require("./_walk.js");

module.exports = (schema, _opts, context) => {
  const results = [];
  walkSchema(schema, context.path, (node, nodePath) => {
    if (isObjectSchema(node) && node.additionalProperties !== false) {
      results.push({
        message:
          "El esquema de request no declara additionalProperties: false; los campos no declarados deben rechazarse (constitución VII). Agregalo en este objeto.",
        path: nodePath,
      });
    }
  });
  return results;
};
