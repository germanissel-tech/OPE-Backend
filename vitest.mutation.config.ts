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
import { TOOL_SUITES } from "./vitest.config.js";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/fixtures/**",
      ...TOOL_SUITES,
      "tests/integration/ingest-latency.test.ts",
      "tests/integration/catalog-size.test.ts",
      "tests/integration/outcomes-latency.test.ts",
      "tests/durability/ingest-latency.test.ts",
      "tests/durability/rebuild-latency.test.ts",
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
