// contract:types:check — falla si src/interface-adapters/http/generated/api.d.ts difiere de la regeneración (FR-031).
import { existsSync, readFileSync } from "node:fs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

const expected = await generateTypes();
const actual = existsSync(generatedTypesPath)
  ? readFileSync(generatedTypesPath, "utf8").replace(/\r\n/g, "\n")
  : "";
if (actual !== expected) {
  console.error(
    `Tipos generados desactualizados: ${generatedTypesPath} no coincide con el contrato. Corré npm run contract:types`,
  );
  process.exit(1);
}
console.log("Tipos generados al día");
