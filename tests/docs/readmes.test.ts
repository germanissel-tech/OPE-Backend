// Feature 019, D-06 (ADR-032 §2): every top-level directory that is not code carries a README
// whose inventory equals the directory; generated files, patches and scripts carry the header
// their directory promises. Entries come from `git ls-files`: what git ignores never counts.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

interface DirectoryPolicy {
  dir: string;
  exclude?: readonly string[];
  columns?: readonly string[];
  sections?: readonly { heading: string; columns: readonly string[] }[];
}
interface InventoryRow {
  entry: string;
  pattern: boolean;
  cells: string[];
}
interface InventoryPolicy {
  fixedColumns: readonly string[];
  globalExcludes: readonly string[];
  directories: readonly DirectoryPolicy[];
}
interface Lib {
  parsePolicy: (json: string) => InventoryPolicy;
  entriesOf: (tracked: readonly string[], dir: string, exclude?: readonly string[]) => string[];
  topLevelDirectories: (tracked: readonly string[], globalExcludes: readonly string[]) => string[];
  checkInventory: (
    markdown: string,
    entries: readonly string[],
    policy: DirectoryPolicy,
    fixedColumns: readonly string[],
  ) => string[];
  checkPolicies: (topLevel: readonly string[], policies: readonly DirectoryPolicy[]) => string[];
  rowMatches: (row: InventoryRow, entry: string) => boolean;
  generatedBy: (name: string, content: string) => string | null;
  patchHeaderProblems: (content: string) => string[];
  scriptHasHeader: (content: string) => boolean;
  extensionKeys: (contents: readonly string[]) => string[];
  documentedExtensions: (markdown: string) => string[];
}

let lib: Lib;
let tracked: string[];
let policy: InventoryPolicy;
/** The sample README of the pure cases (Spanish, as every README: a fixture, not a string). */
let sample: string;
beforeAll(async () => {
  lib = (await import(pathToFileURL(path.resolve("scripts/readme-inventory-lib.mjs")).href)) as Lib;
  tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/u)
    .filter((f) => f !== "");
  policy = lib.parsePolicy(readFileSync("scripts/readme-inventory-policy.json", "utf8"));
  sample = readFileSync("tests/docs/fixtures/sample/README.md", "utf8");
});

const dirX: DirectoryPolicy = { dir: "x" };
const check = (markdown: string, entries: readonly string[], dir: DirectoryPolicy = dirX) =>
  lib.checkInventory(markdown, entries, dir, policy.fixedColumns);

describe("inventory of a README (pure)", () => {
  it("accepts a README whose rows cover every entry, by name or by pattern", () => {
    expect(check(sample, ["a.json", "sub/", "001-uno/", "002-dos/"])).toEqual([]);
  });

  it("reports a missing entry, a row without entry, a pattern matching nothing", () => {
    expect(check(sample, ["a.json", "sub/", "b.json"])).toEqual([
      'x/README.md: entry "b.json" is not in the inventory',
      'x/README.md: pattern "NNN-<slug>/" matches nothing',
    ]);
    expect(check(sample, ["a.json", "001-x/"])).toEqual([
      'x/README.md: "sub/" is in the inventory but not in the directory',
    ]);
  });

  it("an excluded entry may be documented without being in the directory", () => {
    const withDist = sample.replace("| `sub/`", "| `dist/` | x | x | x | x |\n| `sub/`");
    expect(check(withDist, ["a.json", "sub/", "001-a/"], { dir: "x", exclude: ["dist"] })).toEqual([]);
    expect(check(withDist, ["a.json", "sub/", "001-a/"])).toEqual([
      'x/README.md: "dist/" is in the inventory but not in the directory',
    ]);
  });

  it("reports the section, the table, a fixed column and an own column when missing", () => {
    expect(check("# x\n", [])).toEqual(['x/README.md: no "## Inventario" section']);
    expect(check("# x\n\n## Inventario\n\nnothing\n", [])).toEqual([
      'x/README.md: "## Inventario" has no table',
    ]);
    const last = policy.fixedColumns[policy.fixedColumns.length - 1] ?? "";
    const withoutColumn = sample.replace(`| ${last} |`, "| Other |");
    expect(check(withoutColumn, ["a.json", "sub/", "001-a/"])).toEqual([
      `x/README.md: column "${last}" missing`,
    ]);
    expect(check(sample, ["a.json", "sub/", "001-a/"], { dir: "x", columns: ["Own"] })).toEqual([
      'x/README.md: column "Own" missing',
    ]);
  });

  it("requires the extra sections a policy declares, with their columns", () => {
    const withSection: DirectoryPolicy = { dir: "x", sections: [{ heading: "Extra", columns: ["A", "B"] }] };
    expect(check(sample, ["a.json", "sub/", "001-a/"], withSection)).toEqual([
      'x/README.md: section "## Extra" with a table is required',
    ]);
    const extended = `${sample}\n## Extra\n\n| A | C |\n| --- | --- |\n| \`x-a\` | y |\n`;
    expect(check(extended, ["a.json", "sub/", "001-a/"], withSection)).toEqual([
      'x/README.md: column "B" missing in "## Extra"',
    ]);
  });

  it("rejects a figure of state in prose", () => {
    const withFigure = sample.replace("Texto.", "12 archivos");
    expect(check(withFigure, ["a.json", "sub/", "001-a/"])).toEqual([
      'x/README.md: figure of state in prose ("12 archivos")',
    ]);
  });

  it("lists entries from tracked paths: files, directories with a slash, exclusions, no README", () => {
    const paths = [
      "x/README.md",
      "x/a.json",
      "x/sub/one.ts",
      "x/sub/two.ts",
      "x/dist/out.js",
      "y/z.ts",
      "x/.hidden",
    ];
    expect(lib.entriesOf(paths, "x", ["dist"])).toEqual([".hidden", "a.json", "sub/"]);
    expect(lib.topLevelDirectories(paths, ["y"])).toEqual(["x"]);
  });

  it("a top-level directory without a policy, or a policy without a directory, is a problem", () => {
    expect(lib.checkPolicies(["a", "b"], [{ dir: "a" }])).toEqual([
      "b/: top-level directory without an inventory README policy",
    ]);
    expect(lib.checkPolicies(["a"], [{ dir: "a" }, { dir: "c" }])).toEqual([
      "c/: policy for a directory that does not exist",
    ]);
  });

  it("the policy file has the shape the checks expect", () => {
    expect(policy.fixedColumns.length).toBeGreaterThan(0);
    expect(() => lib.parsePolicy("{}")).toThrow(/fixedColumns/u);
    expect(() =>
      lib.parsePolicy('{ "fixedColumns": [], "globalExcludes": [], "directories": [{}] }'),
    ).toThrow(/directories/u);
  });
});

describe("extensions (pure)", () => {
  it("collects the x-* keys of YAML sources and the rows of the extensions table", () => {
    const sources = [
      "info:\n  x-stability: building\n",
      "get:\n  x-required-capabilities: [a]\n  x-required-capabilities: [b]\n",
    ];
    expect(lib.extensionKeys(sources)).toEqual(["x-required-capabilities", "x-stability"]);
    const table =
      "# c\n\n## Extensiones\n\n| Extension | Where |\n| --- | --- |\n| `x-b` | op |\n| `x-a` | root |\n";
    expect(lib.documentedExtensions(table)).toEqual(["x-a", "x-b"]);
    expect(lib.documentedExtensions("# c\n")).toEqual([]);
  });
});

describe("headers (pure)", () => {
  it("reads the generating script from the first line, or from $comment in JSON", () => {
    expect(lib.generatedBy("a.d.ts", "// GENERATED by scripts/contract-types.mjs from x — DO NOT EDIT")).toBe(
      "scripts/contract-types.mjs",
    );
    expect(
      lib.generatedBy("a.schema.json", '{ "$comment": "GENERATED by scripts/gen.mjs from y", "a": 1 }'),
    ).toBe("scripts/gen.mjs");
    expect(lib.generatedBy("a.js", "export const x = 1;")).toBeNull();
    expect(lib.generatedBy("a.json", "{ nope")).toBeNull();
  });

  it("a patch declares Fix and Retire in its leading comments", () => {
    expect(
      lib.patchHeaderProblems("# Fix: stryker-js#6210\n# Retire: when 10.0.1 ships\ndiff --git a b\n"),
    ).toEqual([]);
    expect(lib.patchHeaderProblems("# Fix: x\ndiff --git a b\n# Retire: too late\n")).toEqual(["# Retire:"]);
    expect(lib.patchHeaderProblems("diff --git a b\n")).toEqual(["# Fix:", "# Retire:"]);
  });

  it("a script opens with a comment, after an optional shebang", () => {
    expect(lib.scriptHasHeader("// what it does\nimport x from 'y';")).toBe(true);
    expect(lib.scriptHasHeader("#!/usr/bin/env node\n// what it does\n")).toBe(true);
    expect(lib.scriptHasHeader("import x from 'y';")).toBe(false);
    expect(lib.scriptHasHeader("#!/usr/bin/env node\nimport x from 'y';")).toBe(false);
  });
});

describe("the repository", () => {
  it("every top-level directory that is not code has a policy, and every policy a directory", () => {
    expect(
      lib.checkPolicies(lib.topLevelDirectories(tracked, policy.globalExcludes), policy.directories),
    ).toEqual([]);
  });

  it("every inventory README equals its directory", () => {
    const problems: string[] = [];
    for (const directory of policy.directories) {
      const readme = path.join(directory.dir, "README.md");
      if (!tracked.includes(readme.replaceAll("\\", "/"))) {
        problems.push(`${directory.dir}/README.md: missing`);
        continue;
      }
      const entries = lib.entriesOf(tracked, directory.dir, directory.exclude);
      problems.push(
        ...lib.checkInventory(readFileSync(readme, "utf8"), entries, directory, policy.fixedColumns),
      );
    }
    expect(problems).toEqual([]);
  });

  it("contracts/README.md documents every x-* extension of the contract source, and only those", () => {
    const sources = tracked
      .filter((f) => f.startsWith("contracts/") && /.ya?ml$/u.test(f))
      .map((f) => readFileSync(f, "utf8"));
    const declared = lib.extensionKeys(sources);
    expect(declared.length).toBeGreaterThan(0);
    expect(lib.documentedExtensions(readFileSync("contracts/README.md", "utf8"))).toEqual(declared);
  });

  it("every generated file names the script that produces it, and that script exists", () => {
    const problems: string[] = [];
    for (const file of tracked.filter((f) => f.startsWith("generated/") && !f.endsWith("README.md"))) {
      const script = lib.generatedBy(path.basename(file), readFileSync(file, "utf8"));
      if (script === null) problems.push(`${file}: no generated header`);
      else if (!tracked.includes(script)) problems.push(`${file}: cites ${script}, which does not exist`);
    }
    expect(problems).toEqual([]);
  });

  it("every patch declares what it fixes and when it retires", () => {
    const problems: string[] = [];
    for (const file of tracked.filter((f) => f.startsWith("patches/") && f.endsWith(".patch"))) {
      for (const missing of lib.patchHeaderProblems(readFileSync(file, "utf8")))
        problems.push(`${file}: ${missing}`);
    }
    expect(problems).toEqual([]);
  });

  it("every script opens with a comment that says what it does", () => {
    const problems = tracked
      .filter((f) => f.startsWith("scripts/") && f.endsWith(".mjs"))
      .filter((f) => !lib.scriptHasHeader(readFileSync(f, "utf8")));
    expect(problems).toEqual([]);
  });
});
