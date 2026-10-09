// ope-invariants (FR-001, FR-002; ADR-007): every `x-invariants` entry, on operations or
// schemas, has type, status, rule and description; the type is a catalogue slug (never the
// generic `unprocessable`) and the status matches the catalogue's. A schema invariant may say
// which body field it points at (`pointer`, ADR-044); an operation invariant has no body field
// to point at, so it must not.
"use strict";
const { loadCatalog } = require("./_catalog.js");
const { get, isObject, walk } = require("./_walk.js");

/** @import { CatalogEntry } from "./_catalog.js" */
/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

const FIELDS = ["type", "status", "rule", "description"];
const GENERIC = "unprocessable";
const METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

/**
 * The document is resolved, so a body schema also appears under its operation: only an invariant
 * declared on the operation itself (paths/<path>/<method>) depends on another resource (ADR-007)
 * and has no body field to point at.
 * @param {(string | number)[]} nodePath
 */
function isOperation(nodePath) {
  return nodePath.length === 3 && nodePath[0] === "paths" && METHODS.includes(String(nodePath[2]));
}

/**
 * The type of an invariant against the catalogue: generic, unknown, or with the wrong status.
 * @param {Record<string, unknown>} inv
 * @param {Map<string, CatalogEntry>} types
 * @param {string} where
 * @param {(string | number)[]} at
 * @returns {SpectralResult[]}
 */
function typeProblems(inv, types, where, at) {
  const type = inv["type"];
  if (typeof type !== "string") return [];
  if (type === GENERIC) {
    const message = `${where}: 'unprocessable' is generic; declare a type of its own for the rule in contracts/problem-types.yaml.`;
    return [{ message, path: [...at, "type"] }];
  }
  const entry = types.get(type);
  if (!entry) {
    const message = `${where}: type '${type}' is not in contracts/problem-types.yaml; add it to the catalogue or fix the slug.`;
    return [{ message, path: [...at, "type"] }];
  }
  const status = inv["status"];
  if (status !== undefined && Number(status) !== entry.status) {
    const message = `${where}: status ${String(status)} does not match the catalogue's for '${type}' (${String(entry.status)}).`;
    return [{ message, path: [...at, "status"] }];
  }
  return [];
}

/**
 * The field an invariant points at: optional, a non-empty path, and never on an operation.
 * @param {Record<string, unknown>} inv
 * @param {(string | number)[]} nodePath
 * @param {string} where
 * @param {(string | number)[]} at
 * @returns {SpectralResult[]}
 */
function pointerProblems(inv, nodePath, where, at) {
  const pointer = inv["pointer"];
  if (pointer === undefined) return [];
  if (typeof pointer !== "string" || pointer.trim() === "") {
    const message = `${where}: pointer must be a non-empty path relative to the request body (origins[N], graceSeconds).`;
    return [{ message, path: [...at, "pointer"] }];
  }
  if (isOperation(nodePath)) {
    const message = `${where}: pointer belongs to a schema invariant; an operation invariant has no body field to point at.`;
    return [{ message, path: [...at, "pointer"] }];
  }
  return [];
}

/**
 * Everything wrong with the i-th invariant declared at nodePath.
 * @param {unknown} inv
 * @param {{ base: (string | number)[]; types: Map<string, CatalogEntry> }} ctx the path Spectral gave and the catalogue
 * @param {(string | number)[]} nodePath
 * @param {number} i
 * @returns {SpectralResult[]}
 */
function problemsOf(inv, ctx, nodePath, i) {
  const { types } = ctx;
  const at = [...ctx.base, ...nodePath, "x-invariants", i];
  const where = `Invariant at ${nodePath.join("/") || "root"}#${i}`;
  if (!isObject(inv)) {
    return [{ message: `${where}: must be an object with type, status, rule and description.`, path: at }];
  }
  /** @type {SpectralResult[]} */
  const results = [];
  for (const field of FIELDS) {
    const value = inv[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      results.push({ message: `${where}: missing ${field}.`, path: at });
    }
  }
  const type = typeProblems(inv, types, where, at);
  // A type the catalogue does not know has no status to compare and no rule to point for.
  if (type.length > 0) return [...results, ...type];
  return [...results, ...pointerProblems(inv, nodePath, where, at)];
}

/** @type {SpectralFunction} */
const invariants = (document, opts, context) => {
  const ctx = { base: context.path, types: loadCatalog(context, get(opts, "catalog")).types };
  /** @type {SpectralResult[]} */
  const results = [];
  walk(document, [], (node, nodePath) => {
    if (Array.isArray(node)) return;
    const declared = node["x-invariants"];
    if (!Array.isArray(declared)) return;
    declared.forEach((inv, i) => {
      results.push(...problemsOf(inv, ctx, nodePath, i));
    });
  });
  return results;
};

module.exports = invariants;
