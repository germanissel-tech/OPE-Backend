// Business errors of the operator module (ADR-023, ADR-031): operators and their scope.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "operator" as const;

/** The bearer token is missing or belongs to no operator (fail-closed, before the body). */
export class OperatorUnknown extends DomainError {
  readonly code = "operator-unknown" as const;
  readonly module = MODULE;
  constructor() {
    super("Operator token missing or unknown.");
  }
}

/**
 * What the administration entry records for the two failures of **authority**: denied by scope, not rejected
 * by a rule. Named once because two errors say it and nothing checks the word against a literal type.
 */
const DENIED = "denied" as const;

/** The merchant is not in the operator's scope; whether it exists is not revealed. */
export class MerchantOutOfScope extends DomainError {
  readonly code = "merchant-out-of-scope" as const;
  readonly module = MODULE;
  override readonly audit = DENIED;
  constructor() {
    super("The merchant is outside the operator's scope.");
  }
}

/**
 * The operation reaches every merchant and the operator's scope is a list (feature 036).
 *
 * It is **denied and not rejected**, like being out of scope: what failed is the operator's authority and
 * not the content of the request, and the administration entry has to say which of the two it was.
 */
export class OperatorScopeTooNarrow extends DomainError {
  readonly code = "operator-scope-too-narrow" as const;
  readonly module = MODULE;
  override readonly audit = DENIED;
  constructor() {
    super("This operation changes what every merchant is served, and the operator covers only some.");
  }
}

/** An operator whose scope is neither `*` nor a list of merchants (configuration; fail-closed). */
export class InvalidOperatorScope extends DomainError {
  readonly code = "invalid-operator-scope" as const;
  readonly module = MODULE;
  constructor(index?: number) {
    super(
      "The scope of an operator is * or a list of merchant identifiers.",
      index === undefined ? {} : { index },
    );
  }
}

/** An operator without a usable token fingerprint, or with more than a rotation needs. */
export class InvalidOperatorTokens extends DomainError {
  readonly code = "invalid-operator-tokens" as const;
  readonly module = MODULE;
  constructor(index?: number) {
    super("An operator needs one or two non-empty token fingerprints.", index === undefined ? {} : { index });
  }
}

/** An operator whose display name is blank, padded or longer than a name that is shown (configuration; fail-closed). */
export class InvalidOperatorDisplayName extends DomainError {
  readonly code = "invalid-operator-display-name" as const;
  readonly module = MODULE;
  constructor() {
    super("The display name of an operator is a trimmed, non-empty string of at most 80 characters.");
  }
}

export type OperatorError =
  | OperatorUnknown
  | MerchantOutOfScope
  | OperatorScopeTooNarrow
  | InvalidOperatorScope
  | InvalidOperatorTokens
  | InvalidOperatorDisplayName;
