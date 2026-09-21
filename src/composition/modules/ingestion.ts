// ingestion module: the event batch. It needs the kernel, its own dedup and the decision plane
// (decision module); it owns (binds) only the dedup, which shares the profile's clock.
import { IngestBatchUseCase, type EventDedup } from "../../application/ingestion/index.js";
import {
  LoggedUseCase,
  type Clock,
  type ClockTolerance,
  type Logger,
} from "../../application/shared-kernel/index.js";
import { memoryEventDedup, makeIngestEvents } from "../../interface-adapters/ingestion/index.js";
import { decisionPlaneOf, type DecisionPorts } from "./decision.js";
import type { PlatformConfiguration } from "../../domain/configuration/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface IngestionPorts extends DecisionPorts {
  clock: Clock;
  logger: Logger;
  tolerance: ClockTolerance;
  eventDedup: EventDedup;
}

/** Dedup in memory, within the window the platform declares (level 1 of the configuration). */
export const memoryIngestionPorts = (
  clock: Clock,
  platform: PlatformConfiguration,
): Bindings<Pick<IngestionPorts, "eventDedup">> => ({
  eventDedup: () => memoryEventDedup(clock, platform.dedupWindow),
});

export const ingestionModule: Module<IngestionPorts> = ({ ports }) => {
  const { clock, tolerance, logger, eventDedup } = ports;
  const ingestBatch = new IngestBatchUseCase({
    clock,
    tolerance,
    eventDedup,
    decisionPlane: decisionPlaneOf(ports),
  });
  const logged = new LoggedUseCase("ingestBatch", ingestBatch, { clock, logger });
  return { handlers: { ingestEvents: makeIngestEvents(logged) } };
};
