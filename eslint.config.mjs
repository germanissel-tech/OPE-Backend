// Repository lint (ADR-011). Enforces the "TypeScript strict, no any" of CLAUDE.md: type-aware
// rules in strict mode over src/ and tests/; JS scripts are linted without types (their types
// are verified by tsconfig.scripts.json with checkJs). Formatting belongs to Prettier:
// eslint-config-prettier goes last and turns off every stylistic rule.
import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";
import ope from "./scripts/lint/plugin.mjs";

const TS_FILES = ["**/*.ts", "**/*.mts", "**/*.cts"];
const JS_FILES = ["**/*.js", "**/*.mjs", "**/*.cjs"];
const COMMONJS_FILES = ["contracts/rules/functions/*.js", "**/*.cjs"];

// Shape of the code (ADR-016, FR-010..FR-013). Every threshold carries its reason; a value
// without one is a "voodoo constant". These apply everywhere unless a scope below says otherwise.
export const SHAPE_RULES = {
  // 15 is the threshold of Sonar's original cognitive-complexity paper (Campbell, 2018): past it
  // a function is no longer understood in one reading.
  "sonarjs/cognitive-complexity": ["error", 15],
  // From the fourth nesting level the eye loses the condition that opened the block: extract.
  "max-depth": ["error", 3],
  // More than four positional arguments get mixed up; the alternative is a named options object.
  "max-params": ["error", 4],
  // One screen. Blank lines and comments do not count: prose is not logic.
  "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
  // Semantic duplication (FR-011): same knowledge written twice, or a branch that adds nothing.
  "sonarjs/no-identical-functions": "error",
  "sonarjs/no-all-duplicated-branches": "error",
  "sonarjs/no-identical-conditions": "error",
  "sonarjs/no-collapsible-if": "error",
  "sonarjs/no-redundant-boolean": "error",
  // An ignored error is a silent NO_OP without a reason (constitution II).
  "sonarjs/no-ignored-exceptions": "error",
};

// Production code only (FR-012): rates 0–1 and times in ms are exactly what must be named.
// 0, 1 and -1 are structural (empty, first, not found), as are array and type indexes.
export const SRC_ONLY_RULES = {
  "@typescript-eslint/no-magic-numbers": [
    "error",
    { ignore: [0, 1, -1], ignoreArrayIndexes: true, ignoreTypeIndexes: true, ignoreEnums: true },
  ],
  // The string counterpart (scripts/lint/no-magic-strings.mjs): a literal repeated in a file where
  // some occurrence is not checked by a literal type. Typed catalogues (`ProblemSlug`, `NodeJS.Signals`)
  // are the compiler's constants and stay as literals; anything else repeated gets a name.
  "ope/no-magic-strings": "error",
};

// Shape of the application and domain rings (ADR-023): use cases, dependencies and errors have
// one form, verified with the type checker. Each block applies where the form is defined; the
// globs match the lint fixtures that stand in for those folders too.
export const APPLICATION_RULES = {
  "ope/dependencies-are-interfaces": ["error", { maxDependencies: 6 }],
  "ope/no-throw-domain-error": "error",
  "ope/no-generic-catch-in-application": "error",
};
export const USE_CASE_RULES = { "ope/use-case-shape": "error" };
export const DOMAIN_RULES = {
  "ope/no-throw-domain-error": "error",
  // ADR-024: a rule lives with its concept; only the shared-kernel primitives are loose functions.
  "ope/domain-no-loose-functions": [
    "error",
    { allow: ["/ids.ts", "shared-kernel/result.ts", "shared-kernel/time.ts"] },
  ],
};
export const DOMAIN_ERROR_RULES = { "ope/domain-error-shape": "error" };

// Tests: a `describe` callback groups cases, it is not logic; literal values in assertions are
// the point of the test, not magic.
export const TEST_ONLY_RULES = {
  "max-lines-per-function": "off",
  "@typescript-eslint/no-magic-numbers": "off",
};

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
    plugins: { "import-x": importX, sonarjs, ope },
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
      ...SHAPE_RULES,
    },
  },
  { files: ["src/**/*.ts"], rules: SRC_ONLY_RULES },
  { files: ["**/application/**/*.ts"], rules: APPLICATION_RULES },
  { files: ["**/application/**/use-cases/*.ts"], rules: USE_CASE_RULES },
  { files: ["**/domain/**/*.ts"], rules: DOMAIN_RULES },
  { files: ["**/domain/*/errors.ts"], rules: DOMAIN_ERROR_RULES },
  { files: ["tests/**"], rules: TEST_ONLY_RULES },
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
