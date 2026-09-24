// The policies as the configuration speaks them (ADR-026, ADR-027, ADR-031): the shape of
// `OPE_MERCHANTS[i].decisionPolicy`, of `config/treatment-defaults.json` and of the
// administration API — every share a fraction of 1, in and out (feature 022).
// A merchant declares a policy by its version and any of its fields; what it does not declare
// resolves from the treatment defaults field by field, and the merged input is judged by the
// factory of the policy. A rejection of the factory is located at its field.
import { BarrierRules, type Rule, type RuleWeights } from "../barrier/index.js";
import { CommercialPolicy, type CommercialPolicyRecord } from "../commercial/index.js";
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

/**
 * What the configuration declares of a commercial policy: exactly the record the policy is built
 * from. The two shapes used to be written out separately because they differed in unit —integer
 * percentages here, rates there—; since feature 022 there is one unit, so there is one shape, and
 * writing it twice would be two places to forget.
 */
export type CommercialPolicyInput = CommercialPolicyRecord;

export type EvidenceProfileInput = MerchantProfile;

/** What a merchant declares of a policy: its version, and the fields it overrides. */
export type DecisionPolicyDeclared = Partial<DecisionPolicyInput> & { version: string };
export type CommercialPolicyDeclared = Partial<CommercialPolicyInput> & { version: string };
export type EvidenceProfileDeclared = Partial<EvidenceProfileInput>;

export type PolicyResult<T> = Result<T, InvalidConfigurationValue>;

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

  /**
   * The commercial policy of the input, or the field refused. There is nothing to convert: the
   * input speaks in the same rates the policy reasons with, so the only judge is the policy
   * itself and the name it rejects is the name the configuration declared (feature 022).
   */
  commercial(input: CommercialPolicyInput): PolicyResult<CommercialPolicy> {
    const at = this.#at;
    const policy = CommercialPolicy.of({
      version: input.version,
      maxIncentiveShare: input.maxIncentiveShare,
      incentiveLadderShare: [...input.incentiveLadderShare],
      ...(input.marginShare === undefined ? {} : { marginShare: input.marginShare }),
      directIncentiveOnPrice: input.directIncentiveOnPrice,
      returnRisk: input.returnRisk,
      highIntent: input.highIntent,
      abandonment: input.abandonment,
      interventionsPerSession: input.interventionsPerSession,
      cooldownSeconds: input.cooldownSeconds,
      interventionsPerVisitorPerDay: input.interventionsPerVisitorPerDay,
    });
    return policy.ok ? ok(policy.value) : fail(PolicyInput.located(at, policy.error));
  }

  /**
   * A rejection of a factory located at its field: `details.path` always names the field (every
   * error of the policy factories does) and `details.index` the element — of the list `indexed`
   * when the path is inside its elements (`rules[2].when…`), of the field itself otherwise
   * (`incentiveLadderShare[1]`).
   *
   * There used to be a map from the domain field to the configuration field that fed it, because a
   * rate was read from a percentage and the two had different names. They have the same name now
   * (feature 022), so the path the error carries is already the path to report.
   */
  private static located(at: string, error: DomainError, indexed?: string): InvalidConfigurationValue {
    const { path, index } = error.details;
    const inside = String(path);
    const field = `${at}.${inside}`;
    if (typeof index !== "number") return new InvalidConfigurationValue(field, error.message);
    if (indexed === undefined) return new InvalidConfigurationValue(`${field}[${index}]`, error.message);
    return new InvalidConfigurationValue(`${at}.${indexed}[${index}].${inside}`, error.message);
  }
}
