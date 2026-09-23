// experiment module (ADR-022, ADR-031; 03 §4.10): the experiments of every merchant — their store,
// the directory the assignment reads from the same instance (an experiment opened, activated or
// closed by the administration counts on the next batch), where assignments are recorded, and the
// administration of experiments. It exposes the assignment the decision plane asks for; the
// holdout its split is judged against is what the configuration resolves for the merchant.
import {
  ActivateExperimentUseCase,
  CloseExperimentUseCase,
  CreateExperimentUseCase,
  DefaultAssignmentService,
  DefaultExperimentLookupService,
  ImportExperimentsUseCase,
  ListExperimentsUseCase,
  type AssignmentLedger,
  type AssignmentService,
  type ExperimentDirectory,
  type ExperimentIdMinter,
  type ExperimentLookupService,
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
} from "../../interface-adapters/experiment/index.js";
import { bind, bindAll, compositionModule, handler, port } from "../graph/index.js";
import { ScopedMerchantsPort } from "./merchant.js";
import { ClockPort, DecoratorsPort, LoggerPort } from "./shared-kernel.js";
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
const ExperimentLookupPort = port("experiment.lookup")<ExperimentLookupService>();
/** What the decision plane asks for: the arm of a visitor. */
export const AssignmentPort = port("experiment.assignment")<AssignmentService>();
/** The experiments of the seed enter an empty store through the same use case as the API. */
export const ImportExperimentsPort =
  port("experiment.import")<UseCase<ImportExperimentsRequest, ImportExperimentsResponse>>();

/** What the administration of an experiment writes in the audit entry. */
const experimentId = <E extends DomainError>(r: Result<Experiment, E>): AuditResult | undefined =>
  r.ok ? { experimentId: r.value.experimentId } : undefined;

export const experimentModule = compositionModule({
  provides: [
    // One instance, two views: what the administration writes and what the assignment reads.
    bindAll([ExperimentStorePort, ExperimentDirectoryPort], {}, () => memoryExperimentStore()),
    bind(ExperimentIdsPort, {}, () => nodeExperimentIdMinter),
    bind(AssignmentLedgerPort, {}, () => memoryAssignmentLedger()),
  ],
  assembles: [
    bind(
      ExperimentLookupPort,
      { scoped: ScopedMerchantsPort, experiments: ExperimentStorePort },
      (deps) => new DefaultExperimentLookupService(deps),
    ),
    bind(
      AssignmentPort,
      {
        experiments: ExperimentDirectoryPort,
        assignments: AssignmentLedgerPort,
        clock: ClockPort,
        logger: LoggerPort,
      },
      (deps) => new DefaultAssignmentService(deps),
    ),
    bind(
      ImportExperimentsPort,
      { deco: DecoratorsPort, experiments: ExperimentStorePort },
      ({ deco, ...deps }) => deco.audited("importExperiments", new ImportExperimentsUseCase(deps)),
    ),
  ],
  serves: {
    handlers: {
      createExperiment: handler(
        {
          deco: DecoratorsPort,
          scoped: ScopedMerchantsPort,
          experiments: ExperimentStorePort,
          holdout: HoldoutPort,
          minter: ExperimentIdsPort,
          clock: ClockPort,
        },
        (operation, { deco, ...deps }) =>
          makeCreateExperiment(
            deco.administered(operation, new CreateExperimentUseCase(deps), { result: experimentId }),
          ),
      ),
      listExperiments: handler(
        { deco: DecoratorsPort, scoped: ScopedMerchantsPort, experiments: ExperimentStorePort },
        (operation, { deco, ...deps }) =>
          makeListExperiments(deco.logged(operation, new ListExperimentsUseCase(deps))),
      ),
      activateExperiment: handler(
        {
          deco: DecoratorsPort,
          lookup: ExperimentLookupPort,
          experiments: ExperimentStorePort,
          clock: ClockPort,
        },
        (operation, { deco, ...deps }) =>
          makeActivateExperiment(
            deco.administered(operation, new ActivateExperimentUseCase(deps), { result: experimentId }),
          ),
      ),
      closeExperiment: handler(
        {
          deco: DecoratorsPort,
          lookup: ExperimentLookupPort,
          experiments: ExperimentStorePort,
          clock: ClockPort,
        },
        (operation, { deco, ...deps }) =>
          makeCloseExperiment(
            deco.administered(operation, new CloseExperimentUseCase(deps), { result: experimentId }),
          ),
      ),
    },
  },
});
