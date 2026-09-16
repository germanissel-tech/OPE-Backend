// contract:bundle — resuelve el contrato multi-archivo en contracts/dist/openapi.yaml (FR-002).
import path from "node:path";
import { bundlePath, contractRoot, repoRoot, runCli } from "./lib.mjs";

const status = runCli("redocly", [
  "bundle",
  contractRoot,
  "-o",
  bundlePath,
  "--config",
  path.join(repoRoot, "redocly.yaml"),
]);
process.exit(status);
