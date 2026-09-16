// ope-invariants (FR-001, FR-002; ADR-007): toda entrada de `x-invariants` —sobre operaciones o
// esquemas— tiene type, status, rule y description; el type es un slug del catálogo (nunca el
// genérico `unprocessable`) y el status coincide con el del catálogo.
"use strict";
const { loadCatalog } = require("./_catalog.js");
const { walk } = require("./_walk.js");

const FIELDS = ["type", "status", "rule", "description"];
const GENERIC = "unprocessable";

module.exports = (document, opts, context) => {
  const { types } = loadCatalog(context, opts && opts.catalog);
  const results = [];
  const base = context.path;
  walk(document, [], (node, nodePath) => {
    if (Array.isArray(node) || !Array.isArray(node["x-invariants"])) return;
    node["x-invariants"].forEach((inv, i) => {
      const at = [...base, ...nodePath, "x-invariants", i];
      const where = `Invariante en ${nodePath.join("/") || "raíz"}#${i}`;
      if (!inv || typeof inv !== "object") {
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
      if (typeof inv.type !== "string") return;
      if (inv.type === GENERIC) {
        results.push({
          message: `${where}: 'unprocessable' es genérico; declará un tipo propio para la regla en contracts/problem-types.yaml.`,
          path: [...at, "type"],
        });
        return;
      }
      const entry = types.get(inv.type);
      if (!entry) {
        results.push({
          message: `${where}: el type '${inv.type}' no está en contracts/problem-types.yaml; agregalo al catálogo o corregí el slug.`,
          path: [...at, "type"],
        });
        return;
      }
      if (inv.status !== undefined && Number(inv.status) !== entry.status) {
        results.push({
          message: `${where}: status ${inv.status} no coincide con el del catálogo para '${inv.type}' (${entry.status}).`,
          path: [...at, "status"],
        });
      }
    });
  });
  return results;
};
