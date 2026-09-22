// Feature 020 — US3 (FR-014; ADR-033): every abstraction a module of the application declares as
// a port is bound in the graph. Declaring one and binding it nowhere is an abstraction nobody
// serves, and no gate saw it: knip reports exported types nobody imports, and a port may be
// imported by its use case and still be wired in no deployment.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir?: string) =>
  runScript("check-ports-bound.mjs", dir === undefined ? [] : ["--src", fixture("ports-bound", dir, "src")]);

describe("check:ports-bound", () => {
  it("passes on the repository: every port of application/*/ports/ is bound", () => {
    const r = check();
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("all bound, no label repeated");
  });

  it("passes on a tree where the port is bound", () => {
    const r = check("bound");
    expect(r.status, r.output).toBe(0);
  });

  it("fails naming the port nobody binds, with its file and line", () => {
    const r = check("unbound");
    expect(r.status).toBe(1);
    expect(r.output).toContain(
      "application/catalog/ports/catalog-store.ts:2: CatalogStore is declared as a port and no composition module binds it",
    );
  });

  it("fails when two components declare the same label", () => {
    const r = check("repeated");
    expect(r.status).toBe(1);
    expect(r.output).toContain('the label "catalog.store" is declared by 2 components');
  });
});
