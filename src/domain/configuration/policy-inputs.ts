// The policies as the configuration speaks them (ADR-026, ADR-027, ADR-031): the shape of
// `OPE_MERCHANTS[i].decisionPolicy`, of `config/treatment-defaults.json` and of the
// administration API — integer percentages at the edge, rates inside (CLAUDE.md § Convenciones).
// A merchant declares a policy by its version and any of its fields; what it does not declare
// resolves from the treatment defaults field by field, and the merged input is judged by the
// factory of the policy. A rejection of the factory is located at its field.
import { BarrierRules, type Rule, type RuleWeights, type Condition } from "../barrier/index.js";
import { CommercialPolicy, type Abandonment, type HighIntent } from "../commercial/index.js";
import { DecisionPolicy, type EvidenceRequirements } from "../decision/index.js";
import { fail, ok, type Barrier, type DomainError, type Result } from "../shared-kernel/index.js";
import { InvalidConfigurationValue } from "./errors.js";
import type { MerchantProfile } from "../selection/index.js";

export interface DecisionPolicyInput {
  version: string;
  rules: readonly Rule[];
  weights: RuleWeights;
  readingSeconds: number;
  threshold: number;
  priority: readonly Barrier[];
  evidence: EvidenceRequirements;
}

export interface CommercialPolicyInput {
  version: string;
  maxIncentivePercent: number;
  incentiveLadderPercent: readonly number[];
  marginPercent?: number;
  directIncentiveOnPrice: boolean;
  returnRisk: Condition;
  highIntent: HighIntent;
  abandonment: Abandonment;
  interventionsPerSession: number;
  cooldownSeconds: number;
  interventionsPerVisitorPerDay: number;
}

export type EvidenceProfileInput = MerchantProfile;

/** What a merchant declares of a policy: its version, and the fields it overrides. */
export type DecisionPolicyDeclared = Partial<DecisionPolicyInput> & { version: string };
export type CommercialPolicyDeclared = Partial<CommercialPolicyInput> & { version: string };
export type EvidenceProfileDeclared = Partial<EvidenceProfileInput>;

export type PolicyResult<T> = Result<T, InvalidConfigurationValue>;

/** Percentages live at the edge only: the domain works with rates 0..1. */
const PERCENT = 100;
const isPercent = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= PERCENT;
const PERCENT_PROBLEM = "must be an integer percentage between 0 and 100";

/** The configuration field behind each rate the commercial policy rejects by name. */
const FIELD_BY_SHARE: Readonly<Record<string, string>> = {
  maxIncentiveShare: "maxIncentivePercent",
  incentiveLadderShare: "incentiveLadderPercent",
  marginShare: "marginPercent",
};

/** A policy builder: the values it needs to build and judge policies from their configured shape. */
export class PolicyInput {
  readonly #at: string;

  private constructor(at: string) {
    this.#at = at;
  }

  /** The builder of the policy declared under `at` (the prefix of every pointer it names). */
  static at(at: string): PolicyInput {
    return new PolicyInput(at);
  }

  /** The defaults with every declared field on top; an undefined declared field declares nothing. */
  static merge<T extends object>(defaults: T, declared: Partial<T> | undefined): T {
    const merged: T = { ...defaults };
    for (const [key, value] of Object.entries(declared ?? {})) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
    }
    return merged;
  }

  /** The decision policy of the input, or the field the factories refuse. */
  decision(input: DecisionPolicyInput): PolicyResult<DecisionPolicy> {
    const at = this.#at;
    const rules = BarrierRules.of({
      rules: input.rules,
      weights: input.weights,
      readingSeconds: input.readingSeconds,
    });
    if (!rules.ok) return fail(PolicyInput.located(at, rules.error, "rules"));
    const policy = DecisionPolicy.of({
      version: input.version,
      rules: rules.value,
      threshold: input.threshold,
      priority: input.priority,
      evidence: input.evidence,
    });
    return policy.ok ? ok(policy.value) : fail(PolicyInput.located(at, policy.error));
  }

  /** The commercial policy of the input (percentages become rates here, once), or the field refused. */
  commercial(input: CommercialPolicyInput): PolicyResult<CommercialPolicy> {
    const at = this.#at;
    if (!isPercent(input.maxIncentivePercent)) {
      return fail(new InvalidConfigurationValue(`${at}.maxIncentivePercent`, PERCENT_PROBLEM));
    }
    const badStep = input.incentiveLadderPercent.findIndex((step) => !isPercent(step));
    if (badStep >= 0) {
      return fail(new InvalidConfigurationValue(`${at}.incentiveLadderPercent[${badStep}]`, PERCENT_PROBLEM));
    }
    if (input.marginPercent !== undefined && !isPercent(input.marginPercent)) {
      return fail(new InvalidConfigurationValue(`${at}.marginPercent`, PERCENT_PROBLEM));
    }
    const policy = CommercialPolicy.of({
      version: input.version,
      maxIncentiveShare: input.maxIncentivePercent / PERCENT,
      incentiveLadderShare: input.incentiveLadderPercent.map((step) => step / PERCENT),
      ...(input.marginPercent === undefined ? {} : { marginShare: input.marginPercent / PERCENT }),
      directIncentiveOnPrice: input.directIncentiveOnPrice,
      returnRisk: input.returnRisk,
      highIntent: input.highIntent,
      abandonment: input.abandonment,
      interventionsPerSession: input.interventionsPerSession,
      cooldownSeconds: input.cooldownSeconds,
      interventionsPerVisitorPerDay: input.interventionsPerVisitorPerDay,
    });
    return policy.ok
      ? ok(policy.value)
      : fail(PolicyInput.located(at, policy.error, undefined, FIELD_BY_SHARE));
  }

  /**
   * A rejection of a factory located at its field: `details.path` always names the field (every
   * error of the policy factories does) and `details.index` the element — of the list `indexed`
   * when the path is inside its elements (`rules[2].when…`), of the field itself otherwise
   * (`incentiveLadderPercent[1]`). `aliases` map a domain field to the configuration field that
   * fed it (a rate read from a percentage).
   */
  private static located(
    at: string,
    error: DomainError,
    indexed?: string,
    aliases: Readonly<Record<string, string>> = {},
  ): InvalidConfigurationValue {
    const { path, index } = error.details;
    const domainPath = String(path);
    const inside = aliases[domainPath] ?? domainPath;
    const field = `${at}.${inside}`;
    if (typeof index !== "number") return new InvalidConfigurationValue(field, error.message);
    if (indexed === undefined) return new InvalidConfigurationValue(`${field}[${index}]`, error.message);
    return new InvalidConfigurationValue(`${at}.${indexed}[${index}].${inside}`, error.message);
  }
}
