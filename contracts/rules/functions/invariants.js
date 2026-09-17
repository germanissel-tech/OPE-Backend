// ope-invariants (FR-001, FR-002; ADR-007): every `x-invariants` entry, on operations or
// schemas, has type, status, rule and description; the type is a catalogue slug (never the
// generic `unprocessable`) and the status matches the catalogue's.
"use strict";
const { loadCatalog } = require("./_catalog.js");
const { get, isObject, walk } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

const FIELDS = ["type", "status", "rule", "description"];
const GENERIC = "unprocessable";

/** @type {SpectralFunction} */
const invariants = (document, opts, context) => {
  const { types } = loadCatalog(context, get(opts, "catalog"));
  /** @type {SpectralResult[]} */
  const results = [];
  const base = context.path;
  walk(document, [], (node, nodePath) => {
    if (Array.isArray(node)) return;
    const declared = node["x-invariants"];
    if (!Array.isArray(declared)) return;
    declared.forEach((inv, i) => {
      const at = [...base, ...nodePath, "x-invariants", i];
      const where = `Invariant at ${nodePath.join("/") || "root"}#${i}`;
      if (!isObject(inv)) {
        results.push({
          message: `${where}: must be an object with type, status, rule and description.`,
          path: at,
        });
        return;
      }
      for (const field of FIELDS) {
        const value = inv[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          results.push({ message: `${where}: missing ${field}.`, path: at });
        }
      }
      const type = inv["type"];
      if (typeof type !== "string") return;
      if (type === GENERIC) {
        results.push({
          message: `${where}: 'unprocessable' is generic; declare a type of its own for the rule in contracts/problem-types.yaml.`,
          path: [...at, "type"],
        });
        return;
      }
      const entry = types.get(type);
      if (!entry) {
        results.push({
          message: `${where}: type '${type}' is not in contracts/problem-types.yaml; add it to the catalogue or fix the slug.`,
          path: [...at, "type"],
        });
        return;
      }
      const status = inv["status"];
      if (status !== undefined && Number(status) !== entry.status) {
        results.push({
          message: `${where}: status ${String(status)} does not match the catalogue's for '${type}' (${String(entry.status)}).`,
          path: [...at, "status"],
        });
      }
    });
  });
  return results;
};

module.exports = invariants;
