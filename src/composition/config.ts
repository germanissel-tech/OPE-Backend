// Application configuration: the only thing main.ts reads from the environment. No business
// logic and no built-in merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";

/** A merchant as configuration describes it (in-memory profile; 006 brings the store). */
export interface MerchantConfig {
  merchantId: string;
  /** Active ingest keys (one, or two during a rotation). */
  ingestKeys: string[];
  /** Registered origins of the store (`scheme://host[:port]`). */
  origins: string[];
}

export interface AppConfig {
  port: number;
  host: string;
  contractPath: string;
  merchants: MerchantConfig[];
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** One active key, or two during a rotation (ADR-014). */
const MAX_INGEST_KEYS = 2;

export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  return {
    port: Number(env["PORT"] ?? DEFAULT_PORT),
    host: env["HOST"] ?? "127.0.0.1",
    contractPath: path.resolve(env["OPE_CONTRACT"] ?? "contracts/dist/openapi.yaml"),
    merchants: readMerchants(env, readFile),
  };
}

/** `OPE_MERCHANTS` (JSON) or `OPE_MERCHANTS_FILE`; none configured means none. */
function readMerchants(env: NodeJS.ProcessEnv, readFile: (file: string) => string): MerchantConfig[] {
  const inline = env["OPE_MERCHANTS"];
  const file = env["OPE_MERCHANTS_FILE"];
  const raw = inline ?? (file !== undefined ? readFile(path.resolve(file)) : undefined);
  return raw === undefined ? [] : parseMerchants(raw);
}

/** Validates the minimal shape: an array of merchants with non-empty id, keys and origins. */
function parseMerchants(raw: string): MerchantConfig[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("OPE_MERCHANTS must be a JSON array of merchants.");
  return parsed.map((item: unknown, i) => {
    if (typeof item !== "object" || item === null) throw new Error(`merchants[${i}] is not an object.`);
    const m = item as Record<string, unknown>;
    const merchantId = m["merchantId"];
    const ingestKeys = m["ingestKeys"];
    const origins = m["origins"];
    if (typeof merchantId !== "string" || merchantId === "") {
      throw new Error(`merchants[${i}].merchantId must be a non-empty string.`);
    }
    if (!isStringArray(ingestKeys) || ingestKeys.length === 0 || ingestKeys.length > MAX_INGEST_KEYS) {
      throw new Error(`merchants[${i}].ingestKeys must have one or two keys.`);
    }
    if (!isStringArray(origins) || origins.length === 0) {
      throw new Error(`merchants[${i}].origins must have at least one origin.`);
    }
    return { merchantId, ingestKeys, origins };
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
