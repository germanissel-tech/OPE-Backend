// Perfil en memoria: pruebas, mock y las features hasta que llegue la persistencia real (006).
import { configMerchantDirectory } from "../../interface-adapters/gateways/merchant/config-merchant-directory.js";
import { randomIds } from "../../interface-adapters/gateways/shared-kernel/random-ids.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import type { AppConfig } from "../config.js";
import type { Ports } from "../ports.js";

export function memoryPorts(config: AppConfig): Ports {
  return {
    clock: systemClock,
    ids: randomIds,
    merchants: configMerchantDirectory(config.merchants),
  };
}
