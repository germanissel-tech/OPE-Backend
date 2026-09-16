// Application configuration: the only thing main.ts reads from the environment. No business logic.
import path from "node:path";
import type { ServerMode } from "../infrastructure/http/build-server.js";

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
  mode: ServerMode;
  contractPath: string;
  merchants: MerchantConfig[];
  /** Tests only: alternative module exporting `handlers`. */
  handlersModule: string | undefined;
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** One active key, or two during a rotation (ADR-014). */
const MAX_INGEST_KEYS = 2;

/** Test merchant for `OPE_MOCK=1` and local development without configuration. */
const MOCK_MERCHANT: MerchantConfig = {
  merchantId: "mock-merchant",
  ingestKeys: ["ope_mock_ingest_key"],
  origins: ["http://localhost:3000", "http://127.0.0.1:3000"],
};

export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  const mode: ServerMode = env["OPE_MOCK"] === "1" ? "mock" : "real";
  return {
    port: Number(env["PORT"] ?? DEFAULT_PORT),
    host: env["HOST"] ?? "127.0.0.1",
    mode,
    contractPath: path.resolve(env["OPE_CONTRACT"] ?? "contracts/dist/openapi.yaml"),
    merchants: readMerchants(env, readFile, mode),
    handlersModule: env["OPE_HANDLERS_MODULE"],
  };
}

function readMerchants(
  env: NodeJS.ProcessEnv,
  readFile: (file: string) => string,
  mode: ServerMode,
): MerchantConfig[] {
  const inline = env["OPE_MERCHANTS"];
  const file = env["OPE_MERCHANTS_FILE"];
  const raw = inline ?? (file !== undefined ? readFile(path.resolve(file)) : undefined);
  if (raw === undefined) return mode === "mock" ? [MOCK_MERCHANT] : [];
  return parseMerchants(raw);
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
