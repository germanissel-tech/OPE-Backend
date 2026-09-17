// US8 (FR-070, SC-008; ADR-017): the compiler running `build`/`typecheck` is TypeScript 7 and
// the API the tools import (typescript-eslint, openapi-typescript, dependency-cruiser) is 6.0,
// installed with the alias Microsoft documents for the side-by-side setup.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("current compiler (ADR-017)", () => {
  it("`tsc` is TypeScript 7", () => {
    const tsc = path.resolve("node_modules/@typescript/native/bin/tsc");
    const out = execFileSync(process.execPath, [tsc, "--version"], { encoding: "utf8" });
    expect(out.trim()).toMatch(/^Version 7\./);
  });

  it('`require("typescript")` is the 6.0 API', () => {
    const ts = require("typescript") as { version: string };
    expect(ts.version).toMatch(/^6\.0\./);
  });

  it("package.json declares the side-by-side alias", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["typescript"]).toMatch(/^npm:@typescript\/typescript6@\^6\./);
    expect(pkg.devDependencies["@typescript/native"]).toMatch(/^npm:typescript@\^7\./);
  });
});
