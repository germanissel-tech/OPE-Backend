// ope-no-merchant-id-in-request (FR-017, constitution V): merchantId is derived from the credential.
// It never comes in through path, query, header, cookie or request body. Single exception
// (constitution V amendment, ADR-020): a path parameter of an operation of the `admin` consumer,
// whose credential belongs to an operator and not to a merchant. Responses are not checked.
"use strict";
const { consumerOf, loadApiMap } = require("./_apiMap.js");
const { get, isObject, walkSchema, HTTP_METHODS } = require("./_walk.js");

/** @import { JsonPath, SpectralFunction, SpectralResult } from "./_walk.js" */

/** @param {unknown} name */
const normalize = (name) => String(name).toLowerCase().replace(/[_-]/g, "");
// endsWith: also catches X-Merchant-Id and prefixed variants (fail-closed).
/** @param {unknown} name */
const isMerchantId = (name) => normalize(name).endsWith("merchantid");

/**
 * @param {unknown} params
 * @param {JsonPath} basePath
 * @param {SpectralResult[]} results
 * @param {boolean} [adminPath] the operation belongs to the admin consumer: `merchantId` in the path is allowed
 */
function checkParameters(params, basePath, results, adminPath = false) {
  if (!Array.isArray(params)) return;
  params.forEach((param, i) => {
    const name = get(param, "name");
    if (adminPath && get(param, "in") === "path") return;
    if (name !== undefined && isMerchantId(name)) {
      results.push({
        message: `'${String(name)}' cannot come in through the request: merchantId is derived from the credential (constitution V). Remove it from the ${String(get(param, "in"))} parameter.`,
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
            message: `'${name}' cannot come in through the request: merchantId is derived from the credential (constitution V). Remove it from the body.`,
            path: [...schemaPath, "properties", name],
          });
        }
      }
    });
  }
}

/** @type {SpectralFunction} */
const noMerchantIdInRequest = (document, opts, context) => {
  /** @type {SpectralResult[]} */
  const results = [];
  const base = context.path;
  const paths = get(document, "paths");
  if (!isObject(paths)) return results;
  const map = loadApiMap(context, get(opts, "map"));
  for (const [route, item] of Object.entries(paths)) {
    if (!isObject(item)) continue;
    // Path-item parameters apply to every operation: allowed only if all of them are admin.
    const operations = HTTP_METHODS.map((m) => item[m]).filter(isObject);
    const allAdmin = operations.length > 0 && operations.every((op) => consumerOf(map, op)?.name === "admin");
    checkParameters(item["parameters"], [...base, "paths", route, "parameters"], results, allAdmin);
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!isObject(op)) continue;
      const admin = consumerOf(map, op)?.name === "admin";
      checkParameters(op["parameters"], [...base, "paths", route, method, "parameters"], results, admin);
      checkBody(op["requestBody"], [...base, "paths", route, method, "requestBody"], results);
    }
  }
  return results;
};

module.exports = noMerchantIdInRequest;
