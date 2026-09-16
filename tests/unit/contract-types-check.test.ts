// US3 scenarios 4 and 5: the drift check fails if the generated types are outdated or were
// edited by hand, and passes when they match the regeneration.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = path.resolve("scripts/contract-types-check.mjs");
const generated = path.resolve("src/interface-adapters/http/generated/api.d.ts");

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
    const e = err as { status: number; stdout?: string; stderr?: string };
    return { status: e.status, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("contract:types:check", () => {
  it("passes when the committed file matches the regeneration", () => {
    const result = check(generated);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Generated types are up to date");
  });

  it("fails when the file was edited by hand", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "ope-types-"));
    const copy = path.join(dir, "api.d.ts");
    copyFileSync(generated, copy);
    writeFileSync(copy, `${readFileSync(copy, "utf8")}\nexport type Editado = true;\n`);
    const result = check(copy);
    expect(result.status).toBe(1);
    expect(result.output).toContain("Generated types are outdated");
  });
});
