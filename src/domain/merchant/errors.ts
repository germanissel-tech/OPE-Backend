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

/** The ingest keys of a merchant: one or two, none empty (`details.index` names an empty one). */
export class InvalidIngestKeys extends DomainError {
  readonly code = "invalid-ingest-keys" as const;
  readonly module = MODULE;
  constructor(index?: number) {
    super("A merchant needs one or two non-empty ingest keys.", index === undefined ? {} : { index });
  }
}

/** A merchant without any registered origin: nobody could ever speak for it (fail-closed). */
export class InvalidOrigins extends DomainError {
  readonly code = "invalid-origins" as const;
  readonly module = MODULE;
  constructor() {
    super("A merchant needs at least one registered origin.");
  }
}

/** More platform keys than a rotation needs (ADR-025: one, or two while rotating). */
export class InvalidPlatformKeys extends DomainError {
  readonly code = "invalid-platform-keys" as const;
  readonly module = MODULE;
  constructor() {
    super("A merchant has at most two platform keys.");
  }
}

/** More signing secrets than a rotation needs (ADR-029: one, or two while rotating). */
export class InvalidPlatformSecrets extends DomainError {
  readonly code = "invalid-platform-secrets" as const;
  readonly module = MODULE;
  constructor() {
    super("A merchant has at most two platform signing secrets.");
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
  | InvalidIngestKeys
  | InvalidOrigins
  | InvalidOrigin
  | InvalidPlatformKeys
  | PlatformKeyCollision
  | InvalidPlatformSecrets
  | InvalidPlatformSecret
  | MerchantDeactivated
  | MerchantNotFound
  | RotationGraceTooLong
  | OriginAlreadyRegistered
  | SignatureError;

/** The merchant was deactivated: nothing can be done to it (ADR-031). */
export class MerchantDeactivated extends DomainError {
  readonly code = "merchant-deactivated" as const;
  readonly module = MODULE;
  constructor() {
    super("The merchant is deactivated.");
  }
}

/** No merchant with that identifier within the operator's scope. */
export class MerchantNotFound extends DomainError {
  readonly code = "merchant-not-found" as const;
  readonly module = MODULE;
  constructor() {
    super("The merchant does not exist.");
  }
}

/** A rotation grace beyond what the platform allows. */
export class RotationGraceTooLong extends DomainError {
  readonly code = "rotation-grace-too-long" as const;
  readonly module = MODULE;
  constructor(maxGraceMs: number) {
    super("The rotation grace exceeds the platform maximum.", { maxGraceMs });
  }
}

/** An origin that already belongs to another merchant: an origin speaks for one merchant only. */
export class OriginAlreadyRegistered extends DomainError {
  readonly code = "origin-already-registered" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("An origin already belongs to another merchant.", { index });
  }
}
