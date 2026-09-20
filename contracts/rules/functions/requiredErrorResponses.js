// ope-required-error-responses (FR-019): 500 always; 401 if the operation is authenticated
// (non-empty security of its own, or inherited from the root); 400 if it has a requestBody; 422
// if, besides the body, it declares an invariant (on the operation or on the body's schema,
// ADR-007) — a 422 without an invariant to name is what ope-no-generic-422 forbids (feature 017).
"use strict";
const { isAuthenticated } = require("./_auth.js");
const { isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

/**
 * Whether the operation or the schema of any media type of its body declares x-invariants.
 * @param {Record<string, unknown>} operation
 * @returns {boolean}
 */
function declaresInvariants(operation) {
  const own = operation["x-invariants"];
  if (Array.isArray(own) && own.length > 0) return true;
  const body = operation["requestBody"];
  const content = isObject(body) ? body["content"] : undefined;
  if (!isObject(content)) return false;
  return Object.values(content).some((media) => {
    const schema = isObject(media) ? media["schema"] : undefined;
    const invariants = isObject(schema) ? schema["x-invariants"] : undefined;
    return Array.isArray(invariants) && invariants.length > 0;
  });
}

/** @type {SpectralFunction} */
const requiredErrorResponses = (operation, _opts, context) => {
  if (!isObject(operation)) return [];
  const required = ["500"];
  if (isAuthenticated(operation, context)) required.push("401");
  if (operation["requestBody"] !== undefined) {
    required.push("400");
    if (declaresInvariants(operation)) required.push("422");
  }
  const responses = operation["responses"];
  const declared = isObject(responses) ? Object.keys(responses) : [];
  const id = String(operation["operationId"] ?? "(no operationId)");
  return required
    .filter((code) => !declared.includes(code))
    .map((code) => ({
      message: `Operation ${id} must declare the ${code} response as Problem Details (FR-019). Add "${code}" with a $ref to components/responses.`,
      path: [...context.path, "responses"],
    }));
};

module.exports = requiredErrorResponses;
