// Reads the bundled contract (`npm run contract:bundle`) that governs the server (FR-040).
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { ContractDocument } from "./build-server.js";

export function loadContract(file: string): ContractDocument {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(`Bundled contract ${file} cannot be read. Run npm run contract:bundle.`, { cause: err });
  }
  return parse(text) as ContractDocument;
}
