// experiment module (ADR-022, ADR-031; 03 §4.10): the experiments of every merchant — their store,
// the directory the assignment reads from the same instance (an experiment opened, activated or
// closed by the administration counts on the next batch), where assignments are recorded, and
// the administration of experiments. The ingestion module asks it for the arm; the holdout it
// judges the split against is what the configuration resolves for the merchant.
import { AuditedUseCase, type AdminLog } from "../../application/admin/index.js";
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
  type ExperimentStore,
  type HoldoutSource,
  type ImportExperimentsRequest,
  type ImportExperimentsResponse,
} from "../../application/experiment/index.js";
import { DefaultScopedMerchantService, type MerchantStore } from "../../application/merchant/index.js";
import { memoryAssignmentLedger } from "../../interface-adapters/gateways/experiment/memory-assignment-ledger.js";
import { memoryExperimentStore } from "../../interface-adapters/gateways/experiment/memory-experiment-store.js";
import { nodeExperimentIdMinter } from "../../interface-adapters/gateways/experiment/node-experiment-id-minter.js";
import { makeActivateExperiment } from "../../interface-adapters/http/controllers/experiment/activate-experiment.js";
import { makeCloseExperiment } from "../../interface-adapters/http/controllers/experiment/close-experiment.js";
import { makeCreateExperiment } from "../../interface-adapters/http/controllers/experiment/create-experiment.js";
import { makeListExperiments } from "../../interface-adapters/http/controllers/experiment/list-experiments.js";
import { auditedWiring } from "./audited.js";
import type { ConfigurationService } from "../../application/configuration/index.js";
import type { Clock, Logger, UseCase } from "../../application/shared-kernel/index.js";
import type { AdminResult } from "../../domain/admin/index.js";
import type { Experiment } from "../../domain/experiment/index.js";
import type { DomainError, Result } from "../../domain/shared-kernel/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface ExperimentPorts {
  clock: Clock;
  logger: Logger;
  /** The directory the assignment reads: served by the same instance as the store. */
  experiments: ExperimentDirectory;
  experimentStore: ExperimentStore;
  experimentIds: ExperimentIdMinter;
  /** What the merchant keeps out of OPE (level 2 of the configuration, overridden by the merchant). */
  holdout: HoldoutSource;
  assignments: AssignmentLedger;
  merchantStore: MerchantStore;
  adminLog: AdminLog;
}

/** The experiments in memory (one instance behind both ports), identifiers with the crypto of Node, assignments in memory. */
export const memoryExperimentPorts = (): Bindings<
  Pick<ExperimentPorts, "experiments" | "experimentStore" | "experimentIds" | "assignments">
> => {
  let store: ReturnType<typeof memoryExperimentStore> | undefined;
  const shared = (): ReturnType<typeof memoryExperimentStore> => (store ??= memoryExperimentStore());
  return {
    experiments: shared,
    experimentStore: shared,
    experimentIds: () => nodeExperimentIdMinter,
    assignments: memoryAssignmentLedger,
  };
};

/** The holdout of each merchant as its effective configuration resolves it. */
export const configuredExperimentPorts = (
  configuration: () => ConfigurationService,
): Bindings<Pick<ExperimentPorts, "holdout">> => ({
  holdout: () => ({
    holdoutShareFor: async (merchantId) =>
      (await configuration().effectiveFor(merchantId)).values.holdoutShare,
  }),
});

/** The service the ingestion module needs; built here so the wiring of the arm lives with its module. */
export const assignmentServiceOf = (ports: ExperimentPorts): AssignmentService =>
  new DefaultAssignmentService(ports);

/** The experiments the seed declares enter an empty store through the same use case as the API, audited as the system (ADR-031). */
export const importExperimentsOf = (
  ports: ExperimentPorts,
): UseCase<ImportExperimentsRequest, ImportExperimentsResponse> =>
  new AuditedUseCase(
    "importExperiments",
    new ImportExperimentsUseCase({ experiments: ports.experimentStore }),
    { log: ports.adminLog, clock: ports.clock },
  );

export const experimentModule: Module<ExperimentPorts> = ({ ports }) => {
  const { clock, experimentStore: experiments, experimentIds: minter, holdout } = ports;
  const { logged, admin } = auditedWiring(ports);
  const scoped = new DefaultScopedMerchantService({ merchants: ports.merchantStore });
  const lookup = new DefaultExperimentLookupService({ scoped, experiments });
  const experimentId = <E extends DomainError>(r: Result<Experiment, E>): AdminResult | undefined =>
    r.ok ? { experimentId: r.value.experimentId } : undefined;
  return {
    handlers: {
      createExperiment: makeCreateExperiment(
        admin(
          "createExperiment",
          new CreateExperimentUseCase({ scoped, experiments, holdout, minter, clock }),
          { result: experimentId },
        ),
      ),
      listExperiments: makeListExperiments(
        logged("listExperiments", new ListExperimentsUseCase({ scoped, experiments })),
      ),
      activateExperiment: makeActivateExperiment(
        admin("activateExperiment", new ActivateExperimentUseCase({ lookup, experiments, clock }), {
          result: experimentId,
        }),
      ),
      closeExperiment: makeCloseExperiment(
        admin("closeExperiment", new CloseExperimentUseCase({ lookup, experiments, clock }), {
          result: experimentId,
        }),
      ),
    },
  };
};
