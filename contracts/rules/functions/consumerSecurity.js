// ope-consumer-security (FR-012; ADR-020): the tag of an operation fixes its consumer and the
// consumer fixes its security scheme. A public consumer demands `security: []`; any other
// demands exactly one requirement with the consumer's scheme and no scopes.
"use strict";
const { consumerOf, loadApiMap } = require("./_apiMap.js");
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

/** @type {SpectralFunction} */
const consumerSecurity = (operation, opts, context) => {
  if (!isObject(operation)) return [];
  const map = loadApiMap(context, get(opts, "map"));
  const consumer = consumerOf(map, operation);
  const id = String(operation["operationId"] ?? "(no operationId)");
  const at = [...context.path, "security"];
  if (!consumer) {
    return [
      {
        message: `Operation ${id}: its tag belongs to no consumer of the contract map.`,
        path: [...context.path, "tags"],
      },
    ];
  }
  const security = operation["security"];
  if (consumer.scheme === null) {
    return Array.isArray(security) && security.length === 0
      ? []
      : [
          {
            message: `Operation ${id} is public (consumer ${consumer.name}) and must declare security: [].`,
            path: at,
          },
        ];
  }
  const requirement = Array.isArray(security) && security.length === 1 ? security[0] : undefined;
  const scopes = isObject(requirement) ? requirement[consumer.scheme] : undefined;
  const exact =
    isObject(requirement) &&
    Object.keys(requirement).length === 1 &&
    Array.isArray(scopes) &&
    scopes.length === 0;
  if (exact) return [];
  return [
    {
      message: `Operation ${id} belongs to consumer ${consumer.name} and must declare security: [{ ${consumer.scheme}: [] }] (one requirement, that scheme, no scopes).`,
      path: at,
    },
  ];
};

module.exports = consumerSecurity;
