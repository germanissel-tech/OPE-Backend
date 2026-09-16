// US3 (FR-020) y US4 (FR-030): tipos en los scripts JavaScript y compilador endurecido.
// Cada fixture se compila con un tsconfig temporal que extiende el del repo e incluye sólo ese
// archivo; se afirma el código de error esperado.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const tsc = path.resolve("node_modules/typescript/bin/tsc");
const fixtures = path.resolve("tests/typecheck/fixtures");
const dir = mkdtempSync(path.join(os.tmpdir(), "ope-typecheck-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function compile(base: string, files: string[]): { status: number; output: string } {
  const config = path.join(dir, `tsconfig.${path.basename(files[0] ?? "x")}.json`);
  writeFileSync(
    config,
    JSON.stringify({
      extends: path.resolve(base),
      // El tsconfig temporal vive fuera del repo: se le indica dónde están los tipos de Node.
      compilerOptions: {
        noEmit: true,
        rootDir: path.resolve("."),
        types: ["node"],
        typeRoots: [path.resolve("node_modules/@types")],
      },
      include: files.map((f) => path.resolve(f)),
      exclude: [],
    }),
  );
  try {
    return { status: 0, output: execFileSync(process.execPath, [tsc, "-p", config], { encoding: "utf8" }) };
  } catch (err) {
    const e = err as { status: number; stdout?: string; stderr?: string };
    return { status: e.status, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("compilador endurecido (tsconfig.json)", () => {
  it.each([
    ["index-signature-dot.ts", "TS4111"],
    ["side-effect-import.ts", "TS2307"],
    ["erasable-enum.ts", "TS1294"],
  ])("%s falla con %s", (file, code) => {
    const r = compile("tsconfig.json", [path.join(fixtures, file)]);
    expect(r.status).not.toBe(0);
    expect(r.output).toContain(code);
    expect(r.output).toContain(file);
  });

  it("un perfil que omite un puerto de `Ports` no compila (FR-003 de la feature 004)", () => {
    const r = compile("tsconfig.json", [path.join(fixtures, "ports-incomplete.ts")]);
    expect(r.status).not.toBe(0);
    // TS2741 con un campo faltante; TS2739 con varios.
    expect(r.output).toMatch(/TS2741|TS2739/);
    expect(r.output).toContain("ports-incomplete.ts");
  });

  it("valid.ts compila", () => {
    const r = compile("tsconfig.json", [path.join(fixtures, "valid.ts")]);
    expect(r.status, r.output).toBe(0);
  });
});

describe("tipos en scripts JavaScript (tsconfig.scripts.json, checkJs)", () => {
  it("una propiedad inexistente en un script falla con TS2339/TS2551 nombrando el archivo", () => {
    const r = compile("tsconfig.scripts.json", [
      path.join(fixtures, "bad-script.mjs"),
      "scripts/governance-lib.mjs",
      "scripts/lib.mjs",
    ]);
    expect(r.status).not.toBe(0);
    // TS2551 es TS2339 con sugerencia ("¿quisiste decir length?").
    expect(r.output).toMatch(/TS2339|TS2551/);
    expect(r.output).toContain("bad-script.mjs");
  });

  it("el chequeo no cambia el runtime: el script se ejecuta con node tal cual", () => {
    const out = execFileSync(process.execPath, [path.join(fixtures, "bad-script.mjs")], { encoding: "utf8" });
    expect(out.trim()).toBe("undefined");
  });
});
