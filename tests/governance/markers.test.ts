// Feature 002 — FR-022 / FR-023: countable markers and release gate.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir: string, strict = false) =>
  runScript("check-markers.mjs", ["--root", fixture("markers", dir), ...(strict ? ["--strict"] : [])]);

describe("check:markers", () => {
  it("does not count markers between backticks nor the frontmatter state", () => {
    const r = check("limpio", true);
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Markers: 0 open, 0 proposed, 0 placeholders");
  });

  it("PROPUESTO does not block: passes with a warning in strict mode", () => {
    expect(check("propuesto").status).toBe(0);
    const strict = check("propuesto", true);
    expect(strict.status).toBe(0);
    expect(strict.output).toContain("warning: 1 PROPUESTO");
  });

  it("lists ABIERTO and PLACEHOLDER with file, line and text; blocks in strict mode", () => {
    const list = check("bloqueante");
    expect(list.status).toBe(0);
    expect(list.output).toContain("docs/a.md:3: ABIERTO — Hosting: ABIERTO until D3.");
    expect(list.output).toContain("contracts/openapi.yaml:4: PLACEHOLDER");
    expect(list.output).toContain("Markers: 1 open, 0 proposed, 1 placeholders");
    const strict = check("bloqueante", true);
    expect(strict.status).toBe(1);
    expect(strict.output).toContain("2 blocking markers remain");
  });
});
