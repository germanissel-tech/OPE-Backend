// decision module (01-arquitectura-mvp.md §4; ADR-026): the decision plane. What it needs
// (`DecisionPorts`: the arm from the experiment module, the truth from the catalogue, the
// inference from the barrier module, the ledger, and its own policies and session state), how
// configuration and memory serve its own ports, and what it serves: the plane the ingestion
// module asks for a decision (`decisionPlaneOf`). No operation of its own.
import {
  DecisionService,
  SESSION_WINDOW,
  type DecisionPolicyDirectory,
  type SessionStateStore,
} from "../../application/decision/index.js";
import { DefaultDecisionRecorder } from "../../application/ledger/index.js";
import { configDecisionPolicyDirectory } from "../../interface-adapters/gateways/decision/config-decision-policy-directory.js";
import { memorySessionStateStore } from "../../interface-adapters/gateways/decision/memory-session-state-store.js";
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
  policies: DecisionPolicyDirectory;
  sessions: SessionStateStore;
}

export const configDecisionPorts = (
  merchants: readonly MerchantConfig[],
): Bindings<Pick<DecisionPorts, "policies">> => ({
  policies: () =>
    configDecisionPolicyDirectory(
      merchants.map((m) =>
        m.decisionPolicy === undefined
          ? { merchantId: m.merchant.merchantId }
          : { merchantId: m.merchant.merchantId, policy: m.decisionPolicy },
      ),
    ),
});

export const memoryDecisionPorts = (clock: Clock): Bindings<Pick<DecisionPorts, "sessions">> => ({
  sessions: () => memorySessionStateStore(clock, SESSION_WINDOW),
});

/** The plane the ingestion module needs; built here so the wiring of the authorities lives with its module. */
export const decisionPlaneOf = (ports: DecisionPorts): DecisionPlane =>
  new DecisionService({
    assignment: assignmentServiceOf(ports),
    policies: ports.policies,
    sessions: ports.sessions,
    inference: ports.inference,
    truth: productTruthOf(ports),
    recorder: new DefaultDecisionRecorder({
      decisions: ports.decisions,
      decisionIds: ports.decisionIds,
      logger: ports.logger,
    }),
  });

export const decisionModule: Module<DecisionPorts> = () => ({});
