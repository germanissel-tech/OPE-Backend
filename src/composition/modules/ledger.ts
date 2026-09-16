// ledger module: decisions and their exposures.
import {
  makeConfirmExposure,
  type DecisionLedger,
  type ExposureLedger,
} from "../../application/ledger/index.js";
import { makeConfirmExposureHandler } from "../../interface-adapters/http/controllers/ledger/confirm-exposure.js";
import type { Module } from "../wiring.js";

export interface LedgerPorts {
  decisions: DecisionLedger;
  exposures: ExposureLedger;
}

export const ledgerModule: Module<LedgerPorts> = ({ ports }) => {
  const confirmExposure = makeConfirmExposure({
    decisionLedger: ports.decisions,
    exposureLedger: ports.exposures,
  });
  return { handlers: { confirmExposure: makeConfirmExposureHandler(confirmExposure) } };
};
