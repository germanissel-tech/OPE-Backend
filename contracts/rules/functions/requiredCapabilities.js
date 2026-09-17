// ope-required-capabilities (FR-031): every authenticated operation declares the capability it
// demands (`x-required-capabilities`, shape resource:action); a public operation declares none.
"use strict";
const { isAuthenticated } = require("./_auth.js");
const { isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

const CAPABILITY = /^[a-z][a-z-]*:[a-z][a-z-]*$/;

/** @type {SpectralFunction} */
const requiredCapabilities = (operation, _opts, context) => {
  if (!isObject(operation)) return [];
  const authenticated = isAuthenticated(operation, context);
  const id = String(operation["operationId"] ?? "(no operationId)");
  const caps = operation["x-required-capabilities"];
  const at = [...context.path, "x-required-capabilities"];

  if (!authenticated) {
    if (caps !== undefined) {
      return [
        {
          message: `Operation ${id} is public (security: []) and must not declare x-required-capabilities.`,
          path: at,
        },
      ];
    }
    return [];
  }
  if (!Array.isArray(caps) || caps.length === 0) {
    return [
      {
        message: `Operation ${id} is authenticated and declares no x-required-capabilities (non-empty list of resource:action capabilities, for example events:write).`,
        path: context.path,
      },
    ];
  }
  return caps
    .filter((c) => typeof c !== "string" || !CAPABILITY.test(c))
    .map((c) => ({
      message: `Operation ${id} declares a capability with an invalid format '${String(c)}'; use lowercase resource:action (events:write).`,
      path: at,
    }));
};

module.exports = requiredCapabilities;
