// Service status: the smallest possible domain value, with no dependency and no rule at all
// (ADR-024: a value without rules stays a type; the use case builds it).
// `degraded` is reserved for when external dependencies exist whose outage does not prevent
// responding (constitution II: the system degrades, it does not promise).
export type ServiceStatus = "ok" | "degraded";

export interface ServiceHealth {
  status: ServiceStatus;
  contractVersion: string;
  timestamp: Date;
}
