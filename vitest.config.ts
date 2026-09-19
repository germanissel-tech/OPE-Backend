// Two projects (015 F-055): `fast` is the suite a change is judged by — units, integration
// (`fastify.inject`), contract rules, governance, architecture — and `tools` the few tests that
// run whole toolchains (an audit over fixtures, the quality chain, the documentation build) and
// take minutes on their own. `npm test` runs `fast`; `npm run test:tools` the other; CI both.
import { defineConfig } from "vitest/config";

/** Fixtures may look like tests (a duplication fixture named *.test.ts): they are inputs, not suites. */
const NOT_SUITES = ["**/node_modules/**", "**/fixtures/**"];
/** The tests that run whole toolchains. */
export const TOOL_SUITES = [
  "tests/audit/**/*.test.ts",
  "tests/governance/quality.test.ts",
  "tests/unit/contract-docs.test.ts",
];
/** Several tests invoke CLIs (Spectral, Redocly, oasdiff): a wide margin. */
const TIMEOUTS = { testTimeout: 60_000, hookTimeout: 60_000 };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "fast",
          include: ["tests/**/*.test.ts"],
          exclude: [...NOT_SUITES, ...TOOL_SUITES],
          ...TIMEOUTS,
        },
      },
      {
        test: {
          name: "tools",
          include: TOOL_SUITES,
          exclude: NOT_SUITES,
          ...TIMEOUTS,
        },
      },
    ],
  },
});
