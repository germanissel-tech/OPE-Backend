// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
export const ok = existsSync(".") && readFileSync(".prettierrc.json", "utf8").length > 0;
