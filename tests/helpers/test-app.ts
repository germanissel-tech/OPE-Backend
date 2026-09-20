// Test application: the whole graph through the composition root with the local profile, two
// fixed merchants and targeted replacements (clock, ports, handlers). `startTestApp` builds a
// whole app; `sharedTestApp` builds the server once per file and rebuilds only the in-memory
// ports before each test (015 F-055): the contract is parsed and the routes compiled once.
import path from "node:path";
import { bootstrap, type App, type BootstrapOverrides } from "../../src/composition/bootstrap.js";
import {
  parseCommercialPolicy,
  parseEvidenceProfile,
} from "../../src/composition/commercial-policy-config.js";
import { parseDecisionPolicy } from "../../src/composition/decision-policy-config.js";
import { localProfile } from "../../src/composition/profiles/local.js";
import { Experiment, Experiments } from "../../src/domain/experiment/index.js";
import { Merchant } from "../../src/domain/merchant/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { silentLogger } from "../../src/infrastructure/logging/pino-logger.js";
import type { Clock } from "../../src/application/shared-kernel/index.js";
import type { AppConfig, MerchantConfig } from "../../src/composition/config.js";
import type { Ports } from "../../src/composition/ports.js";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";

/** A merchant as a test writes it: the shape of OPE_MERCHANTS, built into entities by `configured`. */
export interface MerchantSpec {
  merchantId: string;
  ingestKeys: string[];
  platformKeys?: string[];
  /** Signing secrets (ADR-029): with any, every platform request of the merchant must be signed. */
  platformSecrets?: string[];
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
    platformSecrets: spec.platformSecrets ?? [],
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
  const set = Experiments.of(experiments);
  if (!set.ok) throw new Error(`test experiments of ${spec.merchantId}: ${set.error.message}`);
  const config: MerchantConfig = { merchant: merchant.value, experiments: set.value };
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

/** The instant the fixed clock and the event helpers agree on unless a test says otherwise (015 F-056). */
export const NOW = "2026-09-18T12:00:00.000Z";

export function fixedClock(at: string | Date = NOW): Clock {
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

/** What a test may replace for the next test of a shared app: ports, the merchant configuration. */
export interface PortsReset {
  ports?: Partial<Ports>;
  config?: TestConfig;
}

export interface SharedApp {
  app: FastifyInstance;
  /** The ports of the current test; they delegate to the ones the last reset built. */
  ports: Ports;
  /** Fresh in-memory ports for the next test — with other overrides or merchants when given — while the server stays. */
  resetPorts(over?: PortsReset): void;
  close(): Promise<void>;
}

/** An object whose members are read from `current()` on every access: the ports a reset replaces. */
function delegating<T extends object>(current: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = current();
      const value: unknown = Reflect.get(target, property);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * The server built once for a file; `resetPorts()` before each test rebuilds the in-memory ports
 * (ledgers, dedup, session and visitor state, the merchant and policy directories) behind the
 * same use cases. The clock is fixed at `NOW` and the logger silent unless `overrides.ports`
 * says otherwise; the logger is the one thing a reset keeps, because Fastify's request log is
 * bound to it when the server is built (a test that captures logs starts its own app).
 */
export async function sharedTestApp(
  overrides: BootstrapOverrides = {},
  config: TestConfig = {},
): Promise<SharedApp> {
  const profile = overrides.profile ?? localProfile;
  const logger = overrides.ports?.logger ?? silentLogger();
  const build = (over: PortsReset = {}): Ports =>
    profile(testConfig(over.config ?? config), {
      clock: fixedClock(),
      ...overrides.ports,
      ...over.ports,
      logger,
    }).ports;
  let current = build();
  const entries = (Object.keys(current) as (keyof Ports)[]).map((key) => [
    key,
    key === "logger" ? logger : delegating(() => current[key]),
  ]);
  const ports = Object.fromEntries(entries) as unknown as Ports;
  const app = await bootstrap(testConfig(config), { ...overrides, ports });
  return {
    app: app.app,
    ports,
    resetPorts: (over) => {
      current = build(over);
    },
    close: app.close,
  };
}

/** A valid event with unique ids; `over` overrides any field (even with garbage, on purpose). */
export function eventOf(n: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "product_viewed",
    eventId: `evt_${String(n).padStart(8, "0")}`,
    sessionId: "ses_00000001",
    visitorId: "vis_00000001",
    occurredAt: NOW,
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
  /** Extra headers, lowercase (the platform signature, for instance). */
  headers?: Record<string, string>;
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
  Object.assign(headers, o.headers ?? {});
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

export const postOrder = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/orders", body, o);

export const postCorroboration = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/orders/corroborations", body, o);

export const postReturn = (app: FastifyInstance, body: unknown, o: PostOptions = {}) =>
  post(app, "/v1/returns", body, o);

/** An order DTO for merchant tests: one line, ARS, confirmed at `confirmedAt`. */
export function orderOf(orderId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId,
    total: { amount: "18990.50", currency: "ARS" },
    items: [{ sku: "SKU-1-M", quantity: 1 }],
    confirmedAt: "2026-09-18T12:00:00.000Z",
    ...over,
  };
}

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
