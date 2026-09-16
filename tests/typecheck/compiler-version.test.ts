// US8 (FR-070, SC-008; ADR-017): el compilador que ejecuta `build`/`typecheck` es TypeScript 7 y
// la API que importan las herramientas (typescript-eslint, openapi-typescript, dependency-cruiser)
// es la 6.0, instalada con el alias que Microsoft documenta para la convivencia.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("compilador vigente (ADR-017)", () => {
  it("`tsc` es TypeScript 7", () => {
    const tsc = path.resolve("node_modules/@typescript/native/bin/tsc");
    const out = execFileSync(process.execPath, [tsc, "--version"], { encoding: "utf8" });
    expect(out.trim()).toMatch(/^Version 7\./);
  });

  it('`require("typescript")` es la API 6.0', () => {
    const ts = require("typescript") as { version: string };
    expect(ts.version).toMatch(/^6\.0\./);
  });

  it("package.json declara el alias de convivencia", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["typescript"]).toMatch(/^npm:@typescript\/typescript6@\^6\./);
    expect(pkg.devDependencies["@typescript/native"]).toMatch(/^npm:typescript@\^7\./);
  });
});
