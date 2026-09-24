// Feature 024 (ADR-032 §3): what the agent instructions cite has to exist, and every section of
// them has to be classified. The pure half is exercised with fixtures; the last two cases run the
// real gate over the real `CLAUDE.md`, because a gate that only passes on fixtures proves nothing.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

interface Section {
  heading: string;
  kind: string;
  reason?: string;
}
interface InstructionFile {
  file: string;
  role: string;
  paths?: readonly string[];
  unscopedReason?: string;
  sections: readonly Section[];
}
interface Policy {
  coreMaxLines: number;
  implicitRoots: readonly string[];
  notPaths: { shapeNames: readonly string[]; namespacePrefixes: readonly string[] };
  commandsSection: string;
  files: readonly InstructionFile[];
  exceptions: readonly { cite?: string; script?: string; reason?: string }[];
}
interface Counted {
  problems: string[];
  checked: number;
}
interface Lib {
  citations: (markdown: string) => { line: number; text: string }[];
  branches: (cite: string) => string[];
  namesAPlace: (cite: string, policy: Policy) => boolean;
  pathProblems: (
    cites: readonly { line: number; text: string }[],
    policy: Policy,
    exists: (file: string) => boolean,
  ) => Counted;
  sectionRange: (markdown: string, heading: string) => { from: number; to: number } | undefined;
  commandProblems: (
    markdown: string,
    scripts: readonly string[],
    policy: Policy,
    where: { table: { from: number; to: number } | undefined; inventory: string },
  ) => Counted;
  headings: (markdown: string) => { line: number; heading: string }[];
  sectionProblems: (markdown: string, entry: InstructionFile) => Counted;
  policyProblems: (parsed: unknown) => string[];
  coreSizeProblems: (markdown: string, max: number) => string[];
  scopeProblems: (policy: Policy, matchesSomething: (pattern: string) => boolean) => string[];
}

let lib: Lib;
let real: Policy;
beforeAll(async () => {
  lib = (await import(pathToFileURL(path.resolve("scripts/instructions-lib.mjs")).href)) as Lib;
  real = JSON.parse(readFileSync("scripts/instructions-policy.json", "utf8")) as Policy;
});

const policy = (over: Partial<Policy> = {}): Policy => ({
  implicitRoots: ["", "src/"],
  notPaths: { shapeNames: ["errors.ts", "ports/"], namespacePrefixes: ["ope/", "@"] },
  commandsSection: "Commands",
  coreMaxLines: 200,
  files: [{ file: "CORE.md", role: "core", sections: [{ heading: "Commands", kind: "descriptive" }] }],
  exceptions: [{ cite: "origin/main", reason: "a git reference" }],
  ...over,
});

/** One entry of the policy: the sections of one file. */
const entry = (sections: readonly Section[]): InstructionFile => ({
  file: "CORE.md",
  role: "core",
  sections,
});

/** A fake file system: only what it lists exists. */
const only =
  (...files: readonly string[]) =>
  (file: string) =>
    files.includes(file);

describe("what the instructions cite (pure)", () => {
  it("a path that does not resolve against any declared root is reported with its line", () => {
    const cites = [{ line: 7, text: "application/merchant/policies/signature-window.ts" }];
    expect(lib.pathProblems(cites, policy(), only()).problems).toEqual([
      "7: path that does not exist: application/merchant/policies/signature-window.ts",
    ]);
  });

  it("a path abbreviated against a declared root resolves", () => {
    const cites = [{ line: 1, text: "domain/experiment/" }];
    const found = lib.pathProblems(cites, policy(), only("src/domain/experiment"));
    expect(found).toEqual({ problems: [], checked: 1 });
  });

  it("braces name two files and both are checked", () => {
    expect(lib.branches("generated/problem-types.{js,d.ts}")).toEqual([
      "generated/problem-types.js",
      "generated/problem-types.d.ts",
    ]);
    const cites = [{ line: 1, text: "generated/problem-types.{js,d.ts}" }];
    expect(lib.pathProblems(cites, policy(), only("generated/problem-types.js")).problems).toEqual([
      "1: path that does not exist: generated/problem-types.{js,d.ts}",
    ]);
  });

  // This is the case that separates a useful gate from one that gets switched off: measured, a
  // naive check reports seventy-five of these on the real document.
  it.each([
    ["a template", "src/domain/<module>/errors.ts"],
    ["a glob", "src/application/*/ports/"],
    ["a shape name", "errors.ts"],
    ["a shape directory", "ports/"],
    ["a lint rule", "ope/no-magic-strings"],
    ["a package", "@typescript/native"],
    ["a slash command", "/speckit-plan"],
    ["prose with spaces", "npm run quality"],
  ])("does not read %s as a path", (_what, cite) => {
    expect(lib.namesAPlace(cite, policy())).toBe(false);
  });

  it("a declared exception is not reported, and a citation without one is", () => {
    const cites = [
      { line: 1, text: "origin/main" },
      { line: 2, text: "other/thing.ts" },
    ];
    expect(lib.pathProblems(cites, policy(), only()).problems).toEqual([
      "2: path that does not exist: other/thing.ts",
    ]);
  });

  it("an exception without a reason, or naming both things, is a problem", () => {
    expect(lib.policyProblems(policy({ exceptions: [{ cite: "x", reason: " " }] }))).toEqual([
      "0: exception without a reason: x",
    ]);
    expect(lib.policyProblems(policy({ exceptions: [{ cite: "x", script: "y", reason: "both" }] }))).toEqual([
      "0: exception 0 names neither a citation nor a script, or names both",
    ]);
  });

  it("an implicit root that climbs out of the repository is a problem (feature 026)", () => {
    // It made the gate answer differently on every machine: green locally, where the MVP documents
    // sit in the parent directory, and impossible on CI, which checks out the repository alone.
    expect(lib.policyProblems(policy({ implicitRoots: ["", "../", "C:/tmp/", "/etc/"] }))).toEqual([
      "0: implicit root outside the repository: ../",
      "0: implicit root outside the repository: C:/tmp/",
      "0: implicit root outside the repository: /etc/",
    ]);
    expect(lib.policyProblems(policy({ implicitRoots: ["", "src/", "contracts/"] }))).toEqual([]);
  });

  it("fenced blocks are not read: code shown is not a broken reference", () => {
    const markdown = ["`a/b.ts`", "```", "`c/d.ts`", "```", "`e/f.ts`"].join("\n");
    expect(lib.citations(markdown).map((c) => c.text)).toEqual(["a/b.ts", "e/f.ts"]);
  });
});

describe("the commands table (pure)", () => {
  const table = [
    "## Commands",
    "",
    "| Command | What it does |",
    "| --- | --- |",
    "| `npm run quality` | runs the gates |",
    "| `npm run build` / `dev` / `typecheck` | builds, serves, checks |",
    "",
    "## Other",
    "",
    "| `npm run outside-the-table` | does not count |",
  ].join("\n");

  it("reads a combined cell: three commands in three shapes", () => {
    const range = lib.sectionRange(table, "Commands");
    const found = lib.commandProblems(table, ["quality", "build", "dev", "typecheck"], policy(), {
      table: range,
      inventory: "",
    });
    expect(found).toEqual({ problems: [], checked: 4 });
  });

  it("only the first cell counts, and only inside the table", () => {
    const range = lib.sectionRange(table, "Commands");
    const found = lib.commandProblems(table, ["quality", "build", "dev", "typecheck"], policy(), {
      table: range,
      inventory: "",
    });
    expect(found.problems).toEqual([]);
    // `outside-the-table` is in another section: it neither counts as documented nor is reported.
    expect(found.checked).toBe(4);
  });

  it("reports in both directions, and respects a declared exception", () => {
    const range = lib.sectionRange(table, "Commands");
    const scripts = ["quality", "build", "dev", "typecheck", "invented", "prepare"];
    const found = lib.commandProblems(
      table,
      scripts,
      policy({
        exceptions: [{ script: "prepare", reason: "an npm hook" }],
      }),
      { table: range, inventory: "" },
    );
    expect(found.problems).toEqual(["0: command of the repository that the table does not name: invented"]);
    const missing = lib.commandProblems(table, ["quality", "dev", "typecheck"], policy(), {
      table: range,
      inventory: "",
    });
    expect(missing.problems).toContain("6: command that does not exist: build");
  });
});

describe("the sections and their policy (pure)", () => {
  const doc = ["## One", "", "## Two", "", "### Three"].join("\n");

  it("a section without a policy, and a policy without a section, are both problems", () => {
    const found = lib.sectionProblems(
      doc,
      entry([
        { heading: "One", kind: "normative" },
        { heading: "Retired", kind: "normative" },
      ]),
    );
    expect(found.problems).toEqual([
      "3: section without a policy: Two",
      "5: section without a policy: Three",
      "0: policy for a section that does not exist: Retired",
    ]);
  });

  it("a mixed section without a reason is the same as not classifying it", () => {
    const sections = [
      { heading: "One", kind: "mixed" },
      { heading: "Two", kind: "mixed", reason: "pending" },
      { heading: "Three", kind: "made-up" },
    ];
    expect(lib.sectionProblems(doc, entry(sections)).problems).toEqual([
      "1: mixed section without a reason: One",
      '5: unknown kind "made-up": Three',
    ]);
  });
});

describe("the limit of the core and the scope of a rule (pure)", () => {
  // The number is the one the official documentation publishes, and its reason is what matters: a
  // longer file is obeyed worse. The limit counts the pointers the moved sections leave behind —
  // a core that only fits by not counting what it carries does not fit.
  it("a core over its limit is reported with the two numbers", () => {
    const long = Array.from({ length: 12 }, (_, n) => `line ${n}`).join("\n");
    expect(lib.coreSizeProblems(long, 10)).toEqual(["0: the core has 12 lines; the limit is 10"]);
    expect(lib.coreSizeProblems(long, 12)).toEqual([]);
  });

  it("a rule that is not scoped and gives no reason is reported; with a reason it is not", () => {
    const rule = (over: Partial<InstructionFile>): InstructionFile => ({
      file: ".claude/rules/x.md",
      role: "rule",
      sections: [],
      ...over,
    });
    expect(lib.scopeProblems(policy({ files: [rule({})] }), () => true)).toEqual([
      "0: rule that is not scoped and gives no reason: .claude/rules/x.md",
    ]);
    const excused = policy({ files: [rule({ unscopedReason: "it applies everywhere" })] });
    expect(lib.scopeProblems(excused, () => true)).toEqual([]);
  });

  // A rule scoped to something that is not there never loads, and nothing else would say so.
  it("a scope that matches no file is reported", () => {
    const scoped = policy({
      files: [{ file: ".claude/rules/x.md", role: "rule", paths: ["src/nowhere/**"], sections: [] }],
    });
    expect(lib.scopeProblems(scoped, () => false)).toEqual([
      "0: the scope matches no file: .claude/rules/x.md → src/nowhere/**",
    ]);
    expect(lib.scopeProblems(scoped, () => true)).toEqual([]);
  });

  it("the policy declares exactly one core, and roles it knows", () => {
    const two = policy({
      files: [
        { file: "A.md", role: "core", sections: [] },
        { file: "B.md", role: "core", sections: [] },
      ],
    });
    expect(lib.policyProblems(two)).toContain("0: the policy declares 2 cores; it declares one");
    const odd = policy({
      files: [
        { file: "A.md", role: "core", sections: [] },
        { file: "B.md", role: "other", sections: [] },
      ],
    });
    expect(lib.policyProblems(odd)).toContain('0: unknown role "other": B.md');
  });
});

describe("the real instructions", () => {
  it("every section of CLAUDE.md is classified, and no mixed one lacks its reason", () => {
    const markdown = readFileSync("CLAUDE.md", "utf8");
    const core = real.files.find((x) => x.role === "core");
    if (!core) throw new Error("the policy declares no core");
    expect(lib.sectionProblems(markdown, core).problems).toEqual([]);
    expect(core.sections.filter((x) => x.kind === "mixed" && !x.reason)).toEqual([]);
  });

  it("the commands section the policy names exists in the document", () => {
    const markdown = readFileSync("CLAUDE.md", "utf8");
    expect(lib.sectionRange(markdown, real.commandsSection)).toBeDefined();
  });
});
