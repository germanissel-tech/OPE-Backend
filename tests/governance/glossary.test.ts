// FR-011..FR-013: el lenguaje ubicuo se verifica contra el contrato.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string) => {
  const base = fixture("glossary", dir);
  return runScript("check-glossary.mjs", [
    "--bundle",
    `${base}/bundle.yaml`,
    "--glossary",
    `${base}/dominio`,
    "--constitution",
    `${base}/constitucion.md`,
    "--mvp-docs",
    `${base}/mvp`,
  ]);
};

describe("check:glossary", () => {
  it("pasa cuando todo sustantivo resuelve y toda nota tiene fuente", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Glosario: 1 términos, todos con fuente; 1 usados en el contrato");
  });

  it("un schema en PascalCase resuelve al valor de cable en snake_case, y un plural en -es a su singular", () => {
    const r = check("valor-de-cable");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("3 usados en el contrato");
  });

  it("falla ante un sustantivo del contrato sin nota", () => {
    const r = check("huerfano");
    expect(r.status).toBe(1);
    expect(r.output).toContain("gadgets");
  });

  it("falla ante una nota sin fuente", () => {
    const r = check("sin-fuente");
    expect(r.status).toBe(1);
    expect(r.output).toMatch(/widget\.md: falta `fuente`/);
  });

  it("falla ante una fuente inexistente cuando los documentos del MVP están disponibles", () => {
    const r = check("fuente-inexistente");
    expect(r.status).toBe(1);
    expect(r.output).toContain("99-nada.md");
  });

  it("falla ante una nota sin uso que no declara `uso`", () => {
    const r = check("sin-uso");
    expect(r.status).toBe(1);
    expect(r.output).toContain("sobrante");
  });

  it("pasa si la nota sin uso declara `uso: pendiente`", () => {
    const r = check("uso-declarado");
    expect(r.status, r.output).toBe(0);
  });

  it("sin el directorio de documentos del MVP avisa y no falla", () => {
    const r = check("mvp-ausente");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("aviso");
    expect(r.output).toContain("OPE_MVP_DOCS");
  });
});
