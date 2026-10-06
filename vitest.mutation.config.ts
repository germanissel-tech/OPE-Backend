// The test suite Stryker runs against every mutant (ADR-016): the `fast` project without the
// tests that measure time or size. Those are informative (latency percentiles, a 50 000-variant
// snapshot); they take seconds per run, cover the whole pipeline, and kill nothing the unit and
// integration tests do not — they only stretch the mutation run past the CI budget. A flat
// configuration on purpose: the Stryker runner reads one suite, not projects.
//
// **The durability suite does run here**, and it has to: the gateways of a store have no other
// coverage (feature 030, research R-06), so leaving it out would make every mutant of every durable
// gateway a survivor. Its two latency files are the exception, for the same reason as the three
// above — feature 033 gave one of them four applications and a seed of twenty merchants, which is
// seconds per mutant to kill nothing.
import { defineConfig } from "vitest/config";
import { MEASURED_SUITES, TOOL_SUITES } from "./vitest.config.js";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/fixtures/**",
      ...TOOL_SUITES,
      // The six measured ones, by the one declaration that names them (feature 039). They used to be listed
      // here by hand, and that is how three of them ended up running in no job at all: a list in the
      // configuration of one tool was the only place that knew they existed. What each measures and why the
      // exclusion is the same for the six is in `MEASURED_SUITES`.
      ...MEASURED_SUITES,
    ],
    // **Three minutes and not the one the suite uses on its own** (feature 034). Everything here runs
    // instrumented, with five runner processes on one machine, so a hook that seeds four hundred rows per
    // test costs a multiple of what it costs directly: the seeding of `tests/durability/query-plans.test.ts` — 200 diagnostics and
    // 200 decisions per test, eight tests — crossed sixty seconds inside the sandbox while the same suite
    // passes in under three minutes whole. A timeout there is a fact about the sandbox and not about the
    // code, and it fails the whole run before a single mutant is judged, which is the worst way to learn it.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
