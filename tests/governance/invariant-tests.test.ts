// Feature 002 — FR-003: every declared invariant has a test named by its slug.
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
  it("passes when every invariant has its [invariant:<slug>] test", () => {
    const r = check("ok");
    expect(r.status, r.output).toBe(0);
    expect(r.output).toContain("Invariants: 1 declared, 1 with a test");
  });

  it("fails naming the missing marker and where the invariant is declared", () => {
    const r = check("missing");
    expect(r.status).toBe(1);
    // Built in two parts so the check itself does not count this line as the test.
    expect(r.output).toContain(["[invariant:", "not-found]"].join(""));
    expect(r.output).toContain("/paths//v1/health/get");
  });

  it("with zero invariants it passes and says so", () => {
    const r = check("none");
    expect(r.status).toBe(0);
    expect(r.output).toContain("Invariants: 0 declared");
  });
});
