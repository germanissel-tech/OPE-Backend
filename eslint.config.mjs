// Lint del repositorio (ADR-011). Hace cumplir "TypeScript strict, sin any" de CLAUDE.md:
// reglas type-aware en modo estricto sobre src/ y tests/; los scripts JS se lintean sin tipos
// (sus tipos los verifica tsconfig.scripts.json con checkJs). El formato es de Prettier:
// eslint-config-prettier va al final y apaga toda regla estilística.
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
    // Generados y fixtures con violaciones deliberadas (misma lista que .prettierignore).
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/generated/**",
      "contracts/dist/**",
      "docs/api/**",
      ".schemathesis/**",
      "tests/architecture/fixtures/**",
      "tests/contract-rules/fixtures/**",
      "tests/governance/fixtures/**",
      "tests/lint/fixtures/**",
      "tests/typecheck/fixtures/**",
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
      // Tipado fuerte (FR-001). Las no-unsafe-* ya vienen en strictTypeChecked; se repiten las
      // que la spec nombra para que no dependan de la preset.
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
      // `async` sin `await` es conformidad de interfaz (los manejadores devuelven Promise por
      // contrato); la seguridad real la dan no-floating-promises y no-misused-promises.
      "@typescript-eslint/require-await": "off",
      // Imports: sólo orden y duplicados. La resolución la garantiza tsc (research R-01).
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
      // Excepciones: siempre con motivo (FR-002).
      "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
      "@eslint-community/eslint-comments/no-unused-disable": "error",
    },
  },
  {
    // JavaScript: sin información de tipos (checkJs los verifica en tsconfig.scripts.json).
    files: JS_FILES,
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Funciones custom de Spectral y configs .cjs: CommonJS por diseño (ADR-004).
    files: COMMONJS_FILES,
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  { files: TS_FILES, rules: {} },
  prettier,
);
