// Application configuration: the only thing main.ts reads from the environment. It parses the
// shape of what it reads; the business rules belong to the domain (ADR-024): merchants and
// experiments are judged by their factories and a rejected one stops the start naming the
// field. Since feature 017 (ADR-031) the merchants are a seed: what an empty store imports at
// start-up through the same use case as the API, with the credentials in the clear the seed
// brings, and what it declares of its configuration is its version 1. The two levels of the
// release (constitution XI) are read from their files and judged by their factories. No
// built-in merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";
import {
  DECLARED_CONFIGURATION_KEYS,
  readDeclaredConfiguration,
  readPlatformConfiguration,
  readTreatmentDefaults,
} from "../application/configuration/index.js";
import { Experiment, Experiments, type ExperimentStatus } from "../domain/experiment/index.js";
import { Merchant } from "../domain/merchant/index.js";
import {
  asExperimentId,
  asMerchantId,
  type DomainError,
  type MerchantId,
} from "../domain/shared-kernel/index.js";
import { ConfigError, type MerchantField, type Variable } from "./config-error.js";
import { readOperators } from "./operators-config.js";
import type { MerchantSeed } from "../application/merchant/index.js";
import type {
  DeclaredConfiguration,
  InvalidConfigurationValue,
  PlatformConfiguration,
  TreatmentDefaults,
} from "../domain/configuration/index.js";
import type { Operator } from "../domain/operator/index.js";

/** A merchant as configured: its seed (judged by the entity, imported at start-up) and its experiments (the set judged by its owner, ADR-022). */
export interface MerchantConfig {
  merchantId: MerchantId;
  seed: MerchantSeed;
  experiments: Experiments;
  /** What the seed declares of the configuration (ADR-031): the version 1 of the merchant; empty when nothing. */
  declared: DeclaredConfiguration;
}

/** The two levels of the release (constitution XI), judged by their factories. */
export interface ReleaseLevels {
  platform: PlatformConfiguration;
  defaults: TreatmentDefaults;
}

export interface AppConfig {
  port: number;
  host: string;
  contractPath: string;
  merchants: MerchantConfig[];
  /** The operators of OPE (ADR-031); none configured means nobody administers. */
  operators: Operator[];
  levels: ReleaseLevels;
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** `PORT=0` asks the OS for a free port (tests); 65535 is the last TCP port. */
const MAX_PORT = 65535;
/** Percentages live only here, at the edge: the domain works with rates 0..1. */
const PERCENT = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = ["calibrating", "active", "closed"];
const isExperimentStatus = (value: unknown): value is ExperimentStatus =>
  typeof value === "string" && (EXPERIMENT_STATUSES as readonly string[]).includes(value);
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
    levels: readLevels(env, readFile),
  };
}

/** The files of the release that hold the platform configuration and the treatment defaults. */
const PLATFORM_FILE = "config/platform.json";
const TREATMENT_DEFAULTS_FILE = "config/treatment-defaults.json";

/** `OPE_PLATFORM_CONFIG` and `OPE_TREATMENT_DEFAULTS` name the files; the ones of the repository otherwise. */
function readLevels(env: NodeJS.ProcessEnv, readFile: (file: string) => string): ReleaseLevels {
  const platform = readPlatformConfiguration(
    parseJson(
      "OPE_PLATFORM_CONFIG",
      readFile(path.resolve(text(env, "OPE_PLATFORM_CONFIG") ?? PLATFORM_FILE)),
    ),
  );
  if (!platform.ok) throw levelError("platform", platform.error);
  const defaults = readTreatmentDefaults(
    parseJson(
      "OPE_TREATMENT_DEFAULTS",
      readFile(path.resolve(text(env, "OPE_TREATMENT_DEFAULTS") ?? TREATMENT_DEFAULTS_FILE)),
    ),
  );
  if (!defaults.ok) throw levelError("treatmentDefaults", defaults.error);
  return { platform: platform.value, defaults: defaults.value };
}

/** A value of a level the domain refuses: the field, prefixed by the level, and the rule. */
function levelError(level: "platform" | "treatmentDefaults", error: InvalidConfigurationValue): ConfigError {
  const { pointer, problem } = error.details;
  return new ConfigError(`${level}.${String(pointer)}`, `is invalid (${String(problem)})`);
}

function parseJson(variable: Variable, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      variable,
      `is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
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
  | ".experiments"
  | ".targetSample"
  | ".cuts";

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
  "experiment-already-open": ".experiments",
  "duplicate-experiment-id": ".experiments",
  "invalid-target-sample": ".targetSample",
  "invalid-experiment-cuts": ".cuts",
};

/** Parses the shape (an array of merchants with an id and lists of strings); the rules are the Merchant's. */
function parseMerchants(raw: string): MerchantConfig[] {
  const parsed = parseJson("OPE_MERCHANTS", raw);
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
    return { merchantId: asMerchantId(merchantId), seed, experiments, declared: declaredOf(m, i) };
  });
}

/** What the seed declares of the configuration, read by the same reader as the API (the shape); its values are judged at the import. */
function declaredOf(m: Record<string, unknown>, i: number): DeclaredConfiguration {
  const raw = Object.fromEntries(
    DECLARED_CONFIGURATION_KEYS.filter((key) => m[key] !== undefined).map((key) => [key, m[key]]),
  );
  const declared = readDeclaredConfiguration(raw, `merchants[${i}]`);
  if (!declared.ok) {
    const { pointer, problem } = declared.error.details;
    throw new ConfigError(String(pointer) as MerchantField, `is invalid (${String(problem)})`);
  }
  return declared.value;
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

/**
 * An experiment of the seed: opened at `openedAt` with its split, seed, target sample and cuts,
 * then moved to the declared status at that same instant (active: the window starts there;
 * closed: closed there). The seed is the origin: the holdout does not judge it.
 */
function parseExperiment(item: unknown, at: MerchantField, merchantId: MerchantId): Experiment {
  if (typeof item !== "object" || item === null) throw new ConfigError(at, NOT_AN_OBJECT);
  const e = item as Record<string, unknown>;
  const experimentId = e["experimentId"];
  const seed = e["seed"];
  const status = e["status"];
  const openedAt = e["openedAt"];
  const treatmentPercent = e["treatmentPercent"];
  const targetSample = e["targetSample"];
  const cuts = e["cuts"] ?? [];
  if (typeof experimentId !== "string" || !ID_PATTERN.test(experimentId)) {
    throw new ConfigError(`${at}.experimentId`, "must match ^[A-Za-z0-9_-]{8,64}$");
  }
  // Shape: an integer percentage. Its range is the domain's rule (Experiment.of, as a rate 0..1).
  if (!Number.isInteger(treatmentPercent)) {
    throw new ConfigError(`${at}.treatmentPercent`, "must be an integer percentage");
  }
  if (typeof seed !== "string") throw new ConfigError(`${at}.seed`, NON_EMPTY_STRING);
  if (typeof targetSample !== "number") throw new ConfigError(`${at}.targetSample`, "must be a number");
  if (!isNumberArray(cuts)) throw new ConfigError(`${at}.cuts`, "must be an array of numbers");
  if (!isExperimentStatus(status)) {
    throw new ConfigError(`${at}.status`, `must be one of ${EXPERIMENT_STATUSES.join(", ")}`);
  }
  if (typeof openedAt !== "string" || Number.isNaN(Date.parse(openedAt))) {
    throw new ConfigError(`${at}.openedAt`, "must be an RFC 3339 date-time");
  }
  const opened = new Date(openedAt);
  const experiment = Experiment.of({
    experimentId: asExperimentId(experimentId),
    merchantId,
    treatmentShare: Number(treatmentPercent) / PERCENT,
    seed,
    targetSample,
    cuts,
    openedAt: opened,
  });
  if (!experiment.ok) throw rejected(at, experiment.error);
  return moved(experiment.value, status, opened);
}

/** The experiment in the status the seed declares, as of its opening. */
function moved(experiment: Experiment, status: ExperimentStatus, at: Date): Experiment {
  if (status === "closed") return experiment.closed(at);
  if (status === "calibrating") return experiment;
  const activated = experiment.activated(at);
  // A calibrating experiment always activates: the entity was just built.
  if (!activated.ok) throw new Error("A calibrating experiment could not be activated.");
  return activated.value;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === "number");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
