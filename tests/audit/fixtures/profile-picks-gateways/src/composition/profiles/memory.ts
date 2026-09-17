// Eval fixture: "the in-memory environment" — one profile that knows the gateways of every
// module and will be replaced by a "postgres environment" when it arrives (the pre-ADR-018
// profile, condensed). A mixed deployment cannot be expressed without a second copy or an if.
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { memoryDecisionLedger } from "../../interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../interface-adapters/gateways/ledger/memory-exposure-ledger.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";

interface Ports {
  clock: { now(): Date };
  eventDedup: unknown;
  decisions: unknown;
  exposures: unknown;
}

export function memoryProfile(overrides: Partial<Ports>): Ports {
  const clock = overrides.clock ?? systemClock;
  return {
    clock,
    eventDedup: overrides.eventDedup ?? memoryEventDedup(clock),
    decisions: overrides.decisions ?? memoryDecisionLedger(),
    exposures: overrides.exposures ?? memoryExposureLedger(),
  };
}
