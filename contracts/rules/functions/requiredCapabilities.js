// ope-required-capabilities (FR-031): toda operación autenticada declara la capacidad que exige
// (`x-required-capabilities`, forma recurso:accion); una operación pública no la declara.
"use strict";

const CAPABILITY = /^[a-z][a-z-]*:[a-z][a-z-]*$/;

module.exports = (operation, _opts, context) => {
  if (!operation || typeof operation !== "object") return [];
  const root =
    (context.documentInventory && context.documentInventory.resolved) || context.document.data || {};
  const security = operation.security !== undefined ? operation.security : root.security;
  const authenticated = Array.isArray(security) && security.length > 0;
  const id = operation.operationId || "(sin operationId)";
  const caps = operation["x-required-capabilities"];
  const at = [...context.path, "x-required-capabilities"];

  if (!authenticated) {
    if (caps !== undefined) {
      return [
        {
          message: `La operación ${id} es pública (security: []) y no debe declarar x-required-capabilities.`,
          path: at,
        },
      ];
    }
    return [];
  }
  if (!Array.isArray(caps) || caps.length === 0) {
    return [
      {
        message: `La operación ${id} está autenticada y no declara x-required-capabilities (lista no vacía de capacidades recurso:accion, por ejemplo events:write).`,
        path: context.path,
      },
    ];
  }
  return caps
    .filter((c) => typeof c !== "string" || !CAPABILITY.test(c))
    .map((c) => ({
      message: `La operación ${id} declara una capacidad con formato inválido '${String(c)}'; usá recurso:accion en minúsculas (events:write).`,
      path: at,
    }));
};
