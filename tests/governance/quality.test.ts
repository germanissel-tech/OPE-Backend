// US6 (FR-050; ADR-016): one command chains the deterministic gates, stops at the first red one
// and names it; with --json it reports every gate.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { runScript } from "./run.js";

interface Gate {
  name: string;
  script: string;
  args: string[];
}
interface Module {
  GATES: readonly Gate[];
  commandOf: (gate: Gate, extra?: string[]) => string[];
  runQuality: (
    runner: (gate: Gate) => number,
    gates?: readonly Gate[],
  ) => { failed: Gate | null; ran: string[] };
}

let mod: Module;
beforeAll(async () => {
  mod = (await import(pathToFileURL(path.resolve("scripts/quality.mjs")).href)) as Module;
});

describe("quality", () => {
  it("chains lint, arch, duplication, dead code and language, in that order", () => {
    expect(mod.GATES.map((g) => g.name)).toEqual([
      "lint",
      "arch",
      "check:duplication",
      "check:dead-code",
      "check:language",
    ]);
    const duplication = mod.GATES.find((g) => g.name === "check:duplication");
    expect(duplication).toBeDefined();
    if (!duplication) return;
    expect(mod.commandOf(duplication, ["--json"]).join(" ")).toMatch(/check-duplication\.mjs --json$/);
  });

  it("stops at the first red gate and reports which one", () => {
    const seen: string[] = [];
    const { failed, ran } = mod.runQuality((gate) => {
      seen.push(gate.name);
      return gate.name === "check:duplication" ? 1 : 0;
    });
    expect(failed?.name).toBe("check:duplication");
    expect(ran).toEqual(["lint", "arch", "check:duplication"]);
    expect(seen).toEqual(ran);
  });

  it("reports no failure when every gate is green", () => {
    const { failed, ran } = mod.runQuality(() => 0);
    expect(failed).toBeNull();
    expect(ran).toHaveLength(5);
  });

  it("--json returns one entry per gate with a status", () => {
    const r = runScript("quality.mjs", ["--json"]);
    const j = JSON.parse(r.output.slice(r.output.indexOf("{"))) as {
      gates: { gate: string; status: string }[];
    };
    expect(j.gates.map((g) => g.gate)).toEqual(["lint", "arch", "duplication", "dead-code", "language"]);
    expect(j.gates.every((g) => g.status === "pass" || g.status === "fail")).toBe(true);
  }, 120_000);
});
