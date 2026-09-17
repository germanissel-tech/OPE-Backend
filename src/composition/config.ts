// Application configuration: the only thing main.ts reads from the environment. No business
// logic and no built-in merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";

/** An experiment as configuration describes it (ADR-022): at most one active per merchant. */
export interface ExperimentConfig {
  experimentId: string;
  /** Share of visitors assigned to TREATMENT, integer 0..100; 50 when absent. */
  treatmentPercent: number;
  /** Part of the assignment key; immutable (changing it is a new experiment). */
  seed: string;
  status: "active" | "closed";
  /** RFC 3339. */
  startedAt: string;
}

/** A merchant as configuration describes it (local profile; 008 brings the store). */
export interface MerchantConfig {
  merchantId: string;
  /** Active ingest keys (one, or two during a rotation). */
  ingestKeys: string[];
  /** Registered origins of the store (`scheme://host[:port]`). */
  origins: string[];
  /** Experiments of the merchant; none means nothing is assigned (`no-active-experiment`). */
  experiments: ExperimentConfig[];
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
const MAX_PERCENT = 100;
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
    return { merchantId, ingestKeys, origins, experiments: parseExperiments(m["experiments"], i) };
  });
}

/** Experiments of a merchant: optional list; each one validated; at most one active (ADR-022). */
function parseExperiments(raw: unknown, merchantIndex: number): ExperimentConfig[] {
  const at: `merchants[${number}]${string}` = `merchants[${merchantIndex}].experiments`;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new ConfigError(at, "must be an array of experiments");
  const experiments = raw.map((item: unknown, j) =>
    parseExperiment(item, `merchants[${merchantIndex}].experiments[${j}]`),
  );
  if (experiments.filter((e) => e.status === ACTIVE).length > 1) {
    throw new ConfigError(at, "must have at most one active experiment");
  }
  return experiments;
}

function parseExperiment(item: unknown, at: `merchants[${number}]${string}`): ExperimentConfig {
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
  if (
    !Number.isInteger(treatmentPercent) ||
    Number(treatmentPercent) < 0 ||
    Number(treatmentPercent) > MAX_PERCENT
  ) {
    throw new ConfigError(`${at}.treatmentPercent`, `must be an integer between 0 and ${MAX_PERCENT}`);
  }
  if (typeof seed !== "string" || seed === "")
    throw new ConfigError(`${at}.seed`, "must be a non-empty string");
  if (typeof status !== "string" || !EXPERIMENT_STATUSES.includes(status)) {
    throw new ConfigError(`${at}.status`, `must be one of ${EXPERIMENT_STATUSES.join(", ")}`);
  }
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) {
    throw new ConfigError(`${at}.startedAt`, "must be an RFC 3339 date-time");
  }
  return {
    experimentId,
    treatmentPercent: Number(treatmentPercent),
    seed,
    status: status === ACTIVE ? "active" : "closed",
    startedAt,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
