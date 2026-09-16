import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Fixtures may look like tests (a duplication fixture named *.test.ts): they are inputs, not suites.
    exclude: ["**/node_modules/**", "**/fixtures/**"],
    // Several tests invoke CLIs (Spectral, Redocly, oasdiff): a wide margin.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
