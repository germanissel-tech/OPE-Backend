// US4: documentación estática autocontenida desde el contrato; determinista; se rehúsa si el
// contrato no pasa la verificación (FR-032, SC-006).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/contract-docs.mjs");
const output = path.resolve("docs/api/index.html");

function docs(env: Record<string, string> = {}): { status: number; output: string } {
  const r = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status ?? 1, output: `${r.stdout}${r.stderr}` };
}

describe("contract:docs", () => {
  it("genera un HTML autocontenido con la operación, ejemplo y errores, idéntico en dos corridas", () => {
    const first = docs();
    expect(first.status, first.output).toBe(0);
    const html = readFileSync(output, "utf8");
    expect(html).toContain("getHealth");
    expect(html).toContain("Estado del servicio");
    expect(html).toContain("application/problem+json");
    expect(html).toContain("2026-09-16T12:00:00Z");
    // Autocontenido: sin scripts ni hojas de estilo remotas.
    expect(html).not.toMatch(/<script[^>]*src="https?:/);
    expect(html).not.toMatch(/<link[^>]*href="https?:/);

    const second = docs();
    expect(second.status, second.output).toBe(0);
    expect(readFileSync(output, "utf8")).toBe(html);
  });

  it("se rehúsa a generar documentación de un contrato que no pasa la verificación", () => {
    const before = existsSync(output) ? statSync(output).mtimeMs : null;
    const result = docs({ OPE_CONTRACT_ROOT: path.resolve("tests/contract-rules/fixtures/ope-no-pii.yaml") });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("ope-no-pii");
    expect(result.output).toContain("no se genera documentación");
    const after = existsSync(output) ? statSync(output).mtimeMs : null;
    expect(after).toBe(before);
  });
});
