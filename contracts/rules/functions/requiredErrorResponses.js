// ope-required-error-responses (FR-019): 500 always; 401 if the operation is authenticated
// (non-empty security of its own, or inherited from the root); 400 and 422 if it has a requestBody.
"use strict";
const { isAuthenticated } = require("./_auth.js");
const { isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

/** @type {SpectralFunction} */
const requiredErrorResponses = (operation, _opts, context) => {
  if (!isObject(operation)) return [];
  const required = ["500"];
  if (isAuthenticated(operation, context)) required.push("401");
  if (operation["requestBody"] !== undefined) required.push("400", "422");
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
