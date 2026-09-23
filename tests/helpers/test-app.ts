// Test application: the whole graph through the composition root with the local profile, two
// fixed merchants and targeted replacements (clock, ports, handlers). `startTestApp` builds a
// whole app; `sharedTestApp` builds the server once per file and rebuilds only the in-memory
// ports before each test (015 F-055): the contract is parsed and the routes compiled once.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  readDeclaredConfiguration,
  readPlatformConfiguration,
  readTreatmentDefaults,
} from "../../src/application/configuration/index.js";
import { bootstrap, importSeed, type App, type BootstrapOverrides } from "../../src/composition/bootstrap.js";
import { localDeployment } from "../../src/composition/deployments/local.js";
import { withoutSchemaReference } from "../../src/composition/env.js";
import { instantiate, replace, type AnyPort, type Override } from "../../src/composition/graph/index.js";
import { ClockPort, LoggerPort } from "../../src/composition/modules/shared-kernel.js";
import { releaseComponents } from "../../src/composition/release.js";
import { Experiment, Experiments, type ExperimentStatus } from "../../src/domain/experiment/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../src/domain/operator/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { silentLogger } from "../../src/infrastructure/logging/pino-logger.js";
import { TEST_TARGET_SAMPLE } from "./experiments.js";
import type { MerchantSeed } from "../../src/application/merchant/index.js";
import type { Clock } from "../../src/application/shared-kernel/index.js";
import type { AppConfig, MerchantConfig, ReleaseLevels } from "../../src/composition/config.js";
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
    status: ExperimentStatus;
    openedAt: string;
    targetSample?: number;
    cuts?: number[];
  }[];
  /** The raw shape of OPE_MERCHANTS[i].decisionPolicy; read like config.ts does. */
  decisionPolicy?: Record<string, unknown>;
  /** The raw shape of OPE_MERCHANTS[i].commercialPolicy; read like config.ts does. */
  commercialPolicy?: Record<string, unknown>;
  /** The raw shape of OPE_MERCHANTS[i].evidenceProfile; read like config.ts does. */
  evidenceProfile?: Record<string, unknown>;
  /** Any other value the merchant declares of its configuration (feature 017), in the raw shape. */
  declared?: Record<string, unknown>;
}

const PERCENT = 100;

/** Builds the entities of a spec the way config.ts does; a spec that breaks a rule is a test bug. */
function configured(spec: MerchantSpec): MerchantConfig {
  const merchantId = asMerchantId(spec.merchantId);
  const seed: MerchantSeed = {
    merchantId: spec.merchantId,
    ingestKeys: spec.ingestKeys,
    origins: spec.origins,
    platformKeys: spec.platformKeys ?? [],
    platformSecrets: spec.platformSecrets ?? [],
  };
  const experiments = spec.experiments.map((e) => {
    const openedAt = new Date(e.openedAt);
    const experiment = Experiment.of({
      experimentId: asExperimentId(e.experimentId),
      merchantId,
      treatmentShare: e.treatmentPercent / PERCENT,
      seed: e.seed,
      targetSample: e.targetSample ?? TEST_TARGET_SAMPLE,
      cuts: e.cuts ?? [],
      openedAt,
    });
    if (!experiment.ok) throw new Error(`test experiment ${e.experimentId}: ${experiment.error.message}`);
    // The seed's status as of its opening, the way config.ts moves it.
    if (e.status === "closed") return experiment.value.closed(openedAt);
    if (e.status === "calibrating") return experiment.value;
    const activated = experiment.value.activated(openedAt);
    if (!activated.ok) throw new Error(`test experiment ${e.experimentId}: ${activated.error.message}`);
    return activated.value;
  });
  const set = Experiments.of(experiments);
  if (!set.ok) throw new Error(`test experiments of ${spec.merchantId}: ${set.error.message}`);
  const raw: Record<string, unknown> = { ...spec.declared };
  if (spec.decisionPolicy !== undefined) raw["decisionPolicy"] = spec.decisionPolicy;
  if (spec.commercialPolicy !== undefined) raw["commercialPolicy"] = spec.commercialPolicy;
  if (spec.evidenceProfile !== undefined) raw["evidenceProfile"] = spec.evidenceProfile;
  const declared = readDeclaredConfiguration(raw, "merchants[0]");
  if (!declared.ok) throw new Error(`test merchant ${spec.merchantId}: ${declared.error.message}`);
  return { merchantId, seed, experiments: set.value, declared: declared.value };
}

/** The levels of the release as the repository declares them: the tests run under the real files. */
function releaseLevels(): ReleaseLevels {
  const read = (file: string): unknown =>
    withoutSchemaReference(JSON.parse(readFileSync(path.resolve(file), "utf8")));
  const platform = readPlatformConfiguration(read("config/platform.json"));
  const defaults = readTreatmentDefaults(read("config/treatment-defaults.json"));
  if (!platform.ok) throw new Error(`config/platform.json: ${platform.error.message}`);
  if (!defaults.ok) throw new Error(`config/treatment-defaults.json: ${defaults.error.message}`);
  return { platform: platform.value, defaults: defaults.value };
}

let levels: ReleaseLevels | undefined;

/**
 * Read once per process, on the first request and never at load: what a test file evaluates
 * while it loads counts as static for the mutation gate and runs against the whole suite.
 */
export const testLevels = (): ReleaseLevels => (levels ??= releaseLevels());

const merchantA: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1", "key-a-2"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  // A declares what it can sustain, so the quality gate lets the reassurance and the size recommendation through.
  evidenceProfile: { returnsPolicy: true, fitData: true },
  // The whole traffic goes to OPE: no holdout (feature 017).
  declared: { holdoutPercent: 0 },
  // Everyone in TREATMENT: the decision reasons of feature 004 stay observable through A.
  experiments: [
    {
      experimentId: "exp_a_000001",
      treatmentPercent: 100,
      seed: "seed-a",
      status: "active",
      openedAt: "2026-09-17T00:00:00Z",
    },
  ],
};
export const merchantB: MerchantSpec = {
  merchantId: "m_b",
  ingestKeys: ["key-b-1"],
  platformKeys: ["platform-b-1"],
  origins: ["https://b.example", "https://shop.b.example:8443"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutPercent: 0 },
  experiments: [],
};
const testMerchants: MerchantSpec[] = [merchantA, merchantB];

/** The operators of the test platform (feature 017): one over every merchant, one scoped to A. */
const TEST_OPERATOR_TOKENS = { "ops-all": "admin-token-all", "ops-a": "admin-token-a" } as const;
export type TestOperator = keyof typeof TEST_OPERATOR_TOKENS;

/** The raw bearer token of a test operator (the platform only stores its fingerprint). */
const adminToken = (name: TestOperator): string => TEST_OPERATOR_TOKENS[name];

const fingerprint = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

function operatorOf(name: TestOperator, scope: "*" | string[]): Operator {
  const built = Operator.of({
    operatorId: asOperatorId(name),
    tokenFingerprints: [fingerprint(TEST_OPERATOR_TOKENS[name])],
    scope: scope === EVERY_MERCHANT ? EVERY_MERCHANT : scope.map(asMerchantId),
  });
  if (!built.ok) throw new Error(`test operator ${name}: ${built.error.message}`);
  return built.value;
}

const testOperators: Operator[] = [operatorOf("ops-all", EVERY_MERCHANT), operatorOf("ops-a", ["m_a"])];

/** What a test may override of the configuration; merchants as specs, not entities. */
export interface TestConfig extends Omit<Partial<AppConfig>, "merchants"> {
  merchants?: MerchantSpec[];
}

export const testConfig = ({ merchants, ...over }: TestConfig = {}): AppConfig => ({
  port: 0,
  host: "127.0.0.1",
  contractPath: path.resolve("contracts/dist/openapi.yaml"),
  merchants: (merchants ?? testMerchants).map(configured),
  operators: testOperators,
  levels: testLevels(),
  ...over,
});

/** The instant the fixed clock and the event helpers agree on unless a test says otherwise (015 F-056). */
export const NOW = "2026-09-18T12:00:00.000Z";

export function fixedClock(at: string | Date = NOW): Clock {
  const date = typeof at === "string" ? new Date(at) : at;
  return { now: () => date };
}

/** Starts the whole app; silent logger unless a replacement says otherwise. */
export async function startTestApp(
  overrides: BootstrapOverrides = {},
  config: TestConfig = {},
): Promise<App> {
  return bootstrap(testConfig(config), {
    ...overrides,
    ports: [replace(LoggerPort, silentLogger()), ...(overrides.ports ?? [])],
  });
}

/** What a test may replace for the next test of a shared app: components, the merchant configuration. */
export interface PortsReset {
  ports?: readonly Override[];
  config?: TestConfig;
}

export interface SharedApp {
  app: FastifyInstance;
  /** The component of the current test: it delegates to the graph the last reset built. */
  resolve: App["resolve"];
  /** A fresh graph for the next test — with other replacements or merchants — while the server stays. */
  resetPorts(over?: PortsReset): Promise<void>;
  close(): Promise<void>;
}

/** An object whose members are read from `current()` on every access: what a reset replaces. */
function delegating<T extends object>(current: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = current();
      const value: unknown = Reflect.get(target, property);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/** What comes from the release is not rebuilt between tests, and is read as it is. */
const fromTheRelease = (config: TestConfig): ReadonlySet<AnyPort> =>
  new Set(releaseComponents(testConfig(config)).provided);

/**
 * The server built once for a file; `resetPorts()` before each test rebuilds the in-memory
 * components (ledgers, dedup, session and visitor state, the merchant and policy directories)
 * behind the same use cases. The clock is fixed at `NOW` and the logger silent unless a
 * replacement says otherwise; the logger is the one thing a reset keeps, because Fastify's request
 * log is bound to it when the server is built (a test that captures logs starts its own app).
 */
export async function sharedTestApp(
  overrides: BootstrapOverrides = {},
  config: TestConfig = {},
): Promise<SharedApp> {
  const logger = silentLogger();
  const build = (over: PortsReset = {}): ReturnType<typeof instantiate> => {
    const graph = instantiate(localDeployment(testConfig(over.config ?? config)), [
      replace(ClockPort, fixedClock()),
      ...(overrides.ports ?? []),
      ...(over.ports ?? []),
      replace(LoggerPort, logger),
    ]);
    graph.resolveAll();
    return graph;
  };
  let current = build();
  // Only what a technology serves is replaced: what a module composes out of it (a service, the
  // decorators) the server builds for itself, over these, so a reset reaches it too.
  const release = fromTheRelease(config);
  const shared = localDeployment(testConfig(config))
    .providedPorts.filter((port) => !release.has(port))
    .map((port) =>
      replace(
        port,
        delegating(() => current.resolve(port) as object),
      ),
    );
  const app = await bootstrap(testConfig(config), { ...overrides, ports: shared });
  return {
    app: app.app,
    resolve: app.resolve,
    resetPorts: async (over) => {
      current = build(over);
      await importSeed(testConfig(over?.config ?? config), current);
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

/** An administration request (feature 017): bearer token of a test operator, JSON body when given. */
export function admin(
  app: FastifyInstance,
  method: "GET" | "POST" | "PUT",
  url: string,
  o: { as?: TestOperator | null; token?: string; body?: unknown } = {},
): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = {};
  const token = o.token ?? (o.as === null ? undefined : adminToken(o.as ?? "ops-all"));
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const options: InjectOptions = { method, url, headers };
  if (o.body !== undefined) options.payload = o.body as Exclude<InjectOptions["payload"], undefined>;
  return app.inject(options);
}
