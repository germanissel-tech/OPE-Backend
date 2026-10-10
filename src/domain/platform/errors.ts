// Business errors of the platform module (ADR-023, ADR-047): the rules of the values that govern how OPE
// reads a merchant's platform. They are configuration, never a request: the configuration reports each one
// at the field that fed it.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "platform" as const;

/** A pull cadence that is not a positive integer (constitution XI). */
export class InvalidSyncCadence extends DomainError {
  readonly code = "invalid-sync-cadence" as const;
  readonly module = MODULE;
  /** The field that offends. */
  readonly path: string;
  constructor(path: string) {
    super("Every pull cadence and the batch size must be positive integers.", { path });
    this.path = path;
  }
}

/** A notice retry that is not a positive integer. */
export class InvalidNoticeRetry extends DomainError {
  readonly code = "invalid-notice-retry" as const;
  readonly module = MODULE;
  /** The field that offends. */
  readonly path: string;
  constructor(path: string) {
    super("The wait between notice retries and the attempts must be positive integers.", { path });
    this.path = path;
  }
}

/** A confirmed order state that is blank or repeated. */
export class InvalidOrderConfirmation extends DomainError {
  readonly code = "invalid-order-confirmation" as const;
  readonly module = MODULE;
  /** The field that offends. */
  readonly path: string;
  constructor(path: string, problem: string) {
    super(`A confirmed order state ${problem}.`, { path });
    this.path = path;
  }
}

export type PlatformPolicyError = InvalidSyncCadence | InvalidNoticeRetry | InvalidOrderConfirmation;
