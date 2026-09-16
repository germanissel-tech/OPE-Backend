// ope-no-merchant-id-in-request (FR-017, constitución V): merchantId se deriva de la credencial.
// Nunca entra por path, query, header, cookie ni request body. Las respuestas no se revisan.
"use strict";
const { walkSchema, HTTP_METHODS } = require("./_walk.js");

const normalize = (name) => String(name).toLowerCase().replace(/[_-]/g, "");
// endsWith: atrapa también X-Merchant-Id y variantes prefijadas (fail-closed).
const isMerchantId = (name) => normalize(name).endsWith("merchantid");

function checkParameters(params, basePath, results) {
  if (!Array.isArray(params)) return;
  params.forEach((param, i) => {
    if (param && isMerchantId(param.name)) {
      results.push({
        message: `'${param.name}' no puede entrar por el request: merchantId se deriva de la credencial (constitución V). Quitalo del parámetro ${param.in}.`,
        path: [...basePath, i, "name"],
      });
    }
  });
}

function checkBody(requestBody, basePath, results) {
  if (!requestBody || typeof requestBody.content !== "object") return;
  for (const [mediaType, media] of Object.entries(requestBody.content)) {
    if (!media || !media.schema) continue;
    walkSchema(media.schema, [...basePath, "content", mediaType, "schema"], (schema, schemaPath) => {
      if (!schema.properties || typeof schema.properties !== "object") return;
      for (const name of Object.keys(schema.properties)) {
        if (isMerchantId(name)) {
          results.push({
            message: `'${name}' no puede entrar por el request: merchantId se deriva de la credencial (constitución V). Quitalo del body.`,
            path: [...schemaPath, "properties", name],
          });
        }
      }
    });
  }
}

module.exports = (document, _opts, context) => {
  const results = [];
  const base = context.path;
  const paths = document && document.paths;
  if (!paths || typeof paths !== "object") return results;
  for (const [route, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    checkParameters(item.parameters, [...base, "paths", route, "parameters"], results);
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op || typeof op !== "object") continue;
      checkParameters(op.parameters, [...base, "paths", route, method, "parameters"], results);
      checkBody(op.requestBody, [...base, "paths", route, method, "requestBody"], results);
    }
  }
  return results;
};
