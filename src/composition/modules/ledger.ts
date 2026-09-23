// ledger module: decisions and their exposures. What it needs, how each technology serves it
// (memory today; Postgres is one more table and one line of the deployment) and what it serves.
// It also exposes the recorder of decisions —the ledger mints the identifier and degrades to
// `ledger-unavailable`— so the decision plane receives it built instead of its ingredients.
import {
  ConfirmExposureUseCase,
  DefaultDecisionRecorder,
  type DecisionIdGenerator,
  type DecisionLedger,
  type DecisionRecorder,
  type ExposureLedger,
} from "../../application/ledger/index.js";
import {
  makeConfirmExposureHandler,
  memoryDecisionLedger,
  memoryExposureLedger,
  randomDecisionIds,
} from "../../interface-adapters/ledger/index.js";
import { bind, compositionModule, handler, port } from "../graph/index.js";
import { DecoratorsPort, LoggerPort } from "./shared-kernel.js";

export const DecisionLedgerPort = port("ledger.decisions")<DecisionLedger>();
export const ExposureLedgerPort = port("ledger.exposures")<ExposureLedger>();
/** Who mints decision identifiers: the ledger's, which the recorder uses. */
export const DecisionIdsPort = port("ledger.decision-ids")<DecisionIdGenerator>();
/** What the decision plane records with; built here so the wiring of the ledger lives with it. */
export const DecisionRecorderPort = port("ledger.recorder")<DecisionRecorder>();

export const ledgerModule = compositionModule({
  provides: {
    memory: [
      bind(DecisionLedgerPort, {}, () => memoryDecisionLedger()),
      bind(ExposureLedgerPort, {}, () => memoryExposureLedger()),
      bind(DecisionIdsPort, {}, () => randomDecisionIds),
    ],
  },
  exposes: [
    bind(
      DecisionRecorderPort,
      { decisions: DecisionLedgerPort, decisionIds: DecisionIdsPort, logger: LoggerPort },
      (deps) => new DefaultDecisionRecorder(deps),
    ),
  ],
  serves: {
    handlers: {
      confirmExposure: handler(
        { deco: DecoratorsPort, decisions: DecisionLedgerPort, exposures: ExposureLedgerPort },
        (operation, { deco, ...deps }) =>
          makeConfirmExposureHandler(deco.logged(operation, new ConfirmExposureUseCase(deps))),
      ),
    },
  },
});
