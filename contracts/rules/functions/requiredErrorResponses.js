// ope-required-error-responses (FR-019): 500 siempre; 401 si la operación está autenticada
// (security propio no vacío, o heredado del root); 400 y 422 si tiene requestBody.
"use strict";

module.exports = (operation, _opts, context) => {
  if (!operation || typeof operation !== "object") return [];
  const root =
    (context.documentInventory && context.documentInventory.resolved) || context.document.data || {};
  const security = operation.security !== undefined ? operation.security : root.security;
  const authenticated = Array.isArray(security) && security.length > 0;
  const required = ["500"];
  if (authenticated) required.push("401");
  if (operation.requestBody !== undefined) required.push("400", "422");
  const declared =
    operation.responses && typeof operation.responses === "object" ? Object.keys(operation.responses) : [];
  const id = operation.operationId || "(sin operationId)";
  return required
    .filter((code) => !declared.includes(code))
    .map((code) => ({
      message: `La operación ${id} debe declarar la respuesta ${code} como Problem Details (FR-019). Agregá "${code}" con $ref a components/responses.`,
      path: [...context.path, "responses"],
    }));
};
