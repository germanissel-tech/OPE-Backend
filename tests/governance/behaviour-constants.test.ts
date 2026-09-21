// Feature 017 — US2 (FR-016; constitution XI): no policy lives in the code — the retired files
// are absent from src/ and no constant with their names is declared again.
import { describe, expect, it } from "vitest";
import { fixture, runScript } from "./run.js";

const check = (dir?: string) =>
  runScript(
    "check-behaviour-constants.mjs",
    dir === undefined ? [] : ["--src", fixture("behaviour-constants", dir, "src")],
  );

describe("check:behaviour-constants", () => {
  it("passes on the repository: the constants of the table left src/ (freshness, level, windows, default policies)", () => {
    const r = check();
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("retired files absent");
  });

  it("passes on a clean tree that declares rules, not policies", () => {
    const r = check("clean");
    expect(r.status, r.output).toBe(0);
  });

  it("fails on a tree that reintroduces a retired file and a retired name, naming both", () => {
    const r = check("reintroduced");
    expect(r.status).toBe(1);
    expect(r.output).toContain("application/catalog/policies/freshness.ts exists");
    expect(r.output).toContain("declares FRESHNESS_BUDGET");
    expect(r.output).toContain("treatment defaults: freshness");
  });
});
