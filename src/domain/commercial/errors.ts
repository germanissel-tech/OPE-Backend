// Business errors of the commercial module (ADR-023, ADR-027): a commercial policy that does
// not hold its invariants. They never travel over HTTP: a rejected policy stops the server
// naming the field (ADR-024). Codes are the Problem Details slugs of the catalogue.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "commercial" as const;

export class InvalidCommercialVersion extends DomainError {
  readonly code = "invalid-commercial-version" as const;
  readonly module = MODULE;
  constructor() {
    super("The commercial policy version must be a non-empty string.", { path: "version" });
  }
}

export class InvalidIncentiveCeiling extends DomainError {
  readonly code = "invalid-incentive-ceiling" as const;
  readonly module = MODULE;
  constructor() {
    super("The incentive ceiling must be an integer percentage between 0 and 100.", {
      path: "maxIncentivePercent",
    });
  }
}

/** A step of the ladder out of 1..ceiling, or not above the previous one. */
export class InvalidIncentiveLadder extends DomainError {
  readonly code = "invalid-incentive-ladder" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("The incentive ladder must be strictly increasing integers between 1 and the ceiling.", {
      path: "incentiveLadderPercent",
      index,
    });
  }
}

export class InvalidMargin extends DomainError {
  readonly code = "invalid-margin" as const;
  readonly module = MODULE;
  constructor() {
    super("The margin must be a percentage between 0 and 100.", { path: "marginPercent" });
  }
}

/** The return-risk condition names a fact outside the vocabulary (`path` locates it). */
export class InvalidReturnRisk extends DomainError {
  readonly code = "invalid-return-risk" as const;
  readonly module = MODULE;
  constructor(path: string, why: string) {
    super(why, { path });
  }
}

export class InvalidInterventionBudget extends DomainError {
  readonly code = "invalid-intervention-budget" as const;
  readonly module = MODULE;
  constructor(field: "interventionsPerSession" | "interventionsPerVisitorPerDay") {
    super(`${field} must be an integer of at least 1.`, { path: field });
  }
}

export class InvalidCooldown extends DomainError {
  readonly code = "invalid-cooldown" as const;
  readonly module = MODULE;
  constructor() {
    super("The cooldown must be a non-negative number of seconds.", { path: "cooldownSeconds" });
  }
}

export type CommercialError =
  | InvalidCommercialVersion
  | InvalidIncentiveCeiling
  | InvalidIncentiveLadder
  | InvalidMargin
  | InvalidReturnRisk
  | InvalidInterventionBudget
  | InvalidCooldown;
