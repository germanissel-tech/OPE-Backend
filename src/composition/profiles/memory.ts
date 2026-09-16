// Perfil en memoria: pruebas, mock y las features hasta que llegue la persistencia real (006).
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { memoryDecisionLedger } from "../../interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../interface-adapters/gateways/ledger/memory-exposure-ledger.js";
import { configMerchantDirectory } from "../../interface-adapters/gateways/merchant/config-merchant-directory.js";
import { randomIds } from "../../interface-adapters/gateways/shared-kernel/random-ids.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import type { AppConfig } from "../config.js";
import type { Ports } from "../ports.js";

export function memoryPorts(config: AppConfig, clock = systemClock): Ports {
  return {
    clock,
    ids: randomIds,
    merchants: configMerchantDirectory(config.merchants),
    eventDedup: memoryEventDedup(clock),
    decisions: memoryDecisionLedger(),
    exposures: memoryExposureLedger(),
  };
}
