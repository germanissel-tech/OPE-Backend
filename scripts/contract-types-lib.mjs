import { existsSync, readFileSync } from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";
import { bundlePath } from "./lib.mjs";

export const GENERATED_HEADER =
  "// GENERADO por scripts/contract-types.mjs desde contracts/dist/openapi.yaml — NO EDITAR A MANO.\n" +
  "// Regenerar con: npm run contract:types\n\n";

/** Genera el contenido completo de src/interface-adapters/http/generated/api.d.ts a partir del bundle. */
export async function generateTypes() {
  if (!existsSync(bundlePath)) {
    throw new Error(`No existe ${bundlePath}. Corré npm run contract:bundle primero.`);
  }
  const schema = readFileSync(bundlePath, "utf8");
  const ast = await openapiTS(schema, { alphabetize: true, exportType: true });
  const body = astToString(ast).replace(/\r\n/g, "\n");
  return GENERATED_HEADER + body;
}
