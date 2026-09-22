// Feature 019 D-01 (ADR-032, SC-01-2): the audit skills are the method and nothing else. No
// script of .claude/skills/auditing-architecture or conditioning-project imports or reads a
// path outside those two skills nor a package beyond `node:`; every skill has its SKILL.md
// with a name. They live in the repository like the spec-kit ones: no global installation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SKILLS = ["auditing-architecture", "conditioning-project"].map((s) => path.join(".claude/skills", s));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const IMPORT =
  /\b(?:import\s+[^"'`]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s+[^"'`]*?from\s*)["'`]([^"'`]+)["'`]/gu;
const READ = /\b(?:readFileSync|readFile|existsSync|readdirSync)\s*\(\s*["'`]([^"'`]+)["'`]/gu;
const inside = (target: string) => SKILLS.some((s) => target.startsWith(path.resolve(s)));

/** Every import or read of a file that is not a node: module nor a file of the two skills. */
function importProblems(file: string, content: string): string[] {
  const problems: string[] = [];
  for (const match of content.matchAll(IMPORT)) {
    const specifier = match[1] ?? "";
    if (specifier.startsWith("node:")) continue;
    const own = specifier.startsWith("./") || specifier.startsWith("../");
    if (!own) {
      problems.push(`${file}: imports "${specifier}" (a package)`);
    } else if (!inside(path.resolve(path.dirname(file), specifier))) {
      problems.push(`${file}: imports "${specifier}" (outside the skills)`);
    }
  }
  for (const match of content.matchAll(READ)) {
    const literal = match[1] ?? "";
    if (literal.includes("/") && !literal.startsWith("./"))
      problems.push(`${file}: reads "${literal}" by path`);
  }
  return problems;
}

describe("the audit skills depend on nothing of this repository", () => {
  const scripts = SKILLS.flatMap(walk).filter(
    (f) => /\.(mjs|cjs|js)$/u.test(f) && !f.includes(`${path.sep}fixture${path.sep}`),
  );

  it("has scripts to check", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it("imports only node: modules and their own files", () => {
    const problems = scripts.flatMap((file) => importProblems(file, readFileSync(file, "utf8")));
    expect(problems).toEqual([]);
  });

  it("never names this repository's tooling", () => {
    // Names of this repository, not of the tools (a detector may name `eslint.config.*`: every
    // ESLint project has one) nor of the conventions the skills propose (`scripts/audit/`).
    const forbidden = ["scripts/lib.mjs", "governance-lib", "shape-rules", "OPE-Backend"];
    const problems = SKILLS.flatMap(walk)
      .filter((f) => /\.(mjs|md|json)$/u.test(f))
      .flatMap((f) =>
        forbidden.filter((word) => readFileSync(f, "utf8").includes(word)).map((word) => `${f}: ${word}`),
      );
    expect(problems).toEqual([]);
  });

  it("every skill has a SKILL.md whose frontmatter names it", () => {
    for (const skill of SKILLS) {
      const content = readFileSync(path.join(skill, "SKILL.md"), "utf8");
      expect(content, skill).toMatch(new RegExp(`^---\\nname: ${path.basename(skill)}\\n`, "u"));
    }
  });
});
