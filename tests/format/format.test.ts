// US2 (FR-010..FR-012): un solo formato, verificado, corregible e idempotente; lista única de
// exclusiones.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const prettier = path.resolve("node_modules/prettier/bin/prettier.cjs");
const config = path.resolve(".prettierrc.json");
const dir = mkdtempSync(path.join(os.tmpdir(), "ope-format-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const samples: Record<string, string> = {
  "a.ts": "const x = {a:1,b:'dos'}\nexport default x\n",
  "b.json": '{"a":1,\n"b":[1,2]}\n',
  "c.yaml": "a:   1\nb:\n    - x\n",
  "d.md": "# Título\n\nTexto con *énfasis*   y espacios.\n",
};
for (const [name, content] of Object.entries(samples)) writeFileSync(path.join(dir, name), content);
const files = Object.keys(samples).map((f) => path.join(dir, f));

function run(args: string[]): { status: number; output: string } {
  try {
    return { status: 0, output: execFileSync(process.execPath, [prettier, "--config", config, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, output: `${e.stdout}${e.stderr}` };
  }
}

describe("formato único (Prettier)", () => {
  it("--check falla nombrando cada archivo mal formateado", () => {
    const r = run(["--check", ...files]);
    expect(r.status).not.toBe(0);
    for (const f of Object.keys(samples)) expect(r.output).toContain(f);
  });

  it("--write corrige y --check pasa; una segunda pasada es idempotente", () => {
    expect(run(["--write", ...files]).status).toBe(0);
    expect(run(["--check", ...files]).status).toBe(0);
    const before = files.map((f) => readFileSync(f, "utf8"));
    expect(run(["--write", ...files]).status).toBe(0);
    expect(files.map((f) => readFileSync(f, "utf8"))).toEqual(before);
    expect(before.every((c) => !c.includes("\r\n"))).toBe(true);
  });

  it(".prettierignore contiene la lista única de exclusiones", () => {
    const ignore = readFileSync(path.resolve(".prettierignore"), "utf8");
    for (const entry of ["src/generated/", "contracts/dist/", "docs/api/", "tests/architecture/fixtures/", "tests/contract-rules/fixtures/", "tests/governance/fixtures/", "tests/lint/fixtures/", "tests/typecheck/fixtures/", ".specify/", ".claude/", "package-lock.json"]) {
      expect(ignore).toContain(entry);
    }
  });
});
