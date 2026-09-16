// ope-required-error-responses (FR-019): 500 siempre; 401 si la operación está autenticada
// (security propio no vacío, o heredado del root); 400 y 422 si tiene requestBody.
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
  const id = String(operation["operationId"] ?? "(sin operationId)");
  return required
    .filter((code) => !declared.includes(code))
    .map((code) => ({
      message: `La operación ${id} debe declarar la respuesta ${code} como Problem Details (FR-019). Agregá "${code}" con $ref a components/responses.`,
      path: [...context.path, "responses"],
    }));
};

module.exports = requiredErrorResponses;
