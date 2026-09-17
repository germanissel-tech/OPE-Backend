// ope-required-capabilities (FR-031; ADR-020): every authenticated operation declares the
// capability it demands (`x-required-capabilities`, shape resource:action, within the vocabulary
// of its consumer in the contract map); a public operation declares none.
"use strict";
const { consumerOf, loadApiMap } = require("./_apiMap.js");
const { isAuthenticated } = require("./_auth.js");
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

const CAPABILITY = /^[a-z][a-z-]*:[a-z][a-z-]*$/;

/** @type {SpectralFunction} */
const requiredCapabilities = (operation, opts, context) => {
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
  const malformed = caps
    .filter((c) => typeof c !== "string" || !CAPABILITY.test(c))
    .map((c) => ({
      message: `Operation ${id} declares a capability with an invalid format '${String(c)}'; use lowercase resource:action (events:write).`,
      path: at,
    }));
  if (malformed.length > 0) return malformed;
  const consumer = consumerOf(loadApiMap(context, get(opts, "map")), operation);
  if (!consumer) return [];
  return caps
    .filter((c) => !consumer.capabilities.includes(String(c)))
    .map((c) => ({
      message: `Operation ${id} declares capability '${String(c)}', outside the vocabulary of consumer ${consumer.name} (${consumer.capabilities.join(", ")}).`,
      path: at,
    }));
};

module.exports = requiredCapabilities;
