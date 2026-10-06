// Errors of the configuration module (constitution XI; ADR-031): a value of any level that
// violates the invariants of its type, and the rules of publishing a merchant version.
import {
  DomainError,
  type ConfigurationFrozen,
  type ConfigurationReasonRequired,
} from "../shared-kernel/index.js";

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

/** No version of a level carries that number (feature 036): a history is read by number, and it has gaps. */
export class ConfigurationVersionNotFound extends DomainError {
  readonly code = "configuration-version-not-found" as const;
  readonly module = MODULE;
  constructor(level: string, version: number) {
    super(`The ${level} level has no version ${version}.`);
  }
}

export type ConfigurationError =
  | InvalidConfigurationValue
  | ConfigurationFrozen
  | ConfigurationReasonRequired
  | ConfigurationVersionNotFound;
