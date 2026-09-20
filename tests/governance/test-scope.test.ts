// Feature 017 — T003: the `tools` project runs only when a change exercises a toolchain.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { runScript } from "./run.js";

interface Module {
  projectsFor: (changed: readonly string[]) => string[];
  TOOLS_TRIGGERS: readonly string[];
}

let mod: Module;
beforeAll(async () => {
  mod = (await import(pathToFileURL(path.resolve("scripts/test-scope.mjs")).href)) as Module;
});

describe("test:scoped", () => {
  it("a change confined to src/ and its tests runs only the fast project", () => {
    expect(
      mod.projectsFor(["src/domain/merchant/merchant.ts", "tests/unit/domain/merchant/merchant.test.ts"]),
    ).toEqual(["fast"]);
  });

  it.each([
    "scripts/check-glossary.mjs",
    ".claude/skills/auditing-architecture/scripts/run-gates.mjs",
    "contracts/paths/orders.yaml",
    "docs/adr/031-x.md",
    "tests/audit/fixtures/x/src/a.ts",
    "tests/governance/quality.test.ts",
    "tests/unit/contract-docs.test.ts",
    "vitest.config.ts",
    "package.json",
    ".github/workflows/ci.yml",
  ])("%s also runs the tools project", (file) => {
    expect(mod.projectsFor(["src/main.ts", file])).toEqual(["fast", "tools"]);
  });

  it("a file that merely shares a prefix with a trigger does not count", () => {
    expect(mod.projectsFor(["tests/governance/quality-extra.test.ts", "package.json.bak"])).toEqual(["fast"]);
  });

  it("nothing changed runs the fast project", () => {
    expect(mod.projectsFor([])).toEqual(["fast"]);
  });

  it("the CLI reports the projects in dry-run mode: --changed and --all", () => {
    const fast = runScript("test-scope.mjs", ["--dry-run", "--changed", "src/a.ts"]);
    expect(fast.status, fast.output).toBe(0);
    expect(fast.output).toContain("projects: fast (--changed)");
    const all = runScript("test-scope.mjs", ["--dry-run", "--all"]);
    expect(all.output).toContain("projects: fast, tools (--all)");
  });
});
