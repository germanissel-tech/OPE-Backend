// ope-platform-signature-headers (feature 013; ADR-029): every operation secured with
// `platformKey` declares the two signature headers as parameters (`X-OPE-Timestamp` and
// `X-OPE-Signature`), so the surface a signing adapter needs is visible on every operation.
"use strict";
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult, SpectralContext } from "./_walk.js" */

const SCHEME = "platformKey";
const REQUIRED_HEADERS = ["X-OPE-Timestamp", "X-OPE-Signature"];

/**
 * Resolves a `#/components/parameters/X` reference in the document; inline parameters come back as is.
 * @param {unknown} parameter
 * @param {SpectralContext} context
 * @returns {unknown}
 */
function resolveParameter(parameter, context) {
  const ref = get(parameter, "$ref");
  if (typeof ref !== "string") return parameter;
  const root = context.documentInventory?.resolved ?? context.document.data;
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((node, key) => get(node, key), /** @type {unknown} */ (root));
}

/**
 * @param {unknown} operation
 * @returns {boolean} whether the operation requires the platformKey scheme
 */
function usesPlatformKey(operation) {
  const security = get(operation, "security");
  return Array.isArray(security) && security.some((req) => isObject(req) && SCHEME in req);
}

/** @type {SpectralFunction} */
const platformSignatureHeaders = (operation, _opts, context) => {
  if (!isObject(operation) || !usesPlatformKey(operation)) return [];
  const id = String(operation["operationId"] ?? "(no operationId)");
  const parameters = operation["parameters"];
  const declared = (Array.isArray(parameters) ? parameters : [])
    .map((p) => resolveParameter(p, context))
    .filter((p) => isObject(p) && p["in"] === "header")
    .map((p) => String(get(p, "name")).toLowerCase());
  /** @type {SpectralResult[]} */
  const results = [];
  for (const name of REQUIRED_HEADERS) {
    if (!declared.includes(name.toLowerCase())) {
      results.push({
        message: `Operation ${id} is secured with ${SCHEME} and must declare the ${name} header parameter (ADR-029).`,
        path: [...context.path, "parameters"],
      });
    }
  }
  return results;
};

module.exports = platformSignatureHeaders;
