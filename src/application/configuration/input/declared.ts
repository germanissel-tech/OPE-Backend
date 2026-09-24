// The reading of what a merchant declares (level 3) and of the treatment defaults (level 2):
// the same shape, every field optional for the merchant and required for the defaults. The
// vocabularies and the ranges are the domain's; the pointer of an offence is a path from the
// root of the object read (`freshness.catalogMs`, `syncStrategy.orders`).
import {
  TreatmentDefaults,
  type AnchorMapRecord,
  type DeclaredConfiguration,
  type Locales,
  type SyncMode,
  type SyncStrategy,
  type Surface,
  type TreatmentDefaultsRecord,
} from "../../../domain/configuration/index.js";
import { commercialPolicyDeclared, decisionPolicyDeclared, evidenceProfileDeclared } from "./policies.js";
import { at, named, Shape, type Field, type Key, type Raw, type ShapeResult } from "./shape.js";
import type { Barrier } from "../../../domain/shared-kernel/index.js";

const FRESHNESS_KEYS: readonly Key[] = ["catalogMs", "stockAndPriceMs"];
const SYNC_LEVEL_KEYS: readonly Key[] = [
  "receiptsKept",
  "noDataAfterMs",
  "minutesLevelMaxAgeMs",
  "minutesLevelMedianIntervalMs",
  "minutesLevelMinReceipts",
];
const STRATEGY_KEYS: readonly Key[] = ["catalog", "stockAndPrice", "orders", "returns"];
const LOCALES_KEYS: readonly Key[] = ["supported", "fallback"];
const SELECTORS_KEYS: readonly Key[] = ["selectors"];
const VALUE_KEYS: readonly Key[] = [
  "freshness",
  "syncLevel",
  "holdoutShare",
  "decisionPolicy",
  "commercialPolicy",
  "evidenceProfile",
  "surfaces",
  "barriers",
  "syncStrategy",
  "locales",
];
/** The keys a merchant may declare; the seed of `OPE_MERCHANTS` admits them next to the merchant fields. */
export const DECLARED_CONFIGURATION_KEYS: readonly Key[] = [...VALUE_KEYS, "anchors"];
const DEFAULTS_KEYS: readonly Key[] = ["version", ...VALUE_KEYS];
/** What a complete policy declares beyond its version (the defaults must declare it all). */
const DECISION_FIELDS: readonly Key[] = [
  "rules",
  "weights",
  "readingSeconds",
  "threshold",
  "priority",
  "evidence",
];
const COMMERCIAL_FIELDS: readonly Key[] = [
  "maxIncentiveShare",
  "incentiveLadderShare",
  "directIncentiveOnPrice",
  "returnRisk",
  "highIntent",
  "abandonment",
  "interventionsPerSession",
  "cooldownSeconds",
  "interventionsPerVisitorPerDay",
];
const PROFILE_FIELDS: readonly Key[] = ["returnsPolicy", "fitData", "authorizedAttributes"];

/** The values with parts that are all numbers, and the keys each admits. */
const NUMBER_PARTS = { freshness: FRESHNESS_KEYS, syncLevel: SYNC_LEVEL_KEYS } as const;

/** The record under `key`, closed to the keys it admits, with every present key read as a number. */
function numbersAt(
  shape: Shape,
  raw: Raw,
  key: keyof typeof NUMBER_PARTS,
  where: Field,
): Record<string, number> {
  const keys = NUMBER_PARTS[key];
  const record = shape.recordAt(raw, key, where);
  const field = at(where, key);
  shape.closed(record, keys, field);
  const read: Record<string, number> = {};
  for (const k of keys) if (shape.has(record, k)) read[k] = shape.number(record, k, field);
  return read;
}

function locales(shape: Shape, raw: Raw, where: Field): Locales {
  const record = shape.recordAt(raw, "locales", where);
  const field = at(where, "locales");
  shape.closed(record, LOCALES_KEYS, field);
  shape.required(record, "supported", field);
  const supported = shape.strings(record, "supported", field);
  return shape.has(record, "fallback")
    ? { supported, fallback: shape.string(record, "fallback", field) }
    : { supported };
}

function strategy(shape: Shape, raw: Raw, where: Field): Partial<SyncStrategy> {
  const record = shape.recordAt(raw, "syncStrategy", where);
  const field = at(where, "syncStrategy");
  shape.closed(record, STRATEGY_KEYS, field);
  const read: { -readonly [F in keyof SyncStrategy]?: SyncMode } = {};
  for (const key of STRATEGY_KEYS) {
    if (shape.has(record, key))
      read[key as keyof SyncStrategy] = shape.string(record, key, field) as SyncMode;
  }
  return read;
}

function anchors(shape: Shape, raw: Raw, where: Field): AnchorMapRecord {
  const record = shape.recordAt(raw, "anchors", where);
  const field = at(where, "anchors");
  const read: Record<string, { selectors: string[] }> = {};
  for (const anchor of Object.keys(record)) {
    const entry = shape.record(record[anchor], named(field, anchor));
    shape.closed(entry, SELECTORS_KEYS, named(field, anchor));
    read[anchor] = { selectors: shape.strings(entry, "selectors", named(field, anchor)) };
  }
  return read;
}

/** The declared values, each read only when present. */
function values(shape: Shape, raw: Raw, where: Field): DeclaredConfiguration {
  const read: DeclaredConfiguration = {};
  if (shape.has(raw, "freshness")) read.freshness = numbersAt(shape, raw, "freshness", where);
  if (shape.has(raw, "syncLevel")) read.syncLevel = numbersAt(shape, raw, "syncLevel", where);
  if (shape.has(raw, "holdoutShare")) read.holdoutShare = shape.number(raw, "holdoutShare", where);
  if (shape.has(raw, "decisionPolicy")) {
    read.decisionPolicy = decisionPolicyDeclared(
      shape,
      shape.get(raw, "decisionPolicy"),
      at(where, "decisionPolicy"),
    );
  }
  if (shape.has(raw, "commercialPolicy")) {
    read.commercialPolicy = commercialPolicyDeclared(
      shape,
      shape.get(raw, "commercialPolicy"),
      at(where, "commercialPolicy"),
    );
  }
  if (shape.has(raw, "evidenceProfile")) {
    read.evidenceProfile = evidenceProfileDeclared(
      shape,
      shape.get(raw, "evidenceProfile"),
      at(where, "evidenceProfile"),
    );
  }
  if (shape.has(raw, "surfaces")) read.surfaces = shape.strings(raw, "surfaces", where) as Surface[];
  if (shape.has(raw, "barriers")) read.barriers = shape.strings(raw, "barriers", where) as Barrier[];
  if (shape.has(raw, "syncStrategy")) read.syncStrategy = strategy(shape, raw, where);
  if (shape.has(raw, "locales")) read.locales = locales(shape, raw, where);
  if (shape.has(raw, "anchors")) read.anchors = anchors(shape, raw, where);
  return read;
}

/** What a merchant declares: any value, partially where the value has parts, plus its anchor map. */
export function readDeclaredConfiguration(
  value: unknown,
  where: Field = "",
): ShapeResult<DeclaredConfiguration> {
  const shape = new Shape();
  const raw = shape.record(value, where);
  shape.closed(raw, DECLARED_CONFIGURATION_KEYS, where);
  return shape.result(values(shape, raw, where));
}

/** Every key of `keys` present in the record under `key`. */
function complete(shape: Shape, raw: Raw, key: Key, keys: readonly Key[]): void {
  const record = shape.recordAt(raw, key, "");
  for (const k of keys) shape.required(record, k, key);
}

/** The treatment defaults of the release: every value present and complete, with its version. */
export function readTreatmentDefaults(value: unknown): ShapeResult<TreatmentDefaults> {
  const shape = new Shape();
  const raw = shape.record(value, "");
  shape.closed(raw, DEFAULTS_KEYS, "");
  for (const key of DEFAULTS_KEYS) shape.required(raw, key, "");
  complete(shape, raw, "freshness", FRESHNESS_KEYS);
  complete(shape, raw, "syncLevel", SYNC_LEVEL_KEYS);
  complete(shape, raw, "syncStrategy", STRATEGY_KEYS);
  complete(shape, raw, "decisionPolicy", DECISION_FIELDS);
  complete(shape, raw, "commercialPolicy", COMMERCIAL_FIELDS);
  complete(shape, raw, "evidenceProfile", PROFILE_FIELDS);
  const declared = values(shape, raw, "");
  const read = shape.result({
    ...(declared as unknown as TreatmentDefaultsRecord),
    version: shape.string(raw, "version", ""),
  });
  if (!read.ok) return read;
  return TreatmentDefaults.of(read.value);
}
