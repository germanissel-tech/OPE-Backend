// contract:types — generates what the server reads of the contract, outside src/ (FR-030;
// feature 018): generated/api.d.ts from the bundle and generated/problem-types.{js,d.ts} from
// contracts/problem-types.yaml, and generated/schemas/*.schema.json (the configuration files)
// from the bundle. Deterministic: fixed options and LF line endings.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generateProblemTypes,
  generatedProblemTypesDts,
  generatedProblemTypesJs,
} from "./contract-problem-types-lib.mjs";
import { generateConfigSchemas } from "./contract-schemas-lib.mjs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

const source = await generateTypes();
mkdirSync(path.dirname(generatedTypesPath), { recursive: true });
writeFileSync(generatedTypesPath, source, "utf8");
console.log(`Types generated at ${generatedTypesPath}`);
const { js, dts } = generateProblemTypes();
mkdirSync(path.dirname(generatedProblemTypesJs), { recursive: true });
writeFileSync(generatedProblemTypesJs, js, "utf8");
writeFileSync(generatedProblemTypesDts, dts, "utf8");
console.log(`Problem types generated at ${generatedProblemTypesJs} (+ .d.ts)`);
for (const [file, content] of generateConfigSchemas()) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
  console.log(`Configuration schema generated at ${file}`);
}
