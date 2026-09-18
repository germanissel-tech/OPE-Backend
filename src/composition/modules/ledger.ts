// ledger module: decisions and their exposures. What it needs (`LedgerPorts`), how each
// technology serves it (`memoryLedgerPorts`; `postgresLedgerPorts(pool)` when it arrives) and
// what it serves (`ledgerModule`) live together: adding a store touches this file and one line
// of the deployment profile.
import {
  ConfirmExposureUseCase,
  type DecisionLedger,
  type ExposureLedger,
} from "../../application/ledger/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../interface-adapters/gateways/ledger/memory-exposure-ledger.js";
import { makeConfirmExposureHandler } from "../../interface-adapters/http/controllers/ledger/confirm-exposure.js";
import type { Bindings, Module } from "../wiring.js";

export interface LedgerPorts {
  clock: Clock;
  logger: Logger;
  decisions: DecisionLedger;
  exposures: ExposureLedger;
}

export const memoryLedgerPorts: Bindings<Pick<LedgerPorts, "decisions" | "exposures">> = {
  decisions: memoryDecisionLedger,
  exposures: memoryExposureLedger,
};

export const ledgerModule: Module<LedgerPorts> = ({ ports }) => {
  const { clock, logger, decisions, exposures } = ports;
  const confirmExposure = new ConfirmExposureUseCase({ decisions, exposures });
  const logged = new LoggedUseCase("confirmExposure", confirmExposure, { clock, logger });
  return { handlers: { confirmExposure: makeConfirmExposureHandler(logged) } };
};
