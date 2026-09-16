// ope-invariants (FR-001, FR-002; ADR-007): toda entrada de `x-invariants` —sobre operaciones o
// esquemas— tiene type, status, rule y description; el type es un slug del catálogo (nunca el
// genérico `unprocessable`) y el status coincide con el del catálogo.
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
      const where = `Invariante en ${nodePath.join("/") || "raíz"}#${i}`;
      if (!isObject(inv)) {
        results.push({
          message: `${where}: debe ser un objeto con type, status, rule y description.`,
          path: at,
        });
        return;
      }
      for (const field of FIELDS) {
        const value = inv[field];
        if (value === undefined || value === null || String(value).trim() === "") {
          results.push({ message: `${where}: falta ${field}.`, path: at });
        }
      }
      const type = inv["type"];
      if (typeof type !== "string") return;
      if (type === GENERIC) {
        results.push({
          message: `${where}: 'unprocessable' es genérico; declará un tipo propio para la regla en contracts/problem-types.yaml.`,
          path: [...at, "type"],
        });
        return;
      }
      const entry = types.get(type);
      if (!entry) {
        results.push({
          message: `${where}: el type '${type}' no está en contracts/problem-types.yaml; agregalo al catálogo o corregí el slug.`,
          path: [...at, "type"],
        });
        return;
      }
      const status = inv["status"];
      if (status !== undefined && Number(status) !== entry.status) {
        results.push({
          message: `${where}: status ${String(status)} no coincide con el del catálogo para '${type}' (${String(entry.status)}).`,
          path: [...at, "status"],
        });
      }
    });
  });
  return results;
};

module.exports = invariants;
