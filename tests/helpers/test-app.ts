// Test application: the whole graph through the composition root with the local profile,
// dos merchants fijos y reemplazos puntuales (reloj, puertos, manejadores).
import path from "node:path";
import { bootstrap, type App, type BootstrapOverrides } from "../../src/composition/bootstrap.js";
import {
  parseCommercialPolicy,
  parseEvidenceProfile,
} from "../../src/composition/commercial-policy-config.js";
import { parseDecisionPolicy } from "../../src/composition/decision-policy-config.js";
import { Experiment } from "../../src/domain/experiment/index.js";
import { Merchant } from "../../src/domain/merchant/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { silentLogger } from "../../src/infrastructure/logging/pino-logger.js";
import type { Clock } from "../../src/application/shared-kernel/index.js";
import type { AppConfig, MerchantConfig } from "../../src/composition/config.js";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";

/** A merchant as a test writes it: the shape of OPE_MERCHANTS, built into entities by `configured`. */
export interface MerchantSpec {
  merchantId: string;
  ingestKeys: string[];
  platformKeys?: string[];
  origins: string[];
  experiments: {
    experimentId: string;
    treatmentPercent: number;
    seed: string;
    status: "active" | "closed";
    startedAt: string;
  }[];
  /** The raw shape of OPE_MERCHANTS[i].decisionPolicy; parsed like config.ts does. */
  decisionPolicy?: Record<string, unknown>;
  /** The raw shape of OPE_MERCHANTS[i].commercialPolicy; parsed like config.ts does. */
  commercialPolicy?: Record<string, unknown>;
  /** The raw shape of OPE_MERCHANTS[i].evidenceProfile; parsed like config.ts does. */
  evidenceProfile?: Record<string, unknown>;
}

const PERCENT = 100;

/** Builds the entities of a spec the way config.ts does; a spec that breaks a rule is a test bug. */
function configured(spec: MerchantSpec): MerchantConfig {
  const merchant = Merchant.of({
    merchantId: asMerchantId(spec.merchantId),
    ingestKeys: spec.ingestKeys,
    origins: spec.origins,
    platformKeys: spec.platformKeys ?? [],
  });
  if (!merchant.ok) throw new Error(`test merchant ${spec.merchantId}: ${merchant.error.message}`);
  const experiments = spec.experiments.map((e) => {
    const experiment = Experiment.of({
      experimentId: asExperimentId(e.experimentId),
      merchantId: merchant.value.merchantId,
      treatmentShare: e.treatmentPercent / PERCENT,
      seed: e.seed,
      status: e.status,
      startedAt: new Date(e.startedAt),
    });
    if (!experiment.ok) throw new Error(`test experiment ${e.experimentId}: ${experiment.error.message}`);
    return experiment.value;
  });
  const config: MerchantConfig = { merchant: merchant.value, experiments };
  if (spec.decisionPolicy !== undefined) {
    config.decisionPolicy = parseDecisionPolicy(spec.decisionPolicy, "merchants[0].decisionPolicy");
  }
  if (spec.commercialPolicy !== undefined) {
    config.commercialPolicy = parseCommercialPolicy(spec.commercialPolicy, "merchants[0].commercialPolicy");
  }
  if (spec.evidenceProfile !== undefined) {
    config.evidenceProfile = parseEvidenceProfile(spec.evidenceProfile, "merchants[0].evidenceProfile");
  }
  return config;
}

const merchantA: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1", "key-a-2"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  // A declares what it can sustain, so the quality gate lets the reassurance and the size recommendation through.
  evidenceProfile: { returnsPolicy: true, fitData: true },
  // Everyone in TREATMENT: the decision reasons of feature 004 stay observable through A.
  experiments: [
    {
      experimentId: "exp_a_000001",
      treatmentPercent: 100,
      seed: "seed-a",
      status: "active",
      startedAt: "2026-09-17T00:00:00Z",
    },
  ],
};
export const merchantB: MerchantSpec = {
  merchantId: "m_b",
  ingestKeys: ["key-b-1"],
  platformKeys: ["platform-b-1"],
  origins: ["https://b.example", "https://shop.b.example:8443"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  experiments: [],
};
const testMerchants: MerchantSpec[] = [merchantA, merchantB];

/** What a test may override of the configuration; merchants as specs, not entities. */
export interface TestConfig extends Omit<Partial<AppConfig>, "merchants"> {
  merchants?: MerchantSpec[];
}

const testConfig = ({ merchants, ...over }: TestConfig = {}): AppConfig => ({
  port: 0,
  host: "127.0.0.1",
  contractPath: path.resolve("contracts/dist/openapi.yaml"),
  merchants: (merchants ?? testMerchants).map(configured),
  ...over,
});

export function fixedClock(at: string | Date): Clock {
  const date = typeof at === "string" ? new Date(at) : at;
  return { now: () => date };
}

/** Starts the whole app; silent logger unless `ports.logger` says otherwise. */
export async function startTestApp(
  overrides: BootstrapOverrides = {},
  config: TestConfig = {},
): Promise<App> {
  return bootstrap(testConfig(config), {
    ...overrides,
    ports: { logger: silentLogger(), ...overrides.ports },
  });
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
  /** The server-to-server credential of the platform (ADR-025). */
  platformKey?: string;
  origin?: string;
  remoteAddress?: string;
  method?: "POST" | "PUT";
}

function post(
  app: FastifyInstance,
  url: string,
  payload: unknown,
  o: PostOptions,
): Promise<LightMyRequestResponse> {
  const method = o.method ?? "POST";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.key !== undefined) headers["x-ope-ingest-key"] = o.key;
  if (o.platformKey !== undefined) headers["x-ope-platform-key"] = o.platformKey;
  if (o.origin !== undefined) headers["origin"] = o.origin;
  const options: InjectOptions = { method, url, headers };
  if (payload !== undefined) options.payload = payload as Exclude<InjectOptions["payload"], undefined>;
  if (o.remoteAddress !== undefined) options.remoteAddress = o.remoteAddress;
  return app.inject(options);
}

export const postEvents = (app: FastifyInstance, batch: unknown, o: PostOptions = {}) =>
  post(app, "/v1/events", batch, o);

export const postExposure = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/exposures", body, o);

export const putCatalog = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/catalog", body, { ...o, method: "PUT" });

/** A catalogue product DTO with `variants` variants (M, L, …), unique ids from the product id. */
export function catalogProductOf(
  id: string,
  variants = 1,
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  const sizes = ["M", "L", "S", "XL"];
  return {
    productId: id,
    title: `Product ${id}`,
    attributes: [{ key: "fit", value: "regular" }],
    variants: Array.from({ length: variants }, (_, i) => ({
      variantId: `${id}-${sizes[i % sizes.length] ?? "M"}${i >= sizes.length ? String(i) : ""}`,
      size: sizes[i % sizes.length] ?? "M",
      color: "black",
      available: true,
      price: { amount: "19990.00", currency: "ARS" },
    })),
    ...over,
  };
}

/** A snapshot DTO of `n` products with one variant each, captured at `capturedAt`. */
export function catalogOf(
  n: number,
  capturedAt: string,
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    capturedAt,
    products: Array.from({ length: n }, (_, i) => catalogProductOf(`P${i + 1}`)),
    ...over,
  };
}
