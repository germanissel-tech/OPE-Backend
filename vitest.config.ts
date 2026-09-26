// Three projects (015 F-055; feature 030): `fast` is the suite a change is judged by — units,
// integration (`fastify.inject`), contract rules, governance, architecture — `tools` the few tests
// that run whole toolchains (an audit over fixtures, the quality chain, the documentation build)
// and take minutes on their own, and `durability` the ones that close a store and reopen it.
// `npm test` runs `fast`; `npm run test:tools` and `npm run test:durability` the others; CI all.
import { defineConfig } from "vitest/config";

/** Fixtures may look like tests (a duplication fixture named *.test.ts): they are inputs, not suites. */
const NOT_SUITES = ["**/node_modules/**", "**/fixtures/**"];
/** The tests that run whole toolchains. */
export const TOOL_SUITES = [
  "tests/audit/**/*.test.ts",
  "tests/docs/**/*.test.ts",
  "tests/governance/quality.test.ts",
  "tests/unit/contract-docs.test.ts",
];
/**
 * The tests that cross a restart. They are apart from `fast` on purpose (feature 030, research
 * R-06): the 1372 tests of `fast` prove **behaviour**, and behaviour does not change with where a
 * record is kept, so running them through disk would make them slower without proving anything
 * new. What only shows up by shutting down and starting again is what these prove, and they are
 * the **only** cover the durable gateways have — which is why they take a case per port and per
 * guarantee rather than a sample.
 */
export const DURABILITY_SUITES = ["tests/durability/**/*.test.ts"];
/** Several tests invoke CLIs (Spectral, Redocly, oasdiff): a wide margin. */
const TIMEOUTS = { testTimeout: 60_000, hookTimeout: 60_000 };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "fast",
          include: ["tests/**/*.test.ts"],
          exclude: [...NOT_SUITES, ...TOOL_SUITES, ...DURABILITY_SUITES],
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
      {
        test: {
          name: "durability",
          include: DURABILITY_SUITES,
          exclude: NOT_SUITES,
          // A store is a file, and two suites writing the same one would prove nothing about
          // either. Each file gets its own process and its own temporary directory.
          fileParallelism: false,
          ...TIMEOUTS,
        },
      },
    ],
  },
});
