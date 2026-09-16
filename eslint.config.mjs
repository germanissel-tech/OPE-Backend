// Repository lint (ADR-011). Enforces the "TypeScript strict, no any" of CLAUDE.md: type-aware
// rules in strict mode over src/ and tests/; JS scripts are linted without types (their types
// are verified by tsconfig.scripts.json with checkJs). Formatting belongs to Prettier:
// eslint-config-prettier goes last and turns off every stylistic rule.
import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.ts", "**/*.mts", "**/*.cts"];
const JS_FILES = ["**/*.js", "**/*.mjs", "**/*.cjs"];
const COMMONJS_FILES = ["contracts/rules/functions/*.js", "**/*.cjs"];

export default tseslint.config(
  {
    // Generated files and fixtures with deliberate violations (same list as .prettierignore).
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/interface-adapters/http/generated/**",
      "contracts/dist/**",
      "docs/api/**",
      ".schemathesis/**",
      "tests/architecture/fixtures/**",
      "tests/contract-rules/fixtures/**",
      "tests/governance/fixtures/**",
      "tests/lint/fixtures/**",
      "tests/typecheck/fixtures/**",
      "tests/audit/fixtures/**",
      "patches/**",
      "reports/**",
      ".stryker-tmp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintComments.recommended,
  {
    plugins: { "import-x": importX },
    languageOptions: {
      parserOptions: { project: ["./tsconfig.typecheck.json"], tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      // Strong typing (FR-001). The no-unsafe-* rules already come with strictTypeChecked; the
      // ones the spec names are repeated so they do not depend on the preset.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `async` without `await` is interface conformance (handlers return a Promise by
      // contract); the real safety comes from no-floating-promises and no-misused-promises.
      "@typescript-eslint/require-await": "off",
      // Imports: order and duplicates only. Resolution is guaranteed by tsc (research R-01).
      "import-x/first": "error",
      "import-x/no-duplicates": ["error", { "prefer-inline": true }],
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // Exceptions: always with a reason (FR-002). The ones that no longer apply are reported by
      // linterOptions.reportUnusedDisableDirectives (core).
      "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
    },
  },
  {
    // JavaScript: without type information (checkJs verifies them in tsconfig.scripts.json).
    files: JS_FILES,
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Spectral custom functions and .cjs configs: CommonJS by design (ADR-004).
    files: COMMONJS_FILES,
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  { files: TS_FILES, rules: {} },
  prettier,
);
