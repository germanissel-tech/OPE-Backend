// system module: service health.
import { makeGetServiceHealth } from "../../application/system/index.js";
import { makeGetHealth } from "../../interface-adapters/http/controllers/system/get-health.js";
import type { Clock } from "../../application/shared-kernel/index.js";
import type { Module } from "../wiring.js";

export interface SystemPorts {
  clock: Clock;
}

export const systemModule: Module<SystemPorts> = ({ ports, contractVersion }) => {
  const getServiceHealth = makeGetServiceHealth({ contractVersion, clock: ports.clock });
  return { handlers: { getHealth: makeGetHealth(getServiceHealth) } };
};
