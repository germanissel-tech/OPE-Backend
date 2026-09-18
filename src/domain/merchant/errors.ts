// Business errors of the merchant module (ADR-023): the credential and the origin.
import { DomainError, type ModuleName } from "../shared-kernel/index.js";

const MODULE = "merchant" satisfies ModuleName;

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

export type MerchantError = Unauthorized | OriginNotAllowed;
