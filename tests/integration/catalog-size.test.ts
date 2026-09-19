// Feature 010 — SC-004 (ADR-025): a pilot-sized catalogue (5 000 products × 10 variants) is accepted in one
// operation. Reported measurement on the local profile; it fails only past a generous budget.
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { catalogProductOf, fixedClock, putCatalog, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const NOW = "2026-09-18T12:00:00.000Z";
const PRODUCTS = 5_000;
const VARIANTS_PER_PRODUCT = 10;
const BUDGET_MS = 2_000;

let app: App;
afterEach(async () => {
  await app.close();
});

describe("catalogue size (informative)", () => {
  it(`accepts ${PRODUCTS} products x ${VARIANTS_PER_PRODUCT} variants in one PUT`, async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const products = Array.from({ length: PRODUCTS }, (_, i) =>
      catalogProductOf(`P${i + 1}`, VARIANTS_PER_PRODUCT),
    );
    const payload = JSON.stringify({ capturedAt: NOW, products });
    const start = performance.now();
    const res = await putCatalog(app.app, payload, { platformKey: "platform-a-1" });
    const elapsed = performance.now() - start;
    console.info(
      `catalog size: ${PRODUCTS} products, ${PRODUCTS * VARIANTS_PER_PRODUCT} variants, ${(payload.length / 1024 / 1024).toFixed(1)} MiB in ${elapsed.toFixed(0)} ms`,
    );
    expect(res.statusCode).toBe(201);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
