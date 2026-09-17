// contract:types:check — fails if src/interface-adapters/http/generated/api.d.ts differs from the regeneration (FR-031).
import { existsSync, readFileSync } from "node:fs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

const expected = await generateTypes();
const actual = existsSync(generatedTypesPath)
  ? readFileSync(generatedTypesPath, "utf8").replace(/\r\n/g, "\n")
  : "";
if (actual !== expected) {
  console.error(
    `Generated types are outdated: ${generatedTypesPath} does not match the contract. Run npm run contract:types`,
  );
  process.exit(1);
}
console.log("Generated types are up to date");
