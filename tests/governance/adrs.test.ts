// FR-020 / FR-021: registro de decisiones bien formado y sin citas rotas.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string) => runScript("check-adrs.mjs", ["--root", fixture("adrs", dir)]);

describe("check:adrs", () => {
  it("pasa con ADRs válidos y citas existentes", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toMatch(/ADRs: 2, \d+ citas, sin citas rotas/);
  });

  it("falla ante una cita a un ADR inexistente, con archivo y línea", () => {
    const r = check("cita-rota");
    expect(r.status).toBe(1);
    expect(r.output).toContain("docs/doc.md:1");
    expect(r.output).toContain("ADR-009");
  });

  it("falla si falta un campo del frontmatter", () => {
    const r = check("frontmatter-incompleto");
    expect(r.status).toBe(1);
    expect(r.output).toContain("falta `estado`");
  });

  it("falla si el número no coincide con el prefijo del archivo", () => {
    const r = check("numero-no-coincide");
    expect(r.status).toBe(1);
    expect(r.output).toContain("numero: 4");
  });

  it("falla ante un estado fuera del catálogo", () => {
    const r = check("estado-invalido");
    expect(r.status).toBe(1);
    expect(r.output).toContain("vigente");
  });
});
