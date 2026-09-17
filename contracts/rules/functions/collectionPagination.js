// ope-collection-pagination (FR-031; ADR-020): a GET of the portal whose path does not end in a
// parameter reads a collection: it declares `x-collection: true`, the four common parameters
// by $ref (cursor, limit, from, to) and a 200 whose schema is a `<X>Page` envelope.
"use strict";
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parse } = require("yaml");
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult, SpectralContext } from "./_walk.js" */

const PORTAL_TAG = "portal";
const COMMON_PARAMETERS = ["cursor", "limit", "from", "to"];

/** The component name a $ref points to: `#/components/parameters/cursor` or `../components/parameters/cursor.yaml`. */
/** @param {unknown} ref */
const refName = (ref) =>
  typeof ref === "string" ? (ref.split("/").pop() ?? "").replace(/\.ya?ml$/, "") : "";

/**
 * @param {unknown} parameters
 * @returns {string[]} names of the parameters referenced from components/parameters
 */
function referencedParameterNames(parameters) {
  if (!Array.isArray(parameters)) return [];
  return parameters.map((p) => refName(get(p, "$ref"))).filter((name) => name !== "");
}

/**
 * The rule runs on the unresolved document (to see the $refs); a path item of the multi-file
 * contract is itself a $ref to `paths/<x>.yaml`, read from disk relative to the document.
 * @param {Record<string, unknown>} pathItem
 * @param {SpectralContext} context
 * @returns {Record<string, unknown>}
 */
function pathItemOf(pathItem, context) {
  const ref = pathItem["$ref"];
  const source = context.document.source;
  if (typeof ref !== "string" || ref.startsWith("#") || typeof source !== "string") return pathItem;
  const loaded = /** @type {unknown} */ (
    parse(readFileSync(path.resolve(path.dirname(source), ref), "utf8"))
  );
  return isObject(loaded) ? loaded : pathItem;
}

/** @type {SpectralFunction} */
const collectionPagination = (input, _opts, context) => {
  if (!isObject(input)) return [];
  const pathItem = pathItemOf(input, context);
  const route = String(context.path[context.path.length - 1] ?? "");
  const operation = pathItem["get"];
  if (!isObject(operation) || /\}$/.test(route)) return [];
  const tags = operation["tags"];
  if (!Array.isArray(tags) || !tags.includes(PORTAL_TAG)) return [];
  const id = String(operation["operationId"] ?? "(no operationId)");
  const at = [...context.path, "get"];
  /** @type {SpectralResult[]} */
  const results = [];
  if (operation["x-collection"] !== true) {
    results.push({
      message: `Operation ${id} reads a collection of the portal and must declare x-collection: true (ADR-020).`,
      path: at,
    });
  }
  const names = referencedParameterNames(operation["parameters"]);
  const missing = COMMON_PARAMETERS.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    results.push({
      message: `Operation ${id} must reference the common pagination parameters by $ref; missing: ${missing.join(", ")}.`,
      path: [...at, "parameters"],
    });
  }
  const schemaRef = get(
    get(get(get(get(operation, "responses"), "200"), "content"), "application/json"),
    "schema",
  );
  if (!/Page$/.test(refName(get(schemaRef, "$ref")))) {
    results.push({
      message: `Operation ${id}: the 200 response must be a $ref to a <X>Page envelope (items + nextCursor).`,
      path: [...at, "responses", "200"],
    });
  }
  return results;
};

module.exports = collectionPagination;
