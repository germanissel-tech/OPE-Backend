// US3 escenarios 4 y 5: el chequeo de drift falla si los tipos generados están desactualizados
// o fueron editados a mano, y pasa cuando coinciden con la regeneración.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/contract-types-check.mjs");
const generated = path.resolve("src/generated/api.d.ts");

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function check(typesFile: string): { status: number; output: string } {
  try {
    const out = execFileSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, OPE_TYPES_FILE: typesFile },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: out };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("contract:types:check", () => {
  it("pasa cuando el archivo commiteado coincide con la regeneración", () => {
    const result = check(generated);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Tipos generados al día");
  });

  it("falla cuando el archivo fue editado a mano", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "ope-types-"));
    const copy = path.join(dir, "api.d.ts");
    copyFileSync(generated, copy);
    writeFileSync(copy, `${readFileSync(copy, "utf8")}\nexport type Editado = true;\n`);
    const result = check(copy);
    expect(result.status).toBe(1);
    expect(result.output).toContain("Tipos generados desactualizados");
  });
});
