// decision module (01-arquitectura-mvp.md §4; ADR-026, ADR-027): the decision plane. What it
// needs (`DecisionPorts`: the arm from the experiment module, the truth from the catalogue, the
// inference from the barrier module, the ledger, and its own policies, session and visitor
// state), how configuration and memory serve its own ports, and what it serves: the plane the
// ingestion module asks for a decision (`decisionPlaneOf`). Selection, the quality gate and the
// commercial policy are pure domain the plane invokes; they bind nothing. No operation of its own.
import {
  DecisionService,
  DefaultStateService,
  SESSION_WINDOW,
  VISITOR_WINDOW,
  type PolicyDirectory,
  type SessionStateStore,
  type VisitorStateStore,
} from "../../application/decision/index.js";
import { DefaultDecisionRecorder } from "../../application/ledger/index.js";
import { configPolicyDirectory } from "../../interface-adapters/gateways/decision/config-policy-directory.js";
import { memorySessionStateStore } from "../../interface-adapters/gateways/decision/memory-session-state-store.js";
import { memoryVisitorStateStore } from "../../interface-adapters/gateways/decision/memory-visitor-state-store.js";
import { productTruthOf, type CatalogPorts } from "./catalog.js";
import { assignmentServiceOf, type ExperimentPorts } from "./experiment.js";
import type { DecisionPlane } from "../../application/ingestion/index.js";
import type { Clock } from "../../application/shared-kernel/index.js";
import type { MerchantConfig } from "../config.js";
import type { Bindings, Module } from "../wiring.js";
import type { BarrierPorts } from "./barrier.js";
import type { LedgerPorts } from "./ledger.js";

export interface DecisionPorts
  extends ExperimentPorts, CatalogPorts, BarrierPorts, Pick<LedgerPorts, "decisions" | "decisionIds"> {
  policies: PolicyDirectory;
  sessions: SessionStateStore;
  visitors: VisitorStateStore;
}

export const configDecisionPorts = (
  merchants: readonly MerchantConfig[],
): Bindings<Pick<DecisionPorts, "policies">> => ({
  policies: () =>
    configPolicyDirectory(
      merchants.map((m) => ({
        merchantId: m.merchant.merchantId,
        ...(m.decisionPolicy === undefined ? {} : { decision: m.decisionPolicy }),
        ...(m.commercialPolicy === undefined ? {} : { commercial: m.commercialPolicy }),
        ...(m.evidenceProfile === undefined ? {} : { profile: m.evidenceProfile }),
      })),
    ),
});

export const memoryDecisionPorts = (
  clock: Clock,
): Bindings<Pick<DecisionPorts, "sessions" | "visitors">> => ({
  sessions: () => memorySessionStateStore(clock, SESSION_WINDOW),
  visitors: () => memoryVisitorStateStore(clock, VISITOR_WINDOW),
});

/** The plane the ingestion module needs; built here so the wiring of the authorities lives with its module. */
export const decisionPlaneOf = (ports: DecisionPorts): DecisionPlane =>
  new DecisionService({
    assignment: assignmentServiceOf(ports),
    policies: ports.policies,
    state: new DefaultStateService({ sessions: ports.sessions, visitors: ports.visitors }),
    inference: ports.inference,
    truth: productTruthOf(ports),
    recorder: new DefaultDecisionRecorder({
      decisions: ports.decisions,
      decisionIds: ports.decisionIds,
      logger: ports.logger,
    }),
  });

export const decisionModule: Module<DecisionPorts> = () => ({});
