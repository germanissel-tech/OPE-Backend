// ope-no-merchant-id-in-request (FR-017, constitución V): merchantId se deriva de la credencial.
// Nunca entra por path, query, header, cookie ni request body. Las respuestas no se revisan.
"use strict";
const { get, isObject, walkSchema, HTTP_METHODS } = require("./_walk.js");

/** @import { JsonPath, SpectralFunction, SpectralResult } from "./_walk.js" */

/** @param {unknown} name */
const normalize = (name) => String(name).toLowerCase().replace(/[_-]/g, "");
// endsWith: atrapa también X-Merchant-Id y variantes prefijadas (fail-closed).
/** @param {unknown} name */
const isMerchantId = (name) => normalize(name).endsWith("merchantid");

/**
 * @param {unknown} params
 * @param {JsonPath} basePath
 * @param {SpectralResult[]} results
 */
function checkParameters(params, basePath, results) {
  if (!Array.isArray(params)) return;
  params.forEach((param, i) => {
    const name = get(param, "name");
    if (name !== undefined && isMerchantId(name)) {
      results.push({
        message: `'${String(name)}' no puede entrar por el request: merchantId se deriva de la credencial (constitución V). Quitalo del parámetro ${String(get(param, "in"))}.`,
        path: [...basePath, i, "name"],
      });
    }
  });
}

/**
 * @param {unknown} requestBody
 * @param {JsonPath} basePath
 * @param {SpectralResult[]} results
 */
function checkBody(requestBody, basePath, results) {
  const content = get(requestBody, "content");
  if (!isObject(content)) return;
  for (const [mediaType, media] of Object.entries(content)) {
    const schema = get(media, "schema");
    if (!schema) continue;
    walkSchema(schema, [...basePath, "content", mediaType, "schema"], (node, schemaPath) => {
      const properties = node["properties"];
      if (!isObject(properties)) return;
      for (const name of Object.keys(properties)) {
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

/** @type {SpectralFunction} */
const noMerchantIdInRequest = (document, _opts, context) => {
  /** @type {SpectralResult[]} */
  const results = [];
  const base = context.path;
  const paths = get(document, "paths");
  if (!isObject(paths)) return results;
  for (const [route, item] of Object.entries(paths)) {
    if (!isObject(item)) continue;
    checkParameters(item["parameters"], [...base, "paths", route, "parameters"], results);
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!isObject(op)) continue;
      checkParameters(op["parameters"], [...base, "paths", route, method, "parameters"], results);
      checkBody(op["requestBody"], [...base, "paths", route, method, "requestBody"], results);
    }
  }
  return results;
};

module.exports = noMerchantIdInRequest;
