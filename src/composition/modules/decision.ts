// decision module (01-arquitectura-mvp.md §4; ADR-026, ADR-027): the decision plane. What it
// needs (`DecisionPorts`: the arm from the experiment module, the truth from the catalogue, the
// inference from the barrier module, the ledger, and its own policies, session and visitor
// state), how configuration and memory serve its own ports, and what it serves: the plane the
// ingestion module asks for a decision (`decisionPlaneOf`). Selection, the quality gate and the
// commercial policy are pure domain the plane invokes; they bind nothing. No operation of its own.
import {
  DecisionService,
  DefaultStateService,
  type PolicyDirectory,
  type SessionStateStore,
  type VisitorStateStore,
  type VisitorWindow,
} from "../../application/decision/index.js";
import { DefaultDecisionRecorder } from "../../application/ledger/index.js";
import { memorySessionStateStore } from "../../interface-adapters/gateways/decision/memory-session-state-store.js";
import { memoryVisitorStateStore } from "../../interface-adapters/gateways/decision/memory-visitor-state-store.js";
import { switchAwarePolicyDirectory } from "../../interface-adapters/gateways/decision/switch-aware-policy-directory.js";
import { productTruthOf, type CatalogPorts } from "./catalog.js";
import { policySourceOf } from "./configuration.js";
import { assignmentServiceOf, type ExperimentPorts } from "./experiment.js";
import type { ConfigurationService } from "../../application/configuration/index.js";
import type { DecisionPlane } from "../../application/ingestion/index.js";
import type { MerchantStore } from "../../application/merchant/index.js";
import type { Clock } from "../../application/shared-kernel/index.js";
import type { PlatformConfiguration } from "../../domain/configuration/index.js";
import type { Bindings, Module } from "../wiring.js";
import type { BarrierPorts } from "./barrier.js";
import type { LedgerPorts } from "./ledger.js";

export interface DecisionPorts
  extends ExperimentPorts, CatalogPorts, BarrierPorts, Pick<LedgerPorts, "decisions" | "decisionIds"> {
  policies: PolicyDirectory;
  sessions: SessionStateStore;
  visitors: VisitorStateStore;
  /** The visitor window of the platform (level 1 of the configuration). */
  visitorWindow: VisitorWindow;
}

/** The policies each merchant resolves to (configuration module), with its kill switch read from the store. */
export const configuredDecisionPorts = (
  configuration: () => ConfigurationService,
  store: () => Pick<MerchantStore, "get">,
): Bindings<Pick<DecisionPorts, "policies">> => ({
  policies: () => switchAwarePolicyDirectory(policySourceOf(configuration()), store()),
});

/** Session and visitor state in memory, within the windows the platform declares (level 1). */
export const memoryDecisionPorts = (
  clock: Clock,
  platform: PlatformConfiguration,
): Bindings<Pick<DecisionPorts, "sessions" | "visitors" | "visitorWindow">> => {
  const visitorWindow: VisitorWindow = {
    ttlMs: platform.visitorWindowMs,
    maxVisitors: platform.dedupWindow.maxIds,
  };
  return {
    sessions: () =>
      memorySessionStateStore(clock, {
        ttlMs: platform.sessionWindowMs,
        maxSessions: platform.dedupWindow.maxIds,
      }),
    visitors: () => memoryVisitorStateStore(clock, visitorWindow),
    visitorWindow: () => visitorWindow,
  };
};

/** The plane the ingestion module needs; built here so the wiring of the authorities lives with its module. */
export const decisionPlaneOf = (ports: DecisionPorts): DecisionPlane =>
  new DecisionService({
    assignment: assignmentServiceOf(ports),
    policies: ports.policies,
    state: new DefaultStateService({
      sessions: ports.sessions,
      visitors: ports.visitors,
      visitorWindow: ports.visitorWindow,
    }),
    inference: ports.inference,
    truth: productTruthOf(ports),
    recorder: new DefaultDecisionRecorder({
      decisions: ports.decisions,
      decisionIds: ports.decisionIds,
      logger: ports.logger,
    }),
  });

export const decisionModule: Module<DecisionPorts> = () => ({});
