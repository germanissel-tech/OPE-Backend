// US1 (FR-001..FR-003, FR-051): cada regla clave de lint atrapa su fixture; el fixture válido
// pasa limpio. Usa la misma configuración que `npm run lint`, sólo quitando la exclusión de
// fixtures y apuntando el parser al tsconfig que los incluye.
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
  // La misma configuración de `npm run lint`, sin el bloque de `ignores` (los fixtures están
  // excluidos a propósito) y con el parser apuntando al tsconfig que sí los incluye.
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

describe("lint: tipado fuerte que se hace cumplir", () => {
  it.each(Object.entries(expected))("%s falla con %s", async (file, rule) => {
    const messages = await lint(file);
    const hit = messages.find((m) => m.ruleId === rule);
    expect(hit, `sin ${rule}; obtenido: ${messages.map((m) => m.ruleId).join(", ")}`).toBeDefined();
    expect(hit?.severity).toBe(2);
  });

  it("unused-disable.ts falla: una directiva que ya no aplica es un error (core de ESLint)", async () => {
    const messages = await lint("unused-disable.ts");
    const hit = messages.find((m) => m.message.includes(["Unused eslint", "disable directive"].join("-")));
    expect(hit, `obtenido: ${JSON.stringify(messages)}`).toBeDefined();
    expect(hit?.severity).toBe(2);
  });

  it("valid.ts pasa sin mensajes", async () => {
    expect(await lint("valid.ts")).toEqual([]);
  });
});
