// system module: service health.
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { GetServiceHealthUseCase } from "../../application/system/index.js";
import { makeGetHealth } from "../../interface-adapters/http/controllers/system/get-health.js";
import type { Module } from "../wiring.js";

export interface SystemPorts {
  clock: Clock;
  logger: Logger;
}

export const systemModule: Module<SystemPorts> = ({ ports, contract }) => {
  const getServiceHealth = new GetServiceHealthUseCase({
    contract: { version: contract.info.version },
    clock: ports.clock,
  });
  const logged = new LoggedUseCase("getServiceHealth", getServiceHealth, ports);
  return { handlers: { getHealth: makeGetHealth(logged) } };
};
