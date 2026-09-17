// FR-020 / FR-021: well-formed decision record with no broken citations.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string) => runScript("check-adrs.mjs", ["--root", fixture("adrs", dir)]);

describe("check:adrs", () => {
  it("passes with valid ADRs and existing citations", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toMatch(/ADRs: 2, \d+ citations, none broken/);
  });

  it("fails on a citation to a nonexistent ADR, with file and line", () => {
    const r = check("cita-rota");
    expect(r.status).toBe(1);
    expect(r.output).toContain("docs/doc.md:1");
    expect(r.output).toContain("ADR-009");
  });

  it("fails if a frontmatter field is missing", () => {
    const r = check("frontmatter-incompleto");
    expect(r.status).toBe(1);
    expect(r.output).toContain("`estado` is missing");
  });

  it("fails if the number does not match the file prefix", () => {
    const r = check("numero-no-coincide");
    expect(r.status).toBe(1);
    expect(r.output).toContain("numero: 4");
  });

  it("fails on a state outside the catalogue", () => {
    const r = check("estado-invalido");
    expect(r.status).toBe(1);
    expect(r.output).toContain("vigente");
  });
});
