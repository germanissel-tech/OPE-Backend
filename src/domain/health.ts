// Estado del servicio: el valor de dominio más chico posible, sin ninguna dependencia.
// `degraded` queda reservado para cuando existan dependencias externas cuya caída no impida
// responder (constitución II: el sistema degrada, no promete).
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
