// decision module (01-arquitectura-mvp.md §4; ADR-026, ADR-027): the decision plane. It needs the
// authorities already built —the assignment, the inference, the truth of product, the recorder of
// the ledger and the policies of the merchant— and not their ingredients: what each of them is
// made of is the business of its own module. It owns the state of sessions and visitors, and
// serves no operation of its own: what it builds is the plane the ingestion asks for a decision.
import {
  DecisionService,
  DefaultStateService,
  type PolicyDirectory,
  type SessionStateStore,
  type StateService,
  type VisitorStateStore,
  type VisitorWindow,
} from "../../application/decision/index.js";
import {
  memorySessionStateStore,
  memoryVisitorStateStore,
  sessionWindowOf,
  visitorWindowOf,
} from "../../interface-adapters/decision/index.js";
import { bind, compositionModule, port, technology } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";
import { BarrierInferencePort } from "./barrier.js";
import { ProductTruthPort } from "./catalog.js";
import { AssignmentPort } from "./experiment.js";
import { DecisionPlanePort } from "./ingestion.js";
import { DecisionRecorderPort } from "./ledger.js";
import { ClockPort } from "./shared-kernel.js";

export const SessionStatePort = port("decision.sessions")<SessionStateStore>();
export const VisitorStatePort = port("decision.visitors")<VisitorStateStore>();
/** The window of a visitor (level 1 of the configuration): the fatigue limit reads it too. */
const VisitorWindowPort = port("decision.visitor-window")<VisitorWindow>();
/** The policies of each merchant, with its kill switch: the configuration binds them. */
export const PolicyDirectoryPort = port("decision.policies")<PolicyDirectory>();
/** Session and visitor state as one authority. */
const DecisionStatePort = port("decision.state")<StateService>();

const PORTS = [SessionStatePort, VisitorStatePort, VisitorWindowPort] as const;

export const decisionModule = compositionModule({
  ports: PORTS,
  technologies: {
    memory: technology(PORTS, [
      bind(VisitorWindowPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
        visitorWindowOf(platform.visitorWindowMs, platform.identityCap()),
      ),
      bind(
        SessionStatePort,
        { clock: ClockPort, platform: PlatformConfigurationPort },
        ({ clock, platform }) =>
          memorySessionStateStore(clock, sessionWindowOf(platform.sessionWindowMs, platform.identityCap())),
      ),
      bind(VisitorStatePort, { clock: ClockPort, window: VisitorWindowPort }, ({ clock, window }) =>
        memoryVisitorStateStore(clock, window),
      ),
    ]),
  },
  exposes: [
    bind(
      DecisionStatePort,
      { sessions: SessionStatePort, visitors: VisitorStatePort, visitorWindow: VisitorWindowPort },
      (deps) => new DefaultStateService(deps),
    ),
    bind(
      DecisionPlanePort,
      {
        assignment: AssignmentPort,
        policies: PolicyDirectoryPort,
        state: DecisionStatePort,
        inference: BarrierInferencePort,
        truth: ProductTruthPort,
        recorder: DecisionRecorderPort,
      },
      (deps) => new DecisionService(deps),
    ),
  ],
});
