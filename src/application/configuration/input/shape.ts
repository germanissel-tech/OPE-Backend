// The shape reader of the configuration inputs (ADR-024, ADR-031): typed reads of raw JSON —
// the release files, the seed of `OPE_MERCHANTS`, the body of the administration API — that
// record the first field that does not have the shape and keep reading with a placeholder, so
// the reading is a Result and never a throw (ADR-023). The vocabularies, the ranges and the
// permutations belong to the domain; here only the shape is judged. Every key is read by its
// name from the closed list `Key`, so a key is never a loose string.
import { InvalidConfigurationValue } from "../../../domain/configuration/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";

export type Raw = Record<string, unknown>;

/** A field inside the input, as a path from its root (`decisionPolicy.rules[2].when`). */
export type Field = string;

export type ShapeResult<T> = Result<T, InvalidConfigurationValue>;

/** The keys the inputs may carry; typed so every occurrence is checked, never a loose string. */
export type Key =
  | "all"
  | "any"
  | "not"
  | "fact"
  | "type"
  | "subtype"
  | "min"
  | "block"
  | "first"
  | "then"
  | "key"
  | "value"
  | "id"
  | "barrier"
  | "strength"
  | "when"
  | "weight"
  | "weights"
  | "strong"
  | "supporting"
  | "readingSeconds"
  | "rules"
  | "version"
  | "threshold"
  | "priority"
  | "evidence"
  | "freshStockAndPrice"
  | "availableVariant"
  | "maxIncentiveShare"
  | "incentiveLadderShare"
  | "marginShare"
  | "directIncentiveOnPrice"
  | "returnRisk"
  | "highIntent"
  | "abandonment"
  | "interventionsPerSession"
  | "cooldownSeconds"
  | "interventionsPerVisitorPerDay"
  | "returnsPolicy"
  | "fitData"
  | "authorizedAttributes"
  | "freshness"
  | "catalogMs"
  | "stockAndPriceMs"
  | "syncLevel"
  | "receiptsKept"
  | "noDataAfterMs"
  | "minutesLevelMaxAgeMs"
  | "minutesLevelMedianIntervalMs"
  | "minutesLevelMinReceipts"
  | "holdoutShare"
  | "decisionPolicy"
  | "commercialPolicy"
  | "evidenceProfile"
  | "surfaces"
  | "barriers"
  | "syncStrategy"
  | "catalog"
  | "stockAndPrice"
  | "orders"
  | "returns"
  | "locales"
  | "supported"
  | "fallback"
  | "anchors"
  | "attributeLabels"
  | "label"
  | "selectors"
  | "dedupWindow"
  | "ttlMs"
  | "maxIds"
  | "clockSkewToleranceMs"
  | "eventPastToleranceMs"
  | "sessionWindowMs"
  | "visitorWindowMs"
  | "signatureWindowMs"
  | "rotationGraceMaxMs"
  | "anchorDiagnosticsKept"
  | "unmappedValuesKept"
  | "retryAfterSeconds";

/** `parent.key`, or `key` at the root. */
export const at = (parent: Field, key: Key): Field => named(parent, key);

/** `parent.name` for a name that is not a key of the vocabulary (an anchor of the map). */
export const named = (parent: Field, name: string): Field => (parent === "" ? name : `${parent}.${name}`);

export class Shape {
  #failure: InvalidConfigurationValue | undefined;

  /** The first field that did not have the shape, if any. */
  get failure(): InvalidConfigurationValue | undefined {
    return this.#failure;
  }

  /** Records the first offence only: the reader keeps going with placeholders. */
  refuse(where: Field, problem: string): void {
    this.#failure ??= new InvalidConfigurationValue(where, problem);
  }

  /** The value read, or the first offence. */
  result<T>(value: T): ShapeResult<T> {
    return this.#failure === undefined ? ok(value) : fail(this.#failure);
  }

  get(raw: Raw, key: Key): unknown {
    return raw[key];
  }

  has(raw: Raw, key: Key): boolean {
    return raw[key] !== undefined;
  }

  record(value: unknown, where: Field): Raw {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      this.refuse(where, "is not an object");
      return {};
    }
    return value as Raw;
  }

  /** The record under a key, or an empty one (refused) when it is not an object. */
  recordAt(raw: Raw, key: Key, where: Field): Raw {
    return this.record(raw[key], at(where, key));
  }

  string(raw: Raw, key: Key, where: Field): string {
    const value = raw[key];
    if (typeof value !== "string") {
      this.refuse(at(where, key), "must be a string");
      return "";
    }
    return value;
  }

  number(raw: Raw, key: Key, where: Field): number {
    return this.numberOf(raw[key], at(where, key));
  }

  numberOf(value: unknown, where: Field): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.refuse(where, "must be a number");
      return 0;
    }
    return value;
  }

  boolean(raw: Raw, key: Key, where: Field): boolean {
    const value = raw[key];
    if (typeof value !== "boolean") {
      this.refuse(at(where, key), "must be a boolean");
      // Stryker disable next-line BooleanLiteral: a placeholder after a refusal is never observable
      return false;
    }
    return value;
  }

  oneOf<T extends string>(raw: Raw, key: Key, options: readonly T[], where: Field): T {
    const value = raw[key];
    if (typeof value === "string" && (options as readonly string[]).includes(value)) return value as T;
    this.refuse(at(where, key), `must be one of ${options.join(", ")}`);
    return options[0] ?? ("" as T);
  }

  strings(raw: Raw, key: Key, where: Field): string[] {
    const value = raw[key];
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      this.refuse(at(where, key), "must be an array of strings");
      // Stryker disable next-line ArrayDeclaration: a placeholder after a refusal is never observable
      return [];
    }
    return value;
  }

  /** A list of objects: each one is read by its own caller, which knows what keys it admits. */
  records(raw: Raw, key: Key, where: Field): Raw[] {
    const value = raw[key];
    const field = at(where, key);
    if (!Array.isArray(value)) {
      this.refuse(field, "must be an array of objects");
      // Stryker disable next-line ArrayDeclaration: a placeholder after a refusal is never observable
      return [];
    }
    return value.map((entry, i) => this.record(entry, named(field, String(i))));
  }

  numbers(raw: Raw, key: Key, where: Field): number[] {
    const value = raw[key];
    const field = at(where, key);
    if (!Array.isArray(value)) {
      this.refuse(field, "must be an array of numbers");
      return [];
    }
    return value.map((item: unknown, i) => this.numberOf(item, `${field}[${i}]`));
  }

  /** The elements of a list under a key, each read at its index. */
  list<T>(raw: Raw, key: Key, where: Field, read: (item: unknown, at: Field) => T): T[] {
    const value = raw[key];
    const field = at(where, key);
    if (!Array.isArray(value)) {
      this.refuse(field, "must be an array");
      return [];
    }
    return value.map((item: unknown, i) => read(item, `${field}[${i}]`));
  }

  /** Every key of a record that is not admitted is refused: undeclared fields never pass silently. */
  closed(raw: Raw, keys: readonly Key[], where: Field): void {
    const unknown = Object.keys(raw).find((k) => !(keys as readonly string[]).includes(k));
    if (unknown !== undefined) this.refuse(named(where, unknown), "is not a field of this object");
  }

  /** A required key: absent is refused. */
  required(raw: Raw, key: Key, where: Field): void {
    if (raw[key] === undefined) this.refuse(at(where, key), "is required");
  }
}
