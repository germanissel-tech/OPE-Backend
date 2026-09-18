// Business errors of the merchant module (ADR-023): the credential and the origin.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "merchant" as const;

export class Unauthorized extends DomainError {
  readonly code = "unauthorized" as const;
  readonly module = MODULE;
  constructor() {
    super("Credential missing or invalid.");
  }
}

export class OriginNotAllowed extends DomainError {
  readonly code = "origin-not-allowed" as const;
  readonly module = MODULE;
  constructor() {
    super("Origin not registered for the merchant.");
  }
}

/** A registered origin that is not `scheme://host[:port]` (configuration; fail-closed). */
export class InvalidOrigin extends DomainError {
  readonly code = "invalid-origin" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("A registered origin must be scheme://host[:port] without a path.", { index });
  }
}

export type MerchantError = Unauthorized | OriginNotAllowed | InvalidOrigin;
