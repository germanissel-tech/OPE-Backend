import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Varias pruebas invocan CLIs (Spectral, Redocly, oasdiff): margen amplio.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
