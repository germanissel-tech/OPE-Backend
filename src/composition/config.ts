// Application configuration: the only thing main.ts reads from the environment. It parses the
// shape of what it reads; the business rules belong to the domain (ADR-024): merchants and
// experiments are judged by their factories and a rejected one stops the start naming the
// field. Since feature 017 (ADR-031) the merchants are a seed: what an empty store imports at
// start-up through the same use case as the API, with the credentials in the clear the seed
// brings. No built-in merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";
import { Experiment, Experiments } from "../domain/experiment/index.js";
import { Merchant } from "../domain/merchant/index.js";
import {
  asExperimentId,
  asMerchantId,
  type DomainError,
  type MerchantId,
} from "../domain/shared-kernel/index.js";
import { parseCommercialPolicy, parseEvidenceProfile } from "./commercial-policy-config.js";
import { ConfigError, type MerchantField, type Variable } from "./config-error.js";
import { parseDecisionPolicy } from "./decision-policy-config.js";
import { readOperators } from "./operators-config.js";
import type { MerchantSeed } from "../application/merchant/index.js";
import type { CommercialPolicy } from "../domain/commercial/index.js";
import type { DecisionPolicy } from "../domain/decision/index.js";
import type { Operator } from "../domain/operator/index.js";
import type { MerchantProfile } from "../domain/selection/index.js";

/** A merchant as configured: its seed (judged by the entity, imported at start-up) and its experiments (the set judged by its owner, ADR-022). */
export interface MerchantConfig {
  merchantId: MerchantId;
  seed: MerchantSeed;
  experiments: Experiments;
  /** The merchant's decision policy (ADR-026); absent means the default one. */
  decisionPolicy?: DecisionPolicy;
  /** The merchant's commercial policy (ADR-027); absent means the default one. */
  commercialPolicy?: CommercialPolicy;
  /** What the merchant declares it can sustain (ADR-027); absent means nothing. */
  evidenceProfile?: MerchantProfile;
}

export interface AppConfig {
  port: number;
  host: string;
  contractPath: string;
  merchants: MerchantConfig[];
  /** The operators of OPE (ADR-031); none configured means nobody administers. */
  operators: Operator[];
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** `PORT=0` asks the OS for a free port (tests); 65535 is the last TCP port. */
const MAX_PORT = 65535;
/** One active key, or two during a rotation (ADR-014). */
const DEFAULT_TREATMENT_PERCENT = 50;
/** Percentages live only here, at the edge: the domain works with rates 0..1. */
const PERCENT = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ACTIVE = "active";
const EXPERIMENT_STATUSES = [ACTIVE, "closed"];
const NOT_AN_OBJECT = "is not an object";
const NON_EMPTY_STRING = "must be a non-empty string";
const STRING_ARRAY = "must be an array of strings";

export { ConfigError } from "./config-error.js";

/** Builds the configuration from the environment, or throws a `ConfigError` naming what is wrong. */
export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  return {
    port: readPort(text(env, "PORT")),
    host: text(env, "HOST") ?? "127.0.0.1",
    contractPath: path.resolve(text(env, "OPE_CONTRACT") ?? "contracts/dist/openapi.yaml"),
    merchants: readMerchants(env, readFile),
    operators: readOperators(env, readFile),
  };
}

/** A variable set to blank counts as unset: nothing here means "empty string". */
function text(env: NodeJS.ProcessEnv, name: Variable): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

/** Decimal digits only: `Number()` would also accept hex, exponents and blanks. */
const DECIMAL = /^\d+$/;

function readPort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = DECIMAL.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port > MAX_PORT) {
    throw new ConfigError("PORT", `must be an integer between 0 and ${MAX_PORT}, got "${raw}"`);
  }
  return port;
}

/** `OPE_MERCHANTS` (JSON) or `OPE_MERCHANTS_FILE`; none configured means none. */
function readMerchants(env: NodeJS.ProcessEnv, readFile: (file: string) => string): MerchantConfig[] {
  const inline = text(env, "OPE_MERCHANTS");
  const file = text(env, "OPE_MERCHANTS_FILE");
  const raw = inline ?? (file !== undefined ? readFile(path.resolve(file)) : undefined);
  return raw === undefined ? [] : parseMerchants(raw);
}

/**
 * A domain error of a factory becomes a configuration error naming the field: the rule is the
 * domain's; the location is the configuration's. The entity judges the credentials as one
 * list (ingest, then platform, then signing): the index is translated back to the seed's field.
 */
function rejected(at: MerchantField, error: DomainError, seed?: MerchantSeed): ConfigError {
  const field = FIELD_BY_CODE[error.code] ?? "";
  const position = error.details[INDEX_DETAIL];
  const offset = seed === undefined ? 0 : credentialOffset(field, seed);
  const index = typeof position === "number" ? `[${position - offset}]` : "";
  return new ConfigError(`${at}${field}${index}`, `is invalid (${error.message})`);
}

/** Where each credential field starts in the list the entity judges. */
function credentialOffset(field: ConfiguredField | "", seed: MerchantSeed): number {
  if (field === ".platformKeys") return seed.ingestKeys.length;
  if (field === ".platformSecrets") return seed.ingestKeys.length + seed.platformKeys.length;
  return 0;
}

/**
 * The rules of the merchant, applied to the seed at start-up so a bad one stops the start
 * naming the field; the raw keys stand in for fingerprints (the import fingerprints them).
 */
function judgeSeed(seed: MerchantSeed): DomainError | undefined {
  const at = new Date(0);
  const judged = Merchant.of({
    merchantId: asMerchantId(seed.merchantId),
    origins: seed.origins,
    credentials: [
      ...seed.ingestKeys.map((k) => Merchant.credential("ingest", k, at)),
      ...seed.platformKeys.map((k) => Merchant.credential("platform", k, at)),
      ...seed.platformSecrets.map((s) => Merchant.credential("signing", s, at, s)),
    ],
    createdAt: at,
  });
  return judged.ok ? undefined : judged.error;
}

/** The detail a domain error uses to name the offending element of a list. */
const INDEX_DETAIL = "index";

/** The configured fields a domain error of a merchant or an experiment can point at. */
type ConfiguredField =
  | ".treatmentPercent"
  | ".seed"
  | ".ingestKeys"
  | ".origins"
  | ".platformKeys"
  | ".platformSecrets"
  | ".experiments";

/** Which configured field each domain error points at (`[index]` is appended when the error names one). */
const FIELD_BY_CODE: Readonly<Record<string, ConfiguredField>> = {
  "invalid-treatment-share": ".treatmentPercent",
  "invalid-seed": ".seed",
  "invalid-ingest-keys": ".ingestKeys",
  "invalid-origins": ".origins",
  "invalid-origin": ".origins",
  "invalid-platform-keys": ".platformKeys",
  "platform-key-collision": ".platformKeys",
  "invalid-platform-secrets": ".platformSecrets",
  "invalid-platform-secret": ".platformSecrets",
  "multiple-active-experiments": ".experiments",
  "duplicate-experiment-id": ".experiments",
};

/** Parses the shape (an array of merchants with an id and lists of strings); the rules are the Merchant's. */
function parseMerchants(raw: string): MerchantConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      "OPE_MERCHANTS",
      `is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!Array.isArray(parsed)) throw new ConfigError("OPE_MERCHANTS", "must be a JSON array of merchants");
  return parsed.map((item: unknown, i) => {
    if (typeof item !== "object" || item === null) throw new ConfigError(`merchants[${i}]`, NOT_AN_OBJECT);
    const m = item as Record<string, unknown>;
    const merchantId = m["merchantId"];
    const ingestKeys = m["ingestKeys"];
    const origins = m["origins"];
    if (typeof merchantId !== "string" || merchantId === "") {
      throw new ConfigError(`merchants[${i}].merchantId`, NON_EMPTY_STRING);
    }
    if (!isStringArray(ingestKeys)) throw new ConfigError(`merchants[${i}].ingestKeys`, STRING_ARRAY);
    if (!isStringArray(origins)) throw new ConfigError(`merchants[${i}].origins`, STRING_ARRAY);
    const platformKeys = m["platformKeys"] ?? [];
    if (!isStringArray(platformKeys)) throw new ConfigError(`merchants[${i}].platformKeys`, STRING_ARRAY);
    const platformSecrets = m["platformSecrets"] ?? [];
    if (!isStringArray(platformSecrets)) {
      throw new ConfigError(`merchants[${i}].platformSecrets`, STRING_ARRAY);
    }
    const seed: MerchantSeed = { merchantId, ingestKeys, origins, platformKeys, platformSecrets };
    const judged = judgeSeed(seed);
    if (judged !== undefined) throw rejected(`merchants[${i}]`, judged, seed);
    const experiments = parseExperiments(m["experiments"], i, asMerchantId(merchantId));
    return { merchantId: asMerchantId(merchantId), seed, experiments, ...policiesOf(m, i) };
  });
}

/** The optional policies of a merchant, each parsed only when present (absent means its default). */
function policiesOf(m: Record<string, unknown>, i: number): Partial<MerchantConfig> {
  const policies: Partial<MerchantConfig> = {};
  const decision = m["decisionPolicy"];
  if (decision !== undefined)
    policies.decisionPolicy = parseDecisionPolicy(decision, `merchants[${i}].decisionPolicy`);
  const commercial = m["commercialPolicy"];
  if (commercial !== undefined) {
    policies.commercialPolicy = parseCommercialPolicy(commercial, `merchants[${i}].commercialPolicy`);
  }
  const profile = m["evidenceProfile"];
  if (profile !== undefined)
    policies.evidenceProfile = parseEvidenceProfile(profile, `merchants[${i}].evidenceProfile`);
  return policies;
}

/** Experiments of a merchant: optional list; each built by its factory, the set judged by its owner (ADR-022). */
function parseExperiments(raw: unknown, merchantIndex: number, merchantId: MerchantId): Experiments {
  const at: MerchantField = `merchants[${merchantIndex}].experiments`;
  if (raw === undefined) return Experiments.rehydrate([]);
  if (!Array.isArray(raw)) throw new ConfigError(at, "must be an array of experiments");
  const experiments = Experiments.of(
    raw.map((item: unknown, j) =>
      parseExperiment(item, `merchants[${merchantIndex}].experiments[${j}]`, merchantId),
    ),
  );
  if (!experiments.ok) throw rejected(`merchants[${merchantIndex}]`, experiments.error);
  return experiments.value;
}

function parseExperiment(item: unknown, at: MerchantField, merchantId: MerchantId): Experiment {
  if (typeof item !== "object" || item === null) throw new ConfigError(at, NOT_AN_OBJECT);
  const e = item as Record<string, unknown>;
  const experimentId = e["experimentId"];
  const seed = e["seed"];
  const status = e["status"];
  const startedAt = e["startedAt"];
  const treatmentPercent = e["treatmentPercent"] ?? DEFAULT_TREATMENT_PERCENT;
  if (typeof experimentId !== "string" || !ID_PATTERN.test(experimentId)) {
    throw new ConfigError(`${at}.experimentId`, "must match ^[A-Za-z0-9_-]{8,64}$");
  }
  // Shape: an integer percentage. Its range is the domain's rule (Experiment.of, as a rate 0..1).
  if (!Number.isInteger(treatmentPercent)) {
    throw new ConfigError(`${at}.treatmentPercent`, "must be an integer percentage");
  }
  if (typeof seed !== "string") throw new ConfigError(`${at}.seed`, NON_EMPTY_STRING);
  if (typeof status !== "string" || !EXPERIMENT_STATUSES.includes(status)) {
    throw new ConfigError(`${at}.status`, `must be one of ${EXPERIMENT_STATUSES.join(", ")}`);
  }
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) {
    throw new ConfigError(`${at}.startedAt`, "must be an RFC 3339 date-time");
  }
  const experiment = Experiment.of({
    experimentId: asExperimentId(experimentId),
    merchantId,
    treatmentShare: Number(treatmentPercent) / PERCENT,
    seed,
    status: status === ACTIVE ? "active" : "closed",
    startedAt: new Date(startedAt),
  });
  if (!experiment.ok) throw rejected(at, experiment.error);
  return experiment.value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
