// Business errors of the admin module (ADR-023, ADR-031): operators and their scope.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "admin" as const;

/** The bearer token is missing or belongs to no operator (fail-closed, before the body). */
export class OperatorUnknown extends DomainError {
  readonly code = "operator-unknown" as const;
  readonly module = MODULE;
  constructor() {
    super("Operator token missing or unknown.");
  }
}

/** The merchant is not in the operator's scope; whether it exists is not revealed. */
export class MerchantOutOfScope extends DomainError {
  readonly code = "merchant-out-of-scope" as const;
  readonly module = MODULE;
  constructor() {
    super("The merchant is outside the operator's scope.");
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

export type AdminError = OperatorUnknown | MerchantOutOfScope | InvalidOperatorScope | InvalidOperatorTokens;
