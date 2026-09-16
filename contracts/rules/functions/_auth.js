// Helper compartido por ope-required-error-responses y ope-required-capabilities: qué es una
// operación autenticada. Módulo propio (no colgado de otra función) para que `checkJs` con TS 7
// pueda tipar el export de CommonJS.
"use strict";
const { get } = require("./_walk.js");

/** @import { SpectralContext } from "./_walk.js" */

/**
 * Una operación está autenticada si su `security` (propio, o el del root si no lo declara) no está vacío.
 * @param {Record<string, unknown>} operation
 * @param {SpectralContext} context
 * @returns {boolean}
 */
function isAuthenticated(operation, context) {
  const root = context.documentInventory?.resolved ?? context.document.data;
  const security = operation["security"] !== undefined ? operation["security"] : get(root, "security");
  return Array.isArray(security) && security.length > 0;
}

module.exports = { isAuthenticated };
