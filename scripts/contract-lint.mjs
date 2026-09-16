// contract:lint — estructura (Redocly) + estilo y reglas de OPE (Spectral).
// Falla ante cualquier error o warning (FR-010, FR-011, FR-012..FR-019).
import path from "node:path";
import { contractRoot, repoRoot, runCli } from "./lib.mjs";

const redocly = runCli("redocly", ["lint", contractRoot, "--config", path.join(repoRoot, "redocly.yaml")]);
if (redocly !== 0) {
  console.error("contract:lint — Redocly encontró errores estructurales.");
  process.exit(redocly);
}
const spectral = runCli("spectral", [
  "lint",
  contractRoot,
  "--ruleset",
  path.join(repoRoot, "contracts", ".spectral.yaml"),
  "--fail-severity",
  "warn",
]);
if (spectral !== 0) {
  console.error("contract:lint — Spectral encontró violaciones de las reglas del contrato.");
  process.exit(spectral);
}
