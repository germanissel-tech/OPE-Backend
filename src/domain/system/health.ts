// Service status: the smallest possible domain value, with no dependency at all.
// `degraded` is reserved for when external dependencies exist whose outage does not prevent
// responding (constitution II: the system degrades, it does not promise).
export type ServiceStatus = "ok" | "degraded";

export interface ServiceHealth {
  status: ServiceStatus;
  contractVersion: string;
  timestamp: Date;
}

export interface ServiceHealthInput {
  now: Date;
  contractVersion: string;
}

export function serviceHealth({ now, contractVersion }: ServiceHealthInput): ServiceHealth {
  return { status: "ok", contractVersion, timestamp: now };
}
