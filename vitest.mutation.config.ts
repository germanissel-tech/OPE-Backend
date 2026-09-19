// The test suite Stryker runs against every mutant (ADR-016): the behavioural suite without the
// tests that measure time or size. Those are informative (latency percentiles, a 50 000-variant
// snapshot); they take seconds per run, cover the whole pipeline, and kill nothing the unit and
// integration tests do not — they only stretch the mutation run past the CI budget.
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "**/node_modules/**",
        "**/fixtures/**",
        "tests/integration/ingest-latency.test.ts",
        "tests/integration/catalog-size.test.ts",
        "tests/integration/outcomes-latency.test.ts",
      ],
    },
  }),
);
