// Operators of OPE as the environment declares them (ADR-031): `OPE_ADMIN_OPERATORS` (JSON) or
// `OPE_ADMIN_OPERATORS_FILE`. Only the shape is parsed here; the rules are the Operator's, and a
// rejected one stops the start naming the field. The tokens never appear: only their fingerprints.
import path from "node:path";
import { asOperatorId, EVERY_MERCHANT, Operator, type OperatorScope } from "../domain/admin/index.js";
import { asMerchantId, type DomainError } from "../domain/shared-kernel/index.js";
import { ConfigError, type OperatorField } from "./config-error.js";

const NOT_AN_OBJECT = "is not an object";
const OPERATORS_VARIABLE = "OPE_ADMIN_OPERATORS";

/** The field a domain error of an operator points at (`[index]` appended when the error names one). */
const FIELD_BY_CODE: Readonly<Record<string, string>> = {
  "invalid-operator-tokens": ".tokenFingerprints",
  "invalid-operator-scope": ".scope",
};

function rejected(at: OperatorField, error: DomainError): ConfigError {
  const position = error.details["index"];
  const index = typeof position === "number" ? `[${position}]` : "";
  return new ConfigError(`${at}${FIELD_BY_CODE[error.code] ?? ""}${index}`, `is invalid (${error.message})`);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** `OPE_ADMIN_OPERATORS` (JSON) or `OPE_ADMIN_OPERATORS_FILE`; none configured means no operator. */
export function readOperators(env: NodeJS.ProcessEnv, readFile: (file: string) => string): Operator[] {
  const inline = env[OPERATORS_VARIABLE]?.trim();
  const file = env["OPE_ADMIN_OPERATORS_FILE"]?.trim();
  const raw =
    inline !== undefined && inline !== "" ? inline : file ? readFile(path.resolve(file)) : undefined;
  return raw === undefined ? [] : parseOperators(raw);
}

/** Parses the shape (an array of operators with an id, fingerprints and a scope); the rules are the Operator's. */
function parseOperators(raw: string): Operator[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      OPERATORS_VARIABLE,
      `is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (!Array.isArray(parsed)) throw new ConfigError(OPERATORS_VARIABLE, "must be a JSON array of operators");
  return parsed.map((item: unknown, i) => parseOperator(item, `operators[${i}]`));
}

function parseOperator(item: unknown, at: OperatorField): Operator {
  if (typeof item !== "object" || item === null) throw new ConfigError(at, NOT_AN_OBJECT);
  const o = item as Record<string, unknown>;
  const operatorId = o["operatorId"];
  const fingerprints = o["tokenFingerprints"];
  if (typeof operatorId !== "string" || operatorId === "") {
    throw new ConfigError(`${at}.operatorId`, "must be a non-empty string");
  }
  if (!isStringArray(fingerprints))
    throw new ConfigError(`${at}.tokenFingerprints`, "must be an array of strings");
  const operator = Operator.of({
    operatorId: asOperatorId(operatorId),
    tokenFingerprints: fingerprints,
    scope: scopeOf(o["scope"], at),
  });
  if (!operator.ok) throw rejected(at, operator.error);
  return operator.value;
}

/** `"*"` or a list of merchant identifiers. */
function scopeOf(raw: unknown, at: OperatorField): OperatorScope {
  if (raw === EVERY_MERCHANT) return EVERY_MERCHANT;
  if (isStringArray(raw)) return raw.map(asMerchantId);
  throw new ConfigError(`${at}.scope`, 'must be "*" or an array of merchant identifiers');
}
