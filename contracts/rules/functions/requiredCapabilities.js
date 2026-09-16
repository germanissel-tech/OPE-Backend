// ope-required-capabilities (FR-031): toda operación autenticada declara la capacidad que exige
// (`x-required-capabilities`, forma recurso:accion); una operación pública no la declara.
"use strict";
const { isObject } = require("./_walk.js");
const { isAuthenticated } = require("./requiredErrorResponses.js");

/** @import { SpectralFunction } from "./_walk.js" */

const CAPABILITY = /^[a-z][a-z-]*:[a-z][a-z-]*$/;

/** @type {SpectralFunction} */
const requiredCapabilities = (operation, _opts, context) => {
  if (!isObject(operation)) return [];
  const authenticated = isAuthenticated(operation, context);
  const id = String(operation["operationId"] ?? "(sin operationId)");
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

module.exports = requiredCapabilities;
