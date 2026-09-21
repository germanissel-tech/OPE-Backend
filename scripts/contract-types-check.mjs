// contract:types:check — fails if any generated artefact (generated/api.d.ts,
// generated/problem-types.{js,d.ts}) differs from its regeneration (FR-031; feature 018).
import { existsSync, readFileSync } from "node:fs";
import {
  generateProblemTypes,
  generatedProblemTypesDts,
  generatedProblemTypesJs,
} from "./contract-problem-types-lib.mjs";
import { generateTypes } from "./contract-types-lib.mjs";
import { generatedTypesPath } from "./lib.mjs";

/** @param {string} file */
const current = (file) => (existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "");

const { js, dts } = generateProblemTypes();
/** @type {[string, string][]} */
const artefacts = [
  [generatedTypesPath, await generateTypes()],
  [generatedProblemTypesJs, js],
  [generatedProblemTypesDts, dts],
];
const outdated = artefacts.filter(([file, expected]) => current(file) !== expected);
if (outdated.length > 0) {
  for (const [file] of outdated) {
    console.error(
      `Generated types are outdated: ${file} does not match the contract. Run npm run contract:types`,
    );
  }
  process.exit(1);
}
console.log("Generated types are up to date");
