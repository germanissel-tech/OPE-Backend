// Helper shared by ope-required-error-responses and ope-required-capabilities: what an
// authenticated operation is. A module of its own (not hung off another function) so that
// `checkJs` with TS 7 can type the CommonJS export.
"use strict";
const { get } = require("./_walk.js");

/** @import { SpectralContext } from "./_walk.js" */

/**
 * An operation is authenticated if its `security` (its own, or the root's if it declares none) is not empty.
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
