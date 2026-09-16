// Caso de uso: estado del servicio. Envuelve el valor de dominio con el reloj inyectado.
import { serviceHealth, type ServiceHealth } from "../../domain/system/index.js";
import type { Clock } from "../shared-kernel/index.js";

export interface GetServiceHealthDeps {
  contractVersion: string;
  clock: Clock;
}

export type GetServiceHealth = () => ServiceHealth;

export function makeGetServiceHealth({ contractVersion, clock }: GetServiceHealthDeps): GetServiceHealth {
  return () => serviceHealth({ now: clock.now(), contractVersion });
}
