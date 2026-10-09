// The seed of merchants (ADR-031): `OPE_MERCHANTS` (JSON) or `OPE_MERCHANTS_FILE`. The shape is
// parsed here; the rules are the Merchant's (a rejected seed stops the start naming the field),
// and what each merchant declares of its configuration is read by the same reader as the API.
import path from "node:path";
import {
  DECLARED_CONFIGURATION_KEYS,
  readDeclaredConfiguration,
} from "../application/configuration/index.js";
import { profileOfSeed, type MerchantSeed } from "../application/merchant/index.js";
import { Merchant, MerchantProfile, type MerchantContactRecord } from "../domain/merchant/index.js";
import { asMerchantId, type DomainError, type MerchantId } from "../domain/shared-kernel/index.js";
import { ConfigError, type MerchantField } from "./config-error.js";
import { listOf, NON_EMPTY_STRING, NOT_AN_OBJECT, parseJson, STRING_ARRAY, text } from "./env.js";
import { parseExperiments } from "./experiments-config.js";
import { rejected } from "./seed-errors.js";
import type { DeclaredConfiguration } from "../domain/configuration/index.js";
import type { Experiments } from "../domain/experiment/index.js";

/** A merchant as configured: its seed (judged by the entity, imported at start-up) and its experiments (the set judged by its owner, ADR-022). */
export interface MerchantConfig {
  merchantId: MerchantId;
  seed: MerchantSeed;
  experiments: Experiments;
  /** What the seed declares of the configuration (ADR-031): the version 1 of the merchant; empty when nothing. */
  declared: DeclaredConfiguration;
}

/** `OPE_MERCHANTS` (JSON) or `OPE_MERCHANTS_FILE`; none configured means none. */
export function readMerchants(env: NodeJS.ProcessEnv, readFile: (file: string) => string): MerchantConfig[] {
  const inline = text(env, "OPE_MERCHANTS");
  const file = text(env, "OPE_MERCHANTS_FILE");
  const raw = inline ?? (file !== undefined ? readFile(path.resolve(file)) : undefined);
  return raw === undefined ? [] : parseMerchants(raw);
}

/**
 * The rules of the merchant, applied to the seed at start-up so a bad one stops the start
 * naming the field; the raw keys stand in for fingerprints (the import fingerprints them).
 */
function judgeSeed(seed: MerchantSeed): DomainError | undefined {
  const at = new Date(0);
  const record = profileOfSeed(seed);
  const profile = record === undefined ? undefined : MerchantProfile.of(record);
  if (profile !== undefined && !profile.ok) return profile.error;
  const judged = Merchant.of({
    merchantId: asMerchantId(seed.merchantId),
    origins: seed.origins,
    credentials: [
      ...seed.ingestKeys.map((k) => Merchant.credential("ingest", k, at)),
      ...seed.platformKeys.map((k) => Merchant.credential("platform", k, at)),
      ...seed.platformSecrets.map((s) => Merchant.credential("signing", s, at, s)),
    ],
    createdAt: at,
    profile: profile?.value,
  });
  return judged.ok ? undefined : judged.error;
}

/** An optional text of the seed: absent, or a string; anything else names the field. */
function optionalText(m: Record<string, unknown>, field: MerchantField): string | undefined {
  const key = field.slice(field.lastIndexOf(".") + 1);
  const value = m[key];
  if (value !== undefined && typeof value !== "string") throw new ConfigError(field, "must be a string");
  return value;
}

/** The contact of the seed (ADR-045): absent, or an object with `name` and `email` and optional `phone` and `role`. */
function contactOf(m: Record<string, unknown>, at: MerchantField): MerchantContactRecord | undefined {
  const raw = m["contact"];
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null) throw new ConfigError(`${at}.contact`, NOT_AN_OBJECT);
  const c = raw as Record<string, unknown>;
  const name = c["name"];
  const email = c["email"];
  if (typeof name !== "string") throw new ConfigError(`${at}.contact.name`, NON_EMPTY_STRING);
  if (typeof email !== "string") throw new ConfigError(`${at}.contact.email`, NON_EMPTY_STRING);
  return {
    name,
    email,
    phone: optionalText(c, `${at}.contact.phone`),
    role: optionalText(c, `${at}.contact.role`),
  };
}

/** Parses the shape (an array of merchants with an id and lists of strings); the rules are the Merchant's. */
function parseMerchants(raw: string): MerchantConfig[] {
  const parsed = listOf(parseJson("OPE_MERCHANTS", raw), "merchants");
  if (parsed === undefined) throw new ConfigError("OPE_MERCHANTS", "must be a JSON array of merchants");
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
    const at: MerchantField = `merchants[${i}]`;
    const seed: MerchantSeed = {
      merchantId,
      ingestKeys,
      origins,
      platformKeys,
      platformSecrets,
      displayName: optionalText(m, `${at}.displayName`),
      storeUrl: optionalText(m, `${at}.storeUrl`),
      contact: contactOf(m, at),
      notes: optionalText(m, `${at}.notes`),
    };
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
