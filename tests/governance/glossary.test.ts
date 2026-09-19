// Feature 002 — FR-011..FR-013: the ubiquitous language is verified against the contract.
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
  it("passes when every noun resolves and every note has a source", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Glossary: 1 terms, all with a source; 1 used in the contract");
  });

  it("a PascalCase schema resolves to the snake_case wire value, and an -es plural to its singular", () => {
    const r = check("wire-value");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("3 used in the contract");
  });

  it("fails on a contract noun without a note", () => {
    const r = check("orphan");
    expect(r.status).toBe(1);
    expect(r.output).toContain("gadgets");
  });

  it("fails on a note without a source", () => {
    const r = check("no-source");
    expect(r.status).toBe(1);
    expect(r.output).toMatch(/widget\.md: `fuente` is missing/);
  });

  it("fails on a nonexistent source when the MVP documents are available", () => {
    const r = check("missing-source");
    expect(r.status).toBe(1);
    expect(r.output).toContain("99-none.md");
  });

  it("fails on an unused note that does not declare `uso`", () => {
    const r = check("unused");
    expect(r.status).toBe(1);
    expect(r.output).toContain("sobrante");
  });

  it("passes if the unused note declares `uso: pendiente`", () => {
    const r = check("use-declared");
    expect(r.status, r.output).toBe(0);
  });

  it("with the MVP directory present but without documents (as in CI) it warns and does not fail", () => {
    const r = check("mvp-empty");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("warning");
  });

  it("without the MVP documents directory it warns and does not fail", () => {
    const r = check("mvp-absent");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("warning");
    expect(r.output).toContain("OPE_MVP_DOCS");
  });
});
