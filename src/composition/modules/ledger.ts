// ledger module: decisions and their exposures. What it needs (`LedgerPorts`), how each
// technology serves it (`memoryLedgerPorts`; `postgresLedgerPorts(pool)` when it arrives) and
// what it serves (`ledgerModule`) live together: adding a store touches this file and one line
// of the deployment profile.
import {
  ConfirmExposureUseCase,
  type DecisionIdGenerator,
  type DecisionLedger,
  type ExposureLedger,
} from "../../application/ledger/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import {
  memoryDecisionLedger,
  memoryExposureLedger,
  randomDecisionIds,
  makeConfirmExposureHandler,
} from "../../interface-adapters/ledger/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface LedgerPorts {
  clock: Clock;
  logger: Logger;
  decisions: DecisionLedger;
  exposures: ExposureLedger;
  /** Who mints decision identifiers: the ledger's recorder, which the decision module receives (`decisionPlaneOf`). */
  decisionIds: DecisionIdGenerator;
}

export const memoryLedgerPorts: Bindings<Pick<LedgerPorts, "decisions" | "exposures" | "decisionIds">> = {
  decisions: memoryDecisionLedger,
  exposures: memoryExposureLedger,
  decisionIds: () => randomDecisionIds,
};

export const ledgerModule: Module<LedgerPorts> = ({ ports }) => {
  const { clock, logger, decisions, exposures } = ports;
  const confirmExposure = new ConfirmExposureUseCase({ decisions, exposures });
  const logged = new LoggedUseCase("confirmExposure", confirmExposure, { clock, logger });
  return { handlers: { confirmExposure: makeConfirmExposureHandler(logged) } };
};
