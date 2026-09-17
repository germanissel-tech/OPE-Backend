// Test application: the whole graph through the composition root with the in-memory profile,
// dos merchants fijos y reemplazos puntuales (reloj, puertos, manejadores).
import path from "node:path";
import { bootstrap, type App, type BootstrapOverrides } from "../../src/composition/bootstrap.js";
import type { Clock } from "../../src/application/shared-kernel/index.js";
import type { AppConfig, MerchantConfig } from "../../src/composition/config.js";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";

const merchantA: MerchantConfig = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1", "key-a-2"],
  origins: ["https://a.example"],
};
const merchantB: MerchantConfig = {
  merchantId: "m_b",
  ingestKeys: ["key-b-1"],
  origins: ["https://b.example", "https://shop.b.example:8443"],
};
const testMerchants: MerchantConfig[] = [merchantA, merchantB];

const testConfig = (over: Partial<AppConfig> = {}): AppConfig => ({
  port: 0,
  host: "127.0.0.1",
  contractPath: path.resolve("contracts/dist/openapi.yaml"),
  merchants: testMerchants,
  ...over,
});

export function fixedClock(at: string | Date): Clock {
  const date = typeof at === "string" ? new Date(at) : at;
  return { now: () => date };
}

/** Starts the whole app; `logger: false` unless the override says otherwise. */
export async function startTestApp(
  overrides: BootstrapOverrides = {},
  config: Partial<AppConfig> = {},
): Promise<App> {
  return bootstrap(testConfig(config), { logger: false, ...overrides });
}

/** A valid event with unique ids; `over` overrides any field (even with garbage, on purpose). */
export function eventOf(n: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "product_viewed",
    eventId: `evt_${String(n).padStart(8, "0")}`,
    sessionId: "ses_00000001",
    visitorId: "vis_00000001",
    occurredAt: new Date().toISOString(),
    page: { pageType: "product", productId: "SKU-1" },
    device: "mobile",
    ...over,
  };
}

/** Batch of `n` valid events of the same session, with unique ids starting at `from`. */
export function batchOf(n: number, from = 1, over: Record<string, unknown> = {}): { events: unknown[] } {
  return { events: Array.from({ length: n }, (_, i) => eventOf(from + i, over)) };
}

interface PostOptions {
  key?: string;
  origin?: string;
  remoteAddress?: string;
}

function post(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  o: PostOptions,
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.key !== undefined) headers["x-ope-ingest-key"] = o.key;
  if (o.origin !== undefined) headers["origin"] = o.origin;
  const options: InjectOptions = { method: "POST", url, headers };
  if (payload !== undefined) options.payload = payload as Exclude<InjectOptions["payload"], undefined>;
  if (o.remoteAddress !== undefined) options.remoteAddress = o.remoteAddress;
  return app.inject(options);
}

export const postEvents = (app: FastifyInstance, batch: unknown, o: PostOptions = {}) =>
  post(app, "/v1/events", batch, o);

export const postExposure = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/exposures", body, o);
