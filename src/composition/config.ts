// Configuración de la aplicación: lo único que main.ts lee del entorno. Sin lógica de negocio.
import path from "node:path";
import type { ServerMode } from "../infrastructure/http/build-server.js";

/** Un merchant tal como lo describe la configuración (perfil en memoria; la 006 trae el almacén). */
export interface MerchantConfig {
  merchantId: string;
  /** Claves de ingesta activas (una o dos durante una rotación). */
  ingestKeys: string[];
  /** Orígenes registrados de la tienda (`scheme://host[:port]`). */
  origins: string[];
}

export interface AppConfig {
  port: number;
  host: string;
  mode: ServerMode;
  contractPath: string;
  merchants: MerchantConfig[];
  /** Sólo para pruebas: módulo alternativo que exporta `handlers`. */
  handlersModule: string | undefined;
}

/** Merchant de prueba para `OPE_MOCK=1` y desarrollo local sin configuración. */
export const MOCK_MERCHANT: MerchantConfig = {
  merchantId: "mock-merchant",
  ingestKeys: ["ope_mock_ingest_key"],
  origins: ["http://localhost:3000", "http://127.0.0.1:3000"],
};

export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  const mode: ServerMode = env["OPE_MOCK"] === "1" ? "mock" : "real";
  return {
    port: Number(env["PORT"] ?? 3000),
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

/** Valida la forma mínima: un arreglo de merchants con id, claves y orígenes no vacíos. */
export function parseMerchants(raw: string): MerchantConfig[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("OPE_MERCHANTS debe ser un arreglo JSON de merchants.");
  return parsed.map((item: unknown, i) => {
    if (typeof item !== "object" || item === null) throw new Error(`merchants[${i}] no es un objeto.`);
    const m = item as Record<string, unknown>;
    const merchantId = m["merchantId"];
    const ingestKeys = m["ingestKeys"];
    const origins = m["origins"];
    if (typeof merchantId !== "string" || merchantId === "") {
      throw new Error(`merchants[${i}].merchantId debe ser un string no vacío.`);
    }
    if (!isStringArray(ingestKeys) || ingestKeys.length === 0 || ingestKeys.length > 2) {
      throw new Error(`merchants[${i}].ingestKeys debe tener una o dos claves.`);
    }
    if (!isStringArray(origins) || origins.length === 0) {
      throw new Error(`merchants[${i}].origins debe tener al menos un origen.`);
    }
    return { merchantId, ingestKeys, origins };
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
