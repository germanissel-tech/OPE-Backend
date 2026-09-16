// contract:types — generates src/interface-adapters/http/generated/api.d.ts from the bundle (FR-030).
// Deterministic: fixed options and LF line endings.
import { writeFileSync } from "node:fs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

const source = await generateTypes();
writeFileSync(generatedTypesPath, source, "utf8");
console.log(`Types generated at ${generatedTypesPath}`);
