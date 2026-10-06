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
/**
 * The tests that **measure**: a figure against a ceiling, rather than a guarantee (feature 039).
 *
 * **The border is the clock, not the directory**: if the result can change because the machine is busy, it
 * measures. `tests/durability/query-plans.test.ts` lives beside two of these and asserts that an index is
 * used, which is true or false whatever the machine is doing; the three below report a percentile, a size or
 * the cost of a turn, and their ceiling was calibrated on one machine.
 *
 * Paths and not globs, on purpose: a path can be checked against the disk, and a glob can only be
 * interpreted again. `check:suite-coverage` crosses this list with `tests/durability/` in **both**
 * directions, so a file that belongs to no category and a declaration whose file is gone both fail the build.
 *
 * **What each reader does with it** (and why the gate is not the same for all six): the mutation runner
 * excludes them all, because they cost seconds per mutant and kill nothing the rest does not. The three of
 * `fast` keep running in that project, where they have been green since feature 004 and cost seconds against
 * in-memory stores. The three of `durability` do **not** gate: their ceiling was measured against a real
 * store on a development machine and never ran in CI at all, so demanding it on a runner would be demanding
 * a number nobody measured there. `npm run test:measures` is what runs them when somebody wants the figure.
 */
export const MEASURED_SUITES = [
  "tests/integration/ingest-latency.test.ts",
  "tests/integration/catalog-size.test.ts",
  "tests/integration/outcomes-latency.test.ts",
  "tests/durability/ingest-latency.test.ts",
  "tests/durability/rebuild-latency.test.ts",
  "tests/durability/admin-concurrency.test.ts",
];
/** The measured ones of the durability directory: what `measures` runs and `durability` leaves out. */
export const MEASURED_DURABILITY_SUITES = MEASURED_SUITES.filter((file) =>
  file.startsWith("tests/durability/"),
);
/** Several tests invoke CLIs (Spectral, Redocly, oasdiff): a wide margin. */
const TIMEOUTS = { testTimeout: 60_000, hookTimeout: 60_000 };
/**
 * What a project over `tests/durability/` is, whichever half of it it runs.
 *
 * **The two come from this one object and not from two copies**: a store is a file, so one file at a time
 * with its own process and its own temporary directory is not a preference of the gated half — it is what
 * makes any of those tests mean something. Written twice, the day somebody tunes one the other keeps the old
 * value and nobody notices until two suites write the same store.
 */
const OVER_A_STORE = { exclude: NOT_SUITES, fileParallelism: false, ...TIMEOUTS } as const;

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
          ...OVER_A_STORE,
          // The behaviour half, which is what decides whether a change enters (feature 039): the measured
          // ones are excluded here and run in `measures`.
          exclude: [...NOT_SUITES, ...MEASURED_DURABILITY_SUITES],
        },
      },
      {
        test: {
          name: "measures",
          // The other half of the same directory. `--exclude` on the command line does not trim a project's
          // `include`, which is why the split lives here and not in a flag (feature 039, research R-03).
          include: MEASURED_DURABILITY_SUITES,
          ...OVER_A_STORE,
        },
      },
    ],
  },
});
