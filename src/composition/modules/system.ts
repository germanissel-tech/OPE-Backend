// system module: service health.
import { GetServiceHealthUseCase } from "../../application/system/index.js";
import { makeGetHealth } from "../../interface-adapters/http/controllers/system/get-health.js";
import type { Clock } from "../../application/shared-kernel/index.js";
import type { Module } from "../wiring.js";

export interface SystemPorts {
  clock: Clock;
}

export const systemModule: Module<SystemPorts> = ({ ports, contract }) => {
  const getServiceHealth = new GetServiceHealthUseCase({
    contract: { version: contract.info.version },
    clock: ports.clock,
  });
  return { handlers: { getHealth: makeGetHealth(getServiceHealth) } };
};
