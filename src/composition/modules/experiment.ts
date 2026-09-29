// experiment module (ADR-022, ADR-031; 03 §4.10): the experiments of every merchant — their store,
// the directory the assignment reads from the same instance (an experiment opened, activated or
// closed by the administration counts on the next batch), where assignments are recorded, and the
// administration of experiments. It exposes the assignment the decision plane asks for; the
// holdout its split is judged against is what the configuration resolves for the merchant.
import {
  ActivateExperimentUseCase,
  CloseExperimentUseCase,
  CreateExperimentUseCase,
  Assignments,
  ScopedExperiments,
  ImportExperimentsUseCase,
  ListExperimentsUseCase,
  type AssignmentLedger,
  type AssignmentService,
  type ExperimentDirectory,
  type ExperimentIdMinter,
  type ScopedExperimentService,
  type ExperimentStore,
  type HoldoutSource,
  type ImportExperimentsRequest,
  type ImportExperimentsResponse,
} from "../../application/experiment/index.js";
import {
  makeActivateExperiment,
  makeCloseExperiment,
  makeCreateExperiment,
  makeListExperiments,
  memoryAssignmentLedger,
  memoryExperimentStore,
  nodeExperimentIdMinter,
  sqliteAssignmentLedger,
  sqliteExperimentStore,
} from "../../interface-adapters/experiment/index.js";
import { bind, bindAll, compositionModule, served, port } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { ScopedMerchantPort } from "./merchant.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";
import type { Experiment } from "../../domain/experiment/index.js";
import type { AuditResult, DomainError, Result } from "../../domain/shared-kernel/index.js";

export const ExperimentStorePort = port("experiment.store")<ExperimentStore>();
/** The directory the assignment reads: the very instance of the store. */
export const ExperimentDirectoryPort = port("experiment.directory")<ExperimentDirectory>();
const ExperimentIdsPort = port("experiment.ids")<ExperimentIdMinter>();
export const AssignmentLedgerPort = port("experiment.assignments")<AssignmentLedger>();
/** What the merchant keeps out of OPE (level 2, overridden by the merchant): the configuration binds it. */
export const HoldoutPort = port("experiment.holdout")<HoldoutSource>();
/** How the administration of one experiment finds it within the scope of its operator. */
const ScopedExperimentPort = port("experiment.scoped")<ScopedExperimentService>();
/** What the decision plane asks for: the arm of a visitor. */
export const AssignmentPort = port("experiment.assignment")<AssignmentService>();
/** The experiments of the seed enter an empty store through the same use case as the API. */
export const ImportExperimentsPort =
  port("experiment.import")<UseCase<ImportExperimentsRequest, ImportExperimentsResponse>>();

/** What the administration of an experiment writes in the audit entry. */
const experimentId = <E extends DomainError>(r: Result<Experiment, E>): AuditResult | undefined =>
  r.ok ? { experimentId: r.value.experimentId } : undefined;

export const experimentModule = compositionModule({
  provides: {
    // **The two halves are durable now** (feature 033). Until then the assignments were and the
    // definition was not, which is not two independent gaps: a restart left assignments naming an
    // experiment that no longer existed, and it did not show on the seeded merchants because the
    // file brings the same identifiers back. One created through the API had nothing to come back.
    memory: [
      // One instance, two views: what the administration writes and what the assignment reads.
      bindAll([ExperimentStorePort, ExperimentDirectoryPort], {}, () => memoryExperimentStore()),
      bind(ExperimentIdsPort, {}, () => nodeExperimentIdMinter),
      bind(AssignmentLedgerPort, {}, () => memoryAssignmentLedger()),
    ],
    sqlite: [
      // The same two views over the store, answering from an in-memory index the composition hands
      // it — a gateway does not import another gateway (ADR-013). Why this one has an index and the
      // configuration does not is in the gateway: `activeFor` is asked on every decision.
      bindAll(
        [ExperimentStorePort, ExperimentDirectoryPort],
        { store: SqlStorePort, logger: LoggerPort },
        ({ store, logger }) => sqliteExperimentStore({ store, logger, index: memoryExperimentStore() }),
      ),
      bind(ExperimentIdsPort, {}, () => nodeExperimentIdMinter),
      bind(AssignmentLedgerPort, { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteAssignmentLedger(deps),
      ),
    ],
  },
  assembles: [
    bind(
      ScopedExperimentPort,
      { scoped: ScopedMerchantPort, experiments: ExperimentStorePort },
      (deps) => new ScopedExperiments(deps),
    ),
    bind(
      AssignmentPort,
      {
        experiments: ExperimentDirectoryPort,
        assignments: AssignmentLedgerPort,
        clock: ClockPort,
        logger: LoggerPort,
      },
      (deps) => new Assignments(deps),
    ),
    bind(
      ImportExperimentsPort,
      { audit: AuditPort, experiments: ExperimentStorePort },
      ({ audit, ...deps }) => audit("importExperiments", new ImportExperimentsUseCase(deps)),
    ),
  ],
  serves: {
    handlers: {
      createExperiment: served(
        {
          scoped: ScopedMerchantPort,
          experiments: ExperimentStorePort,
          holdout: HoldoutPort,
          minter: ExperimentIdsPort,
          clock: ClockPort,
        },
        { name: "createExperiment", build: (deps) => new CreateExperimentUseCase(deps) },
        (useCase) => makeCreateExperiment(useCase),
        { result: experimentId },
      ),
      listExperiments: served(
        { scoped: ScopedMerchantPort, experiments: ExperimentStorePort },
        { name: "listExperiments", build: (deps) => new ListExperimentsUseCase(deps) },
        (useCase) => makeListExperiments(useCase),
      ),
      activateExperiment: served(
        {
          scoped: ScopedExperimentPort,
          experiments: ExperimentStorePort,
          clock: ClockPort,
        },
        { name: "activateExperiment", build: (deps) => new ActivateExperimentUseCase(deps) },
        (useCase) => makeActivateExperiment(useCase),
        { result: experimentId },
      ),
      closeExperiment: served(
        {
          scoped: ScopedExperimentPort,
          experiments: ExperimentStorePort,
          clock: ClockPort,
        },
        { name: "closeExperiment", build: (deps) => new CloseExperimentUseCase(deps) },
        (useCase) => makeCloseExperiment(useCase),
        { result: experimentId },
      ),
    },
  },
});
