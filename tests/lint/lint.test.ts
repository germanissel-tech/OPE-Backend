// US1 (FR-001..FR-003, FR-051): every key lint rule catches its fixture; the valid fixture
// passes clean. Uses the same configuration as `npm run lint`, only removing the fixture
// exclusion and pointing the parser at the tsconfig that includes them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const fixtures = path.resolve("tests/lint/fixtures");

const expected: Record<string, string> = {
  "no-explicit-any.ts": "@typescript-eslint/no-explicit-any",
  "no-unsafe-assignment.ts": "@typescript-eslint/no-unsafe-assignment",
  "no-unsafe-call.ts": "@typescript-eslint/no-unsafe-call",
  "no-unsafe-member-access.ts": "@typescript-eslint/no-unsafe-member-access",
  "no-floating-promises.ts": "@typescript-eslint/no-floating-promises",
  "no-misused-promises.ts": "@typescript-eslint/no-misused-promises",
  "no-non-null-assertion.ts": "@typescript-eslint/no-non-null-assertion",
  "switch-exhaustiveness-check.ts": "@typescript-eslint/switch-exhaustiveness-check",
  "consistent-type-imports.ts": "@typescript-eslint/consistent-type-imports",
  "import-order.ts": "import-x/order",
  "no-duplicates.ts": "import-x/no-duplicates",
  "disable-without-reason.ts": "@eslint-community/eslint-comments/require-description",
  "ts-expect-error-without-description.ts": "@typescript-eslint/ban-ts-comment",
  // Shape of the code (ADR-016, FR-010, FR-011).
  "cognitive-complexity.ts": "sonarjs/cognitive-complexity",
  "max-depth.ts": "max-depth",
  "max-params.ts": "max-params",
  "as-src/max-lines-per-function.ts": "max-lines-per-function",
  "no-identical-functions.ts": "sonarjs/no-identical-functions",
  "no-all-duplicated-branches.ts": "sonarjs/no-all-duplicated-branches",
  "no-identical-conditions.ts": "sonarjs/no-identical-conditions",
  "no-collapsible-if.ts": "sonarjs/no-collapsible-if",
  "no-redundant-boolean.ts": "sonarjs/no-redundant-boolean",
  "no-ignored-exceptions.ts": "sonarjs/no-ignored-exceptions",
  // Only under src/ (FR-012): the fixture is linted as if it lived there.
  "as-src/no-magic-numbers.ts": "@typescript-eslint/no-magic-numbers",
};

let eslint: ESLint;

beforeAll(async () => {
  // The same configuration as `npm run lint`, without the `ignores` block (fixtures are
  // excluded on purpose) and with the parser pointing at the tsconfig that does include them.
  const mod = (await import(pathToFileURL(path.resolve("eslint.config.mjs")).href)) as {
    default: Linter.Config[];
    SHAPE_RULES: Linter.RulesRecord;
    SRC_ONLY_RULES: Linter.RulesRecord;
    TEST_ONLY_RULES: Linter.RulesRecord;
  };
  const withoutGlobalIgnores = mod.default.filter((c) => !(Object.keys(c).length === 1 && "ignores" in c));
  eslint = new ESLint({
    cwd: path.resolve("."),
    overrideConfigFile: true,
    overrideConfig: [
      ...withoutGlobalIgnores,
      {
        files: ["**/*.ts"],
        languageOptions: { parserOptions: { project: ["./tsconfig.lint-fixtures.json"] } },
      },
      // The scoped rule sets of the real config, applied to the fixtures that stand in for src/ and tests/.
      { files: ["**/fixtures/as-src/**/*.ts"], rules: { ...mod.SHAPE_RULES, ...mod.SRC_ONLY_RULES } },
      { files: ["**/fixtures/as-test/**/*.ts"], rules: mod.TEST_ONLY_RULES },
    ],
  });
});

async function lint(file: string): Promise<{ ruleId: string | null; severity: number; message: string }[]> {
  const [result] = await eslint.lintFiles([path.join(fixtures, file)]);
  return (result?.messages ?? []).map((m) => ({
    ruleId: m.ruleId,
    severity: m.severity,
    message: m.message,
  }));
}

describe("lint: strong typing that is enforced", () => {
  it.each(Object.entries(expected))("%s fails with %s", async (file, rule) => {
    const messages = await lint(file);
    const hit = messages.find((m) => m.ruleId === rule);
    expect(hit, `no ${rule}; got: ${messages.map((m) => m.ruleId).join(", ")}`).toBeDefined();
    expect(hit?.severity).toBe(2);
  });

  it("unused-disable.ts fails: a directive that no longer applies is an error (ESLint core)", async () => {
    const messages = await lint("unused-disable.ts");
    const hit = messages.find((m) => m.message.includes(["Unused eslint", "disable directive"].join("-")));
    expect(hit, `obtenido: ${JSON.stringify(messages)}`).toBeDefined();
    expect(hit?.severity).toBe(2);
  });

  it("valid.ts passes without messages", async () => {
    expect(await lint("valid.ts")).toEqual([]);
  });
});

describe("lint: shape of the code by scope (ADR-016)", () => {
  it("0, 1, -1 and array indexes are not magic numbers under src/", async () => {
    expect(await lint("as-src/magic-numbers-allowed.ts")).toEqual([]);
  });

  it("long functions and magic numbers are allowed under tests/", async () => {
    expect(await lint("as-test/long-function.ts")).toEqual([]);
  });

  it("every numeric threshold in eslint.config.mjs has a reason next to it (FR-013)", () => {
    const config = readFileSync(path.resolve("eslint.config.mjs"), "utf8").split(/\r?\n/);
    const thresholds = [
      /"sonarjs\/cognitive-complexity": \["error", 15\]/,
      /"max-depth": \["error", 3\]/,
      /"max-params": \["error", 4\]/,
      /"max-lines-per-function": \["error", \{ max: 60/,
    ];
    for (const threshold of thresholds) {
      const at = config.findIndex((line) => threshold.test(line));
      expect(at, String(threshold)).toBeGreaterThan(0);
      const previous = config[at - 1] ?? "";
      expect(previous.trim().startsWith("//"), `no reason above ${String(threshold)}`).toBe(true);
    }
  });
});
