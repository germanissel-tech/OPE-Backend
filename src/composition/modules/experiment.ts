// experiment module: which experiment is active for a merchant and where assignments are
// recorded (ADR-022). Serves no operation of its own: the ingestion module asks it for the arm.
// Experiments come from configuration (the store arrives with feature 008); the assignment
// ledger is the module's own record (ASSIGNED, 01 §5).
import {
  makeAssignVisitor,
  type AssignmentLedger,
  type AssignVisitor,
  type ExperimentDirectory,
} from "../../application/experiment/index.js";
import { configExperimentDirectory } from "../../interface-adapters/gateways/experiment/config-experiment-directory.js";
import { memoryAssignmentLedger } from "../../interface-adapters/gateways/experiment/memory-assignment-ledger.js";
import type { Clock, Logger } from "../../application/shared-kernel/index.js";
import type { MerchantConfig } from "../config.js";
import type { Bindings, Module } from "../wiring.js";

export interface ExperimentPorts {
  clock: Clock;
  logger: Logger;
  experiments: ExperimentDirectory;
  assignments: AssignmentLedger;
}

export const configExperimentPorts = (
  merchants: readonly MerchantConfig[],
): Bindings<Pick<ExperimentPorts, "experiments">> => ({
  experiments: () => configExperimentDirectory(merchants),
});

export const memoryAssignmentPorts: Bindings<Pick<ExperimentPorts, "assignments">> = {
  assignments: memoryAssignmentLedger,
};

/** The use case the ingestion module needs; built here so the wiring of the arm lives with its module. */
export const assignVisitorOf = (ports: ExperimentPorts): AssignVisitor => makeAssignVisitor(ports);

export const experimentModule: Module<ExperimentPorts> = () => ({});
