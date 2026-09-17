// ledger module: decisions and their exposures. What it needs (`LedgerPorts`), how each
// technology serves it (`memoryLedgerPorts`; `postgresLedgerPorts(pool)` when it arrives) and
// what it serves (`ledgerModule`) live together: adding a store touches this file and one line
// of the deployment profile.
import {
  makeConfirmExposure,
  type DecisionLedger,
  type ExposureLedger,
} from "../../application/ledger/index.js";
import { memoryDecisionLedger } from "../../interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../interface-adapters/gateways/ledger/memory-exposure-ledger.js";
import { makeConfirmExposureHandler } from "../../interface-adapters/http/controllers/ledger/confirm-exposure.js";
import type { Bindings, Module } from "../wiring.js";

export interface LedgerPorts {
  decisions: DecisionLedger;
  exposures: ExposureLedger;
}

export const memoryLedgerPorts: Bindings<LedgerPorts> = {
  decisions: memoryDecisionLedger,
  exposures: memoryExposureLedger,
};

export const ledgerModule: Module<LedgerPorts> = ({ ports }) => {
  const confirmExposure = makeConfirmExposure({
    decisionLedger: ports.decisions,
    exposureLedger: ports.exposures,
  });
  return { handlers: { confirmExposure: makeConfirmExposureHandler(confirmExposure) } };
};
