// ADR-016 §5: the Stryker vitest runner is patched for Vitest 5 (stryker-js#6210) until the fix
// is released. The patch names its origin and its retirement condition, and is applied on install.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const patch = path.resolve("patches/@stryker-mutator+vitest-runner+10.0.0.patch");
const runner = path.resolve("node_modules/@stryker-mutator/vitest-runner/dist/src");

describe("patches/ (patch-package)", () => {
  it("the vitest-runner patch exists and names the issue, the PR and the retirement condition", () => {
    expect(existsSync(patch)).toBe(true);
    const text = readFileSync(patch, "utf8");
    expect(text).toContain("stryker-js#6210");
    expect(text).toContain("PR #6214");
    expect(text).toMatch(/Retire:/);
    expect(text).toContain("join(' > ')");
  });

  it("is applied after `npm install`: both runner files join test names with ' > '", () => {
    for (const file of ["stryker-setup.js", "test-helpers.js"]) {
      expect(readFileSync(path.join(runner, file), "utf8"), file).toContain("join(' > ')");
    }
  });

  it("package.json applies patches on postinstall", () => {
    const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["postinstall"]).toBe("patch-package");
  });
});
