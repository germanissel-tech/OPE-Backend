// Application configuration: the only thing main.ts reads from the environment. It parses the
// shape of what it reads; the business rules belong to the domain (ADR-024): merchants and
// experiments are built by their factories and a rejected one stops the start naming the
// field. No built-in merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";
import { Experiment } from "../domain/experiment/index.js";
import { Merchant } from "../domain/merchant/index.js";
import { asExperimentId, asMerchantId, type DomainError } from "../domain/shared-kernel/index.js";

/** A merchant as configured: the entity and its experiments (at most one active, ADR-022). */
export interface MerchantConfig {
  merchant: Merchant;
  experiments: readonly Experiment[];
}

export interface AppConfig {
  port: number;
  host: string;
  contractPath: string;
  merchants: MerchantConfig[];
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** `PORT=0` asks the OS for a free port (tests); 65535 is the last TCP port. */
const MAX_PORT = 65535;
/** One active key, or two during a rotation (ADR-014). */
const MAX_INGEST_KEYS = 2;
const DEFAULT_TREATMENT_PERCENT = 50;
/** Percentages live only here, at the edge: the domain works with rates 0..1. */
const PERCENT = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ACTIVE = "active";
const EXPERIMENT_STATUSES = [ACTIVE, "closed"];
const NOT_AN_OBJECT = "is not an object";
const NON_EMPTY_STRING = "must be a non-empty string";

/** The environment variables the server reads; anything else in the environment is ignored. */
type Variable = "PORT" | "HOST" | "OPE_CONTRACT" | "OPE_MERCHANTS" | "OPE_MERCHANTS_FILE";

/** A configuration value that cannot start the server: named after the variable, never silently defaulted. */
export class ConfigError extends Error {
  constructor(variable: Variable | `merchants[${number}]${string}`, problem: string) {
    super(`${variable} ${problem}.`);
    this.name = "ConfigError";
  }
}

/** Builds the configuration from the environment, or throws a `ConfigError` naming what is wrong. */
export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  return {
    port: readPort(text(env, "PORT")),
    host: text(env, "HOST") ?? "127.0.0.1",
    contractPath: path.resolve(text(env, "OPE_CONTRACT") ?? "contracts/dist/openapi.yaml"),
    merchants: readMerchants(env, readFile),
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
 * domain's; the location is the configuration's.
 */
function rejected(at: `merchants[${number}]${string}`, error: DomainError): ConfigError {
  const position = error.details[INDEX_DETAIL];
  const index = typeof position === "number" ? `[${position}]` : "";
  return new ConfigError(`${at}${FIELD_BY_CODE[error.code] ?? ""}${index}`, `is invalid (${error.message})`);
}

/** The detail a domain error uses to name the offending element of a list. */
const INDEX_DETAIL = "index";

/** Which configured field each domain error points at (`[index]` is appended when the error names one). */
const FIELD_BY_CODE: Readonly<Record<string, string>> = {
  "invalid-treatment-share": ".treatmentPercent",
  "invalid-seed": ".seed",
  "invalid-origin": ".origins",
  "platform-key-collision": ".platformKeys",
};

/** Validates the minimal shape: an array of merchants with non-empty id, keys and origins. */
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
    if (!isStringArray(ingestKeys) || ingestKeys.length === 0 || ingestKeys.length > MAX_INGEST_KEYS) {
      throw new ConfigError(`merchants[${i}].ingestKeys`, "must have one or two keys");
    }
    if (!isStringArray(origins) || origins.length === 0) {
      throw new ConfigError(`merchants[${i}].origins`, "must have at least one origin");
    }
    const platformKeys = m["platformKeys"] ?? [];
    if (!isStringArray(platformKeys) || platformKeys.length > MAX_INGEST_KEYS) {
      throw new ConfigError(`merchants[${i}].platformKeys`, "must have at most two keys");
    }
    const merchant = Merchant.of({ merchantId: asMerchantId(merchantId), ingestKeys, origins, platformKeys });
    if (!merchant.ok) throw rejected(`merchants[${i}]`, merchant.error);
    return { merchant: merchant.value, experiments: parseExperiments(m["experiments"], i, merchant.value) };
  });
}

/** Experiments of a merchant: optional list; each one validated; at most one active (ADR-022). */
function parseExperiments(raw: unknown, merchantIndex: number, merchant: Merchant): Experiment[] {
  const at: `merchants[${number}]${string}` = `merchants[${merchantIndex}].experiments`;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new ConfigError(at, "must be an array of experiments");
  const experiments = raw.map((item: unknown, j) =>
    parseExperiment(item, `merchants[${merchantIndex}].experiments[${j}]`, merchant),
  );
  if (experiments.filter((e) => e.isActive()).length > 1) {
    throw new ConfigError(at, "must have at most one active experiment");
  }
  return experiments;
}

function parseExperiment(item: unknown, at: `merchants[${number}]${string}`, merchant: Merchant): Experiment {
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
    merchantId: merchant.merchantId,
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
