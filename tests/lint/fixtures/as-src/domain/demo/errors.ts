// Lint fixture (as if under src/domain/<module>/errors.ts): violates only ope/domain-error-shape.
// One class does not extend DomainError; the other declares another module; no union is exported.
import { DomainError } from "../../../../../../src/domain/shared-kernel/index.js";

export class NotAnError {
  readonly code = "not-an-error" as const;
}

export class WrongModule extends DomainError {
  readonly code = "wrong-module" as const;
  readonly module = "ledger" as const;
}
