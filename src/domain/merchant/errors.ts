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

/** A platform key that is empty or equal to an ingest key (configuration; fail-closed). */
export class PlatformKeyCollision extends DomainError {
  readonly code = "platform-key-collision" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("A platform key must be non-empty and distinct from every ingest key.", { index });
  }
}

/** A signing secret that is empty or equal to a key (configuration; fail-closed). */
export class InvalidPlatformSecret extends DomainError {
  readonly code = "invalid-platform-secret" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("A platform signing secret must be non-empty and distinct from every key.", { index });
  }
}

/** The platform request must be signed and carries no signature or no timestamp (ADR-029). */
export class SignatureMissing extends DomainError {
  readonly code = "signature-missing" as const;
  readonly module = MODULE;
  constructor() {
    super("The request must carry X-OPE-Timestamp and X-OPE-Signature.");
  }
}

/** The signature is malformed or matches none of the merchant's secrets (ADR-029). */
export class SignatureInvalid extends DomainError {
  readonly code = "signature-invalid" as const;
  readonly module = MODULE;
  constructor() {
    super("The signature does not match the body and timestamp for this merchant.");
  }
}

/** The timestamp is outside the accepted window around the server clock (ADR-029). */
export class SignatureExpired extends DomainError {
  readonly code = "signature-expired" as const;
  readonly module = MODULE;
  constructor() {
    super("The signature timestamp is outside the accepted window.");
  }
}

export type SignatureError = SignatureMissing | SignatureInvalid | SignatureExpired;

export type MerchantError =
  | Unauthorized
  | OriginNotAllowed
  | InvalidOrigin
  | PlatformKeyCollision
  | InvalidPlatformSecret
  | SignatureError;
