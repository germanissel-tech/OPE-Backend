// decision module (01-arquitectura-mvp.md §4; ADR-026, ADR-027): the decision plane. It needs the
// authorities already built —the assignment, the inference, the truth of product, the recorder of
// the ledger and the policies of the merchant— and not their ingredients: what each of them is
// made of is the business of its own module. It owns the state of sessions and visitors, and
// serves no operation of its own: what it builds is the plane the ingestion asks for a decision.
import {
  Candidates,
  DecisionService,
  States,
  type MessagePlane,
  type PolicyDirectory,
  type SessionStateStore,
  type PastActivity,
  type StateLimits,
  type StateService,
  type VisitorStateStore,
  type VisitorWindow,
} from "../../application/decision/index.js";
import {
  durablePastActivity,
  memorySessionStateStore,
  memoryVisitorStateStore,
  sessionWindowOf,
  visitorWindowOf,
} from "../../interface-adapters/decision/index.js";
import { bind, compositionModule, port } from "../graph/index.js";
import { PlatformLevelPort, StateRetentionPort } from "../release.js";
import { BarrierInferencePort } from "./barrier.js";
import { ProductTruthPort } from "./catalog.js";
import { AssignmentPort } from "./experiment.js";
import { DecisionPlanePort, EventLogPort } from "./ingestion.js";
import { DecisionLedgerPort, DecisionRecorderPort } from "./ledger.js";
import { ClockPort, LoggerPort } from "./shared-kernel.js";

export const SessionStatePort = port("decision.sessions")<SessionStateStore>();
export const VisitorStatePort = port("decision.visitors")<VisitorStateStore>();
/** The window of a visitor (level 1 of the configuration): the fatigue limit reads it too. */
const VisitorWindowPort = port("decision.visitor-window")<VisitorWindow>();
/** The policies of each merchant, with its kill switch: the configuration binds them. */
export const PolicyDirectoryPort = port("decision.policies")<PolicyDirectory>();
/** What can be said for a barrier: the messages module implements it, so the plane never depends on the corpus. */
export const MessagePlanePort = port("decision.messages")<MessagePlane>();
/** The inference and the candidates that survive being sayable and being judged (feature 027). */
const CandidatesPort = port("decision.candidates")<Candidates>();
/** Session and visitor state as one authority. */
const DecisionStatePort = port("decision.state")<StateService>();
/**
 * The two durations of level 1 the state service measures with (feature 032). Its own component so the
 * service takes the durations and not the two window objects: a capacity is a bound of the stores.
 */
const StateLimitsPort = port("decision.state-limits")<StateLimits>();
/**
 * The three durable reads a forgotten state is rebuilt from, as values rather than exceptions. It is a
 * component of this module because turning a throw into a `StateUnavailable` is translation, and the
 * plane must depend on reads that answer: see the port and `durablePastActivity`.
 */
export const PastActivityPort = port("decision.past-activity")<PastActivity>();

export const decisionModule = compositionModule({
  provides: [
    bind(VisitorWindowPort, { platform: PlatformLevelPort }, ({ platform }) =>
      visitorWindowOf(
        () => platform.inForce().visitorWindowMs,
        () => platform.inForce().identityCap(),
      ),
    ),
    // The retention comes from the environment and the capacity from level 1, and they are two
    // different things on purpose: how long a session is remembered is nobody's business outside
    // this process, while how many an instance holds is a published limit. The duration of a
    // session (`platform.sessionDurationMs`) is a third thing and is deliberately not here — it is
    // a rule the SDK obeys, and reading it as a retention is the confusion feature 032 undid.
    bind(
      SessionStatePort,
      { clock: ClockPort, platform: PlatformLevelPort, retention: StateRetentionPort },
      ({ clock, platform, retention }) =>
        memorySessionStateStore(
          clock,
          sessionWindowOf(
            () => retention.sessionMs,
            () => platform.inForce().identityCap(),
          ),
        ),
    ),
    bind(VisitorStatePort, { clock: ClockPort, window: VisitorWindowPort }, ({ clock, window }) =>
      memoryVisitorStateStore(clock, window),
    ),
  ],
  assembles: [
    // The plane does not write through these: what is durable is already written by the ledger and by
    // the register, and writing it twice would make two truths that can disagree.
    bind(
      PastActivityPort,
      { events: EventLogPort, decisions: DecisionLedgerPort, logger: LoggerPort },
      (deps) => durablePastActivity(deps),
    ),
    bind(StateLimitsPort, { platform: PlatformLevelPort }, ({ platform }) => ({
      get visitorWindowMs() {
        return platform.inForce().visitorWindowMs;
      },
      get sessionDurationMs() {
        return platform.inForce().sessionDurationMs;
      },
    })),
    bind(
      DecisionStatePort,
      {
        sessions: SessionStatePort,
        visitors: VisitorStatePort,
        limits: StateLimitsPort,
        past: PastActivityPort,
        logger: LoggerPort,
      },
      (deps) => new States(deps),
    ),
    bind(
      CandidatesPort,
      { inference: BarrierInferencePort, messages: MessagePlanePort },
      (deps) => new Candidates(deps),
    ),
    bind(
      DecisionPlanePort,
      {
        assignment: AssignmentPort,
        policies: PolicyDirectoryPort,
        state: DecisionStatePort,
        candidates: CandidatesPort,
        truth: ProductTruthPort,
        recorder: DecisionRecorderPort,
      },
      (deps) => new DecisionService(deps),
    ),
  ],
});
