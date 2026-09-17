// contract:lint — structure (Redocly) + style and OPE rules (Spectral).
// Fails on any error or warning (FR-010, FR-011, FR-012..FR-019).
import path from "node:path";
import { contractRoot, repoRoot, runCli } from "./lib.mjs";

const redocly = runCli("redocly", ["lint", contractRoot, "--config", path.join(repoRoot, "redocly.yaml")]);
if (redocly !== 0) {
  console.error("contract:lint — Redocly found structural errors.");
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
  console.error("contract:lint — Spectral found violations of the contract rules.");
  process.exit(spectral);
}
