// The reading of the policies as the configuration speaks them (ADR-026, ADR-027): the
// declared shape (a version and any field) of the decision policy, the commercial policy and
// the evidence profile. The ranges and the vocabularies are judged by the domain once the
// declared fields are merged over the treatment defaults (`TreatmentValues`).
import { condition } from "./condition.js";
import { at, type Field, type Key, type Raw, type Shape } from "./shape.js";
import type { Rule, RuleStrength } from "../../../domain/barrier/index.js";
import type { Abandonment, HighIntent } from "../../../domain/commercial/index.js";
import type {
  CommercialPolicyDeclared,
  DecisionPolicyDeclared,
  EvidenceProfileDeclared,
} from "../../../domain/configuration/index.js";
import type { EvidenceRequirements } from "../../../domain/decision/index.js";
import type { Barrier } from "../../../domain/shared-kernel/index.js";

const STRENGTHS: readonly RuleStrength[] = ["strong", "supporting"];
const HIGH_INTENTS: readonly HighIntent[] = ["from-cart", "from-checkout", "never"];
const ABANDONMENTS: readonly Abandonment[] = ["nothing", "reassure-returns"];

const RULE_KEYS: readonly Key[] = ["id", "barrier", "strength", "weight", "when"];
const DECISION_KEYS: readonly Key[] = [
  "version",
  "rules",
  "weights",
  "readingSeconds",
  "threshold",
  "priority",
  "evidence",
];
const WEIGHT_KEYS: readonly Key[] = ["strong", "supporting"];
const EVIDENCE_KEYS: readonly Key[] = ["freshStockAndPrice", "availableVariant"];
/** The fields of the commercial policy that are numbers, read when present. */
const COMMERCIAL_NUMBERS: readonly Key[] = [
  "maxIncentiveShare",
  "marginShare",
  "interventionsPerSession",
  "cooldownSeconds",
  "interventionsPerVisitorPerDay",
];
const COMMERCIAL_KEYS: readonly Key[] = [
  "version",
  ...COMMERCIAL_NUMBERS,
  "incentiveLadderShare",
  "directIncentiveOnPrice",
  "returnRisk",
  "highIntent",
  "abandonment",
];
const PROFILE_KEYS: readonly Key[] = ["returnsPolicy", "fitData", "authorizedAttributes"];

/** Reads a key only when present: absent means "not declared". */
function optional<K extends Key, T>(shape: Shape, raw: Raw, key: K, read: () => T): Partial<Record<K, T>> {
  return (shape.has(raw, key) ? { [key]: read() } : {}) as Partial<Record<K, T>>;
}

function rule(shape: Shape, value: unknown, where: Field): Rule {
  const raw = shape.record(value, where);
  shape.closed(raw, RULE_KEYS, where);
  return {
    id: shape.string(raw, "id", where),
    barrier: shape.string(raw, "barrier", where) as Barrier,
    strength: shape.oneOf(raw, "strength", STRENGTHS, where),
    when: condition(shape, shape.get(raw, "when"), at(where, "when")),
    ...optional(shape, raw, "weight", () => shape.number(raw, "weight", where)),
  };
}

function weights(shape: Shape, raw: Raw, where: Field): { strong: number; supporting: number } {
  const record = shape.recordAt(raw, "weights", where);
  const field = at(where, "weights");
  shape.closed(record, WEIGHT_KEYS, field);
  return {
    strong: shape.number(record, "strong", field),
    supporting: shape.number(record, "supporting", field),
  };
}

function evidence(shape: Shape, raw: Raw, where: Field): Partial<EvidenceRequirements> {
  const record = shape.recordAt(raw, "evidence", where);
  const field = at(where, "evidence");
  shape.closed(record, EVIDENCE_KEYS, field);
  // An absent key stays absent: what is declared is what the merchant sent, and turning an omission
  // into an empty list both echoes back something the contract forbids (`minItems: 1`) and, merged
  // over the defaults, silently empties the other key. The resolution supplies what is missing.
  const list = (key: Key): Barrier[] | undefined =>
    shape.has(record, key) ? (shape.strings(record, key, field) as Barrier[]) : undefined;
  const fresh = list("freshStockAndPrice");
  const variant = list("availableVariant");
  return {
    ...(fresh === undefined ? {} : { freshStockAndPrice: fresh }),
    ...(variant === undefined ? {} : { availableVariant: variant }),
  };
}

export function decisionPolicyDeclared(shape: Shape, value: unknown, where: Field): DecisionPolicyDeclared {
  const raw = shape.record(value, where);
  shape.closed(raw, DECISION_KEYS, where);
  shape.required(raw, "version", where);
  return {
    version: shape.string(raw, "version", where),
    ...optional(shape, raw, "rules", () =>
      shape.list(raw, "rules", where, (item, w) => rule(shape, item, w)),
    ),
    ...optional(shape, raw, "weights", () => weights(shape, raw, where)),
    ...optional(shape, raw, "readingSeconds", () => shape.number(raw, "readingSeconds", where)),
    ...optional(shape, raw, "threshold", () => shape.number(raw, "threshold", where)),
    ...optional(shape, raw, "priority", () => shape.strings(raw, "priority", where) as Barrier[]),
    ...optional(shape, raw, "evidence", () => evidence(shape, raw, where)),
  };
}

export function commercialPolicyDeclared(
  shape: Shape,
  value: unknown,
  where: Field,
): CommercialPolicyDeclared {
  const raw = shape.record(value, where);
  shape.closed(raw, COMMERCIAL_KEYS, where);
  shape.required(raw, "version", where);
  const numbers: Partial<Record<Key, number>> = {};
  for (const key of COMMERCIAL_NUMBERS) if (shape.has(raw, key)) numbers[key] = shape.number(raw, key, where);
  return {
    version: shape.string(raw, "version", where),
    ...(numbers as Pick<CommercialPolicyDeclared, "maxIncentiveShare" | "marginShare">),
    ...optional(shape, raw, "incentiveLadderShare", () => shape.numbers(raw, "incentiveLadderShare", where)),
    ...optional(shape, raw, "directIncentiveOnPrice", () =>
      shape.boolean(raw, "directIncentiveOnPrice", where),
    ),
    ...optional(shape, raw, "returnRisk", () =>
      condition(shape, shape.get(raw, "returnRisk"), at(where, "returnRisk")),
    ),
    ...optional(shape, raw, "highIntent", () => shape.oneOf(raw, "highIntent", HIGH_INTENTS, where)),
    ...optional(shape, raw, "abandonment", () => shape.oneOf(raw, "abandonment", ABANDONMENTS, where)),
  };
}

export function evidenceProfileDeclared(shape: Shape, value: unknown, where: Field): EvidenceProfileDeclared {
  const raw = shape.record(value, where);
  shape.closed(raw, PROFILE_KEYS, where);
  return {
    ...optional(shape, raw, "returnsPolicy", () => shape.boolean(raw, "returnsPolicy", where)),
    ...optional(shape, raw, "fitData", () => shape.boolean(raw, "fitData", where)),
    ...optional(shape, raw, "authorizedAttributes", () => shape.strings(raw, "authorizedAttributes", where)),
  };
}
