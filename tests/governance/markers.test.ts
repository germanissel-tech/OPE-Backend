// FR-022 / FR-023: countable markers and release gate.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string, strict = false) =>
  runScript("check-markers.mjs", ["--root", fixture("markers", dir), ...(strict ? ["--strict"] : [])]);

describe("check:markers", () => {
  it("does not count markers between backticks nor the frontmatter state", () => {
    const r = check("limpio", true);
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Marcadores: 0 abiertos, 0 propuestos, 0 placeholders");
  });

  it("PROPUESTO does not block: passes with a warning in strict mode", () => {
    expect(check("propuesto").status).toBe(0);
    const strict = check("propuesto", true);
    expect(strict.status).toBe(0);
    expect(strict.output).toContain("aviso: 1 PROPUESTO");
  });

  it("lists ABIERTO and PLACEHOLDER with file, line and text; blocks in strict mode", () => {
    const list = check("bloqueante");
    expect(list.status).toBe(0);
    expect(list.output).toContain("docs/a.md:3: ABIERTO — Hosting: ABIERTO hasta D3.");
    expect(list.output).toContain("contracts/openapi.yaml:4: PLACEHOLDER");
    expect(list.output).toContain("Marcadores: 1 abiertos, 0 propuestos, 1 placeholders");
    const strict = check("bloqueante", true);
    expect(strict.status).toBe(1);
    expect(strict.output).toContain("quedan 2 marcadores bloqueantes");
  });
});
