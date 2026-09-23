// Feature 003, US3 (FR-020) and US4 (FR-030): types in the JavaScript scripts and hardened compiler.
// Each fixture is compiled with a temporary tsconfig extending the repo one and including only
// that file; the expected error code is asserted.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// The compiler `build` and `typecheck` use is TypeScript 7 (`@typescript/native`, ADR-017);
// `node_modules/typescript` is the 6.0 API for the tools and does not compile the repo.
const tsc = path.resolve("node_modules/@typescript/native/bin/tsc");
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
      // The temporary tsconfig lives outside the repo: it is told where the Node types are.
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

/**
 * A fixture that must not compile: the error code, and the fragments the message has to name.
 * The fragments matter as much as the code — a guarantee whose message does not say what is
 * missing sends whoever hits it to read the library instead of the error (feature 020, T002).
 */
function expectFailure(file: string, code: string, fragments: readonly string[] = []): void {
  const r = compile("tsconfig.json", [path.join(fixtures, file)]);
  expect(r.status, r.output).not.toBe(0);
  expect(r.output).toContain(code);
  expect(r.output).toContain(file);
  for (const fragment of fragments) expect(r.output).toContain(fragment);
}

describe("hardened compiler (tsconfig.json)", () => {
  it.each([
    ["index-signature-dot.ts", "TS4111"],
    // TS 7 emits TS2882 (a code of its own for a nonexistent side-effect import); TS ≤ 6 gave TS2307.
    ["side-effect-import.ts", "TS2882"],
    ["erasable-enum.ts", "TS1294"],
  ])("%s fails with %s", (file, code) => {
    expectFailure(file, code);
  });

  // Feature 020 (ADR-033): the guarantees the graph takes to compile time. What each one says
  // matters as much as that it fails: the message has to name what is missing.
  it.each([
    ["graph-missing-provider.ts", "TS2345", 'Missing<"test.clock">'],
    ["graph-technologies-disagree.ts", "TS2345", 'TechnologiesDisagree<"test.directory">'],
    ["graph-technology-unchosen.ts", "TS2322", "ChooseATechnology"],
    ["graph-operation-unwired.ts", "TS2345", "Unwired<"],
    // One instance behind several ports has to satisfy all of them.
    ["graph-bindall-mismatch.ts", "TS2322", "Property 'now' is missing"],
  ])("%s does not compile (%s) and names %s", (file, code, fragment) => {
    expectFailure(file, code, [fragment]);
  });

  it("valid.ts compila", () => {
    const r = compile("tsconfig.json", [path.join(fixtures, "valid.ts")]);
    expect(r.status, r.output).toBe(0);
  });
});

describe("types in JavaScript scripts (tsconfig.scripts.json, checkJs)", () => {
  it("a nonexistent property in a script fails with TS2339/TS2551 naming the file", () => {
    const r = compile("tsconfig.scripts.json", [
      path.join(fixtures, "bad-script.mjs"),
      "scripts/governance-lib.mjs",
      "scripts/lib.mjs",
    ]);
    expect(r.status).not.toBe(0);
    // TS2551 is TS2339 with a suggestion ("did you mean length?").
    expect(r.output).toMatch(/TS2339|TS2551/);
    expect(r.output).toContain("bad-script.mjs");
  });

  it("the check does not change the runtime: the script runs with node as is", () => {
    const out = execFileSync(process.execPath, [path.join(fixtures, "bad-script.mjs")], { encoding: "utf8" });
    expect(out.trim()).toBe("undefined");
  });
});
