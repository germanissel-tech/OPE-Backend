// Errors of the configuration module (constitution XI; ADR-031): a value of any level that
// violates the invariants of its type, and the rules of publishing a merchant version.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "configuration" as const;

/**
 * A value of the platform configuration, the treatment defaults or a merchant version that its
 * type refuses; `pointer` names the field from the root of the level (`freshness.catalogMs`,
 * `commercialPolicy.incentiveLadderPercent[1]`). One code for every level: what differs is where.
 */
export class InvalidConfigurationValue extends DomainError {
  readonly code = "invalid-configuration-value" as const;
  readonly module = MODULE;
  readonly pointer: string;
  readonly problem: string;
  constructor(pointer: string, problem: string) {
    super(`${pointer} is invalid (${problem}).`, { pointer, problem });
    this.pointer = pointer;
    this.problem = problem;
  }

  /** The same offence, located under the field that carried the values (`declared.` in the body of the API). */
  under(prefix: string): InvalidConfigurationValue {
    return new InvalidConfigurationValue(`${prefix}.${this.pointer}`, this.problem);
  }
}

/** An experiment is active: only a corrective version, with its reason, may be published (03 §4.10). */
export class ConfigurationFrozen extends DomainError {
  readonly code = "configuration-frozen" as const;
  readonly module = MODULE;
  constructor() {
    super(
      "The configuration is frozen while an experiment is active: only a corrective version is accepted.",
    );
  }
}

export class ConfigurationReasonRequired extends DomainError {
  readonly code = "configuration-reason-required" as const;
  readonly module = MODULE;
  constructor() {
    super("A corrective configuration version needs a reason.", { pointer: "reason" });
  }
}

export type ConfigurationError =
  InvalidConfigurationValue | ConfigurationFrozen | ConfigurationReasonRequired;
