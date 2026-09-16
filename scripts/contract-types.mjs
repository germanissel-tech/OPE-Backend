// contract:types — genera src/generated/api.d.ts desde el bundle (FR-030).
// Determinista: opciones fijas y fin de línea LF.
import { writeFileSync } from "node:fs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

const source = await generateTypes();
writeFileSync(generatedTypesPath, source, "utf8");
console.log(`Tipos generados en ${generatedTypesPath}`);
