// Feature 016 — FR-013..FR-015: every identifier the governance documents cite exists with
// that name in the contract, its catalogues, the source or the tooling (check:identifiers).
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string) => {
  const base = fixture("identifiers", dir);
  return runScript("check-identifiers.mjs", [
    "--docs",
    `${base}/docs/adr,${base}/docs/dominio`,
    "--constitution",
    `${base}/constitucion.md`,
    "--bundle",
    `${base}/bundle.yaml`,
    "--catalogs",
    `${base}/catalog.yaml`,
    "--src",
    `${base}/src`,
    "--tooling",
    `${base}/nothing`,
    "--allowlist",
    `${base}/allowlist.json`,
  ]);
};

describe("check:identifiers", () => {
  it("passes when every cited identifier exists; prose, paths, commands, flags, dotted names, fenced code and the note's own term are not judged", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Identifiers: 8 cited, 0 unknown");
  });

  it("fails naming file, line and identifier for every citation that exists nowhere", () => {
    const r = check("unknown");
    expect(r.status).toBe(1);
    expect(r.output).toContain("docs/adr/001-uno.md:14: talle_calce");
    expect(r.output).toContain("docs/adr/001-uno.md:14: precio_valor");
    expect(r.output).toContain("docs/adr/001-uno.md:14: sinNombre");
    expect(r.output).toContain("Identifiers: 11 cited, 3 unknown");
  });

  it("fails on an allowlist entry without a reason, with its own message", () => {
    const r = check("allowlist-without-reason");
    expect(r.status).toBe(1);
    expect(r.output).toContain('"DECIDIDO" is allowlisted without a reason');
    expect(r.output).toContain("DECIDIDO");
  });
});
