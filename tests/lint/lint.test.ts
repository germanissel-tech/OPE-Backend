// US1 (FR-001..FR-003, FR-051): every key lint rule catches its fixture; the valid fixture
// passes clean. Uses the same configuration as `npm run lint`, only removing the fixture
// exclusion and pointing the parser at the tsconfig that includes them.
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
};

let eslint: ESLint;

beforeAll(async () => {
  // The same configuration as `npm run lint`, without the `ignores` block (fixtures are
  // excluded on purpose) and with the parser pointing at the tsconfig that does include them.
  const mod = (await import(pathToFileURL(path.resolve("eslint.config.mjs")).href)) as {
    default: Linter.Config[];
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
