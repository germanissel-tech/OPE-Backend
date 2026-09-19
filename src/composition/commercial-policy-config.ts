// `OPE_MERCHANTS[i].commercialPolicy` and `evidenceProfile` (ADR-027): the shape is parsed here;
// the rules — ceiling, ladder, margin, the vocabulary of the return-risk condition, budgets —
// belong to the domain (`CommercialPolicy.of`, ADR-024). Absent fields take the stakeholder's
// defaults; an absent margin stays absent (no incentive goes out). A domain rejection becomes a
// ConfigError naming the field.
import { CommercialPolicy, type Abandonment, type HighIntent } from "../domain/commercial/index.js";
import { EMPTY_PROFILE, type MerchantProfile } from "../domain/selection/index.js";
import {
  at,
  bool,
  condition,
  get,
  num,
  oneOf,
  percentAsRate,
  percentsAsRates,
  record,
  rejected,
  str,
  strings,
  type Key,
} from "./condition-config.js";
import type { MerchantField } from "./config-error.js";

const HIGH_INTENTS: readonly HighIntent[] = ["from-cart", "from-checkout", "never"];
const ABANDONMENTS: readonly Abandonment[] = ["nothing", "reassure-returns"];
// The configuration speaks integer percentages; the domain, rates 0..1 (CLAUDE.md § Convenciones).
const DEFAULT_CEILING_SHARE = 0.1;
const DEFAULT_FIRST_STEP_SHARE = 0.05;
const DEFAULT_LADDER_SHARE: readonly number[] = [DEFAULT_FIRST_STEP_SHARE, DEFAULT_CEILING_SHARE];
/** The configuration field behind each rate the domain rejects by name. */
const FIELD_BY_SHARE: Readonly<Record<string, Key>> = {
  maxIncentiveShare: "maxIncentivePercent",
  incentiveLadderShare: "incentiveLadderPercent",
  marginShare: "marginPercent",
};
const DEFAULT_INTERVENTIONS_PER_SESSION = 1;
const DEFAULT_COOLDOWN_SECONDS = 0;
const DEFAULT_PER_VISITOR_PER_DAY = 3;
const DEFAULT_RETURN_RISK = {
  all: [
    { fact: "eventCount" as const, type: "size_selector_interacted" as const, min: 2 },
    { fact: "dwellSeconds" as const, block: "policies" as const },
  ],
};

/** The merchant's commercial policy, or a ConfigError naming the field that cannot start the server. */
export function parseCommercialPolicy(value: unknown, parent: MerchantField): CommercialPolicy {
  const raw = record(value, parent);
  const ceiling = get(raw, "maxIncentivePercent");
  const ladder = get(raw, "incentiveLadderPercent");
  const margin = get(raw, "marginPercent");
  const risk = get(raw, "returnRisk");
  const policy = CommercialPolicy.of({
    version: str(raw, "version", parent),
    maxIncentiveShare:
      ceiling === undefined
        ? DEFAULT_CEILING_SHARE
        : percentAsRate(ceiling, at(parent, "maxIncentivePercent")),
    incentiveLadderShare:
      ladder === undefined
        ? DEFAULT_LADDER_SHARE
        : percentsAsRates(ladder, at(parent, "incentiveLadderPercent")),
    ...(margin === undefined ? {} : { marginShare: percentAsRate(margin, at(parent, "marginPercent")) }),
    directIncentiveOnPrice: bool(raw, "directIncentiveOnPrice", parent, true),
    returnRisk: risk === undefined ? DEFAULT_RETURN_RISK : condition(risk, at(parent, "returnRisk")),
    highIntent: oneOf(get(raw, "highIntent") ?? "from-checkout", HIGH_INTENTS, at(parent, "highIntent")),
    abandonment: oneOf(
      get(raw, "abandonment") ?? "reassure-returns",
      ABANDONMENTS,
      at(parent, "abandonment"),
    ),
    interventionsPerSession: num(raw, "interventionsPerSession", parent, DEFAULT_INTERVENTIONS_PER_SESSION),
    cooldownSeconds: num(raw, "cooldownSeconds", parent, DEFAULT_COOLDOWN_SECONDS),
    interventionsPerVisitorPerDay: num(
      raw,
      "interventionsPerVisitorPerDay",
      parent,
      DEFAULT_PER_VISITOR_PER_DAY,
    ),
  });
  if (!policy.ok) throw rejected(parent, policy.error, undefined, FIELD_BY_SHARE);
  return policy.value;
}

/** What the merchant declares it can sustain; anything absent is false or empty (fail-closed). */
export function parseEvidenceProfile(value: unknown, parent: MerchantField): MerchantProfile {
  const raw = record(value, parent);
  const attributes = get(raw, "authorizedAttributes");
  return {
    returnsPolicy: bool(raw, "returnsPolicy", parent, EMPTY_PROFILE.returnsPolicy),
    fitData: bool(raw, "fitData", parent, EMPTY_PROFILE.fitData),
    authorizedAttributes:
      attributes === undefined
        ? EMPTY_PROFILE.authorizedAttributes
        : strings(attributes, at(parent, "authorizedAttributes")),
  };
}
