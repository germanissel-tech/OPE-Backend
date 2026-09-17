// ope-outcomes-idempotency (FR-021; ADR-020): every `outcomes` operation (server-to-server
// notification) declares `x-idempotency: { key, first, repeat }` — the key is a required
// property of the request body, first and repeat are two distinct declared 2xx responses — and
// a 409 response (same identity, different content).
"use strict";
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult, SpectralContext } from "./_walk.js" */

const OUTCOMES_TAG = "outcomes";

/**
 * Resolves a `#/components/schemas/X` reference in the document; inline schemas come back as is.
 * @param {unknown} schema
 * @param {SpectralContext} context
 * @returns {unknown}
 */
function resolveSchema(schema, context) {
  const ref = get(schema, "$ref");
  if (typeof ref !== "string") return schema;
  const root = context.documentInventory?.resolved ?? context.document.data;
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((node, key) => get(node, key), /** @type {unknown} */ (root));
}

/**
 * @param {unknown} operation
 * @param {SpectralContext} context
 * @returns {string[]} required properties of the JSON request body
 */
function requiredBodyProperties(operation, context) {
  const media = get(get(get(operation, "requestBody"), "content"), "application/json");
  const schema = resolveSchema(get(media, "schema"), context);
  const required = get(schema, "required");
  return Array.isArray(required) ? required.map(String) : [];
}

/** @type {SpectralFunction} */
const outcomesIdempotency = (operation, _opts, context) => {
  if (!isObject(operation)) return [];
  const tags = operation["tags"];
  if (!Array.isArray(tags) || !tags.includes(OUTCOMES_TAG)) return [];
  const id = String(operation["operationId"] ?? "(no operationId)");
  const at = [...context.path, "x-idempotency"];
  const ext = operation["x-idempotency"];
  /** @type {SpectralResult[]} */
  const results = [];
  if (!isObject(ext)) {
    return [
      {
        message: `Operation ${id} is a server-to-server notification and must declare x-idempotency: { key, first, repeat } (ADR-020).`,
        path: at,
      },
    ];
  }
  const key = ext["key"];
  const first = ext["first"];
  const repeat = ext["repeat"];
  const responses = get(operation, "responses");
  const declared = /** @param {unknown} code */ (code) =>
    typeof code === "string" && /^2\d\d$/.test(code) && isObject(responses) && responses[code] !== undefined;
  if (typeof key !== "string" || !requiredBodyProperties(operation, context).includes(key)) {
    results.push({
      message: `Operation ${id}: x-idempotency.key must name a required property of the request body.`,
      path: [...at, "key"],
    });
  }
  if (!declared(first))
    results.push({
      message: `Operation ${id}: x-idempotency.first must be a declared 2xx response.`,
      path: [...at, "first"],
    });
  if (!declared(repeat))
    results.push({
      message: `Operation ${id}: x-idempotency.repeat must be a declared 2xx response.`,
      path: [...at, "repeat"],
    });
  if (declared(first) && declared(repeat) && first === repeat) {
    results.push({
      message: `Operation ${id}: x-idempotency.first and repeat must be different responses.`,
      path: [...at, "repeat"],
    });
  }
  if (!isObject(responses) || responses["409"] === undefined) {
    results.push({
      message: `Operation ${id} must declare a 409 response (idempotency-conflict: same identity, different content).`,
      path: [...context.path, "responses"],
    });
  }
  return results;
};

module.exports = outcomesIdempotency;
