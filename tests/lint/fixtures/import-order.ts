// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
import path from "node:path";
import { readFileSync } from "node:fs";
export const p = readFileSync(path.resolve("."), "utf8");
