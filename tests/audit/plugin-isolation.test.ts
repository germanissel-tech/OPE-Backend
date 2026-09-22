// Feature 019 D-01 (ADR-032, SC-01-2): the plugin is the method and nothing else. No file of
// plugins/ imports or reads a path outside plugins/ nor a package beyond `node:`; the plugin
// and the marketplace declare themselves; every skill has its SKILL.md with a name.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PLUGIN = "plugins/auditable-architecture";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const IMPORT =
  /\b(?:import\s+[^"'`]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s+[^"'`]*?from\s*)["'`]([^"'`]+)["'`]/gu;
const READ = /\b(?:readFileSync|readFile|existsSync|readdirSync)\s*\(\s*["'`]([^"'`]+)["'`]/gu;

/** Every import or read of a file that is not a node: module nor a file of the plugin. */
function importProblems(file: string, content: string): string[] {
  const problems: string[] = [];
  for (const match of content.matchAll(IMPORT)) {
    const specifier = match[1] ?? "";
    if (specifier.startsWith("node:")) continue;
    const own = specifier.startsWith("./") || specifier.startsWith("../");
    if (!own) {
      problems.push(`${file}: imports "${specifier}" (a package)`);
    } else if (!path.resolve(path.dirname(file), specifier).startsWith(path.resolve(PLUGIN))) {
      problems.push(`${file}: imports "${specifier}" (outside the plugin)`);
    }
  }
  for (const match of content.matchAll(READ)) {
    const literal = match[1] ?? "";
    if (literal.includes("/") && !literal.startsWith("./"))
      problems.push(`${file}: reads "${literal}" by path`);
  }
  return problems;
}

describe("the plugin depends on nothing of this repository", () => {
  const scripts = walk(PLUGIN).filter(
    (f) => /\.(mjs|cjs|js)$/u.test(f) && !f.includes(`${path.sep}fixture${path.sep}`),
  );

  it("has scripts to check", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it("imports only node: modules and its own files", () => {
    const problems = scripts.flatMap((file) => importProblems(file, readFileSync(file, "utf8")));
    expect(problems).toEqual([]);
  });

  it("never names this repository's tooling", () => {
    const forbidden = [
      "scripts/lib.mjs",
      "governance-lib",
      "shape-rules",
      "eslint.config",
      ".dependency-cruiser",
      "OPE-Backend",
    ];
    const problems = walk(PLUGIN)
      .filter((f) => /\.(mjs|md|json)$/u.test(f))
      .flatMap((f) =>
        forbidden.filter((word) => readFileSync(f, "utf8").includes(word)).map((word) => `${f}: ${word}`),
      );
    expect(problems).toEqual([]);
  });
});

describe("plugin and marketplace", () => {
  it("plugin.json declares name, semver version and description", () => {
    const manifest = JSON.parse(readFileSync(`${PLUGIN}/.claude-plugin/plugin.json`, "utf8")) as Record<
      string,
      unknown
    >;
    expect(manifest["name"]).toBe("auditable-architecture");
    expect(manifest["version"]).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(typeof manifest["description"]).toBe("string");
  });

  it("the marketplace of the repository points at the plugin directory", () => {
    const marketplace = JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8")) as {
      plugins: { name: string; source: string }[];
    };
    expect(marketplace.plugins.map((p) => [p.name, p.source])).toEqual([
      ["auditable-architecture", `./${PLUGIN}`],
    ]);
  });

  it("every skill of the plugin has a SKILL.md whose frontmatter names it", () => {
    for (const skill of readdirSync(`${PLUGIN}/skills`)) {
      const content = readFileSync(`${PLUGIN}/skills/${skill}/SKILL.md`, "utf8");
      expect(content, skill).toMatch(new RegExp(`^---\\nname: ${skill}\\n`, "u"));
    }
  });
});
