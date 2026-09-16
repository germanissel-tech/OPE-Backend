// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
import { readFileSync } from "node:fs";
import path from "node:path";
import { type Clock } from "../../../src/application/shared-kernel/ports/clock.js";

type Status = "ok" | "degraded";

export function label(s: Status): string {
  switch (s) {
    case "ok":
      return "bien";
    case "degraded":
      return "degradado";
  }
}

export function at(c: Clock): string {
  return c.now().toISOString();
}

export async function read(): Promise<number> {
  const raw: unknown = JSON.parse(readFileSync(path.resolve(".prettierrc.json"), "utf8"));
  const width = typeof raw === "object" && raw !== null && "printWidth" in raw ? raw.printWidth : 0;
  return typeof width === "number" ? width : 0;
}
