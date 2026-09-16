// FR-003: toda invariante declarada tiene una prueba nombrada por su slug.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string) =>
  runScript("check-invariant-tests.mjs", [
    "--bundle",
    fixture("invariant-tests", dir, "bundle.yaml"),
    "--tests-dir",
    fixture("invariant-tests", dir, "tests"),
  ]);

describe("check:invariant-tests", () => {
  it("pasa cuando cada invariante tiene su prueba [invariant:<slug>]", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Invariantes: 1 declaradas, 1 con prueba");
  });

  it("falla nombrando el marcador que falta y dónde está declarada la invariante", () => {
    const r = check("missing");
    expect(r.status).toBe(1);
    // Se arma en dos partes para que el propio check no cuente esta línea como la prueba.
    expect(r.output).toContain(["[invariant:", "not-found]"].join(""));
    expect(r.output).toContain("/paths//v1/health/get");
  });

  it("con cero invariantes pasa informándolo", () => {
    const r = check("none");
    expect(r.status).toBe(0);
    expect(r.output).toContain("Invariantes: 0 declaradas");
  });
});
