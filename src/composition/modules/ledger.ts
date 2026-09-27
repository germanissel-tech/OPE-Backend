// ledger module: decisions and their exposures. What it needs, how each technology serves it and
// what it serves. It also exposes the recorder of decisions —the ledger mints the identifier and
// degrades to `ledger-unavailable`— so the decision plane receives it built instead of its
// ingredients.
//
// Two technologies since feature 030: `memory`, which never prunes and never survives, and
// `sqlite`, which does both. A deployment says which; omitting the choice does not compile.
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
  sqliteDecisionLedger,
  sqliteExposureLedger,
} from "../../interface-adapters/ledger/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { LoggerPort } from "./shared-kernel.js";

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
    sqlite: [
      bind(DecisionLedgerPort, { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteDecisionLedger(deps),
      ),
      bind(ExposureLedgerPort, { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteExposureLedger(deps),
      ),
      // Minting an identifier is not storage: the same generator serves both technologies.
      bind(DecisionIdsPort, {}, () => randomDecisionIds),
    ],
  },
  assembles: [
    bind(
      DecisionRecorderPort,
      { decisions: DecisionLedgerPort, decisionIds: DecisionIdsPort, logger: LoggerPort },
      (deps) => new DefaultDecisionRecorder(deps),
    ),
  ],
  serves: {
    handlers: {
      confirmExposure: served(
        { decisions: DecisionLedgerPort, exposures: ExposureLedgerPort },
        { name: "confirmExposure", build: (deps) => new ConfirmExposureUseCase(deps) },
        (useCase) => makeConfirmExposureHandler(useCase),
      ),
    },
  },
});
