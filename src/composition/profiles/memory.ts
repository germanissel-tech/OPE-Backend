// In-memory profile: tests, mock and the features until real persistence arrives (006).
// Overrides are resolved here, per port, because only the profile knows which gateways depend
// on which (dedup shares the clock); the composition root never has to.
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { memoryDecisionLedger } from "../../interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../interface-adapters/gateways/ledger/memory-exposure-ledger.js";
import { configMerchantDirectory } from "../../interface-adapters/gateways/merchant/config-merchant-directory.js";
import { randomIds } from "../../interface-adapters/gateways/shared-kernel/random-ids.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import { tracker, type Profile } from "../profile.js";

export const memoryProfile: Profile = (config, overrides) => {
  const { own, closables } = tracker();
  const clock = own(overrides.clock ?? systemClock);
  const ports = {
    clock,
    ids: own(overrides.ids ?? randomIds),
    merchants: own(overrides.merchants ?? configMerchantDirectory(config.merchants)),
    eventDedup: own(overrides.eventDedup ?? memoryEventDedup(clock)),
    decisions: own(overrides.decisions ?? memoryDecisionLedger()),
    exposures: own(overrides.exposures ?? memoryExposureLedger()),
  };
  return { ports, closables };
};
