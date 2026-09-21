// Application service: what the plane remembers between requests — the session (signals,
// interventions, cooldown) and the visitor (interventions across sessions, for the fatigue
// limit, within the visitor window of the platform) — behind their two stores, so the
// orchestrator recalls and remembers in one step.
import { SessionState, VisitorState } from "../../../domain/decision/index.js";
import type { MerchantId, SessionId, VisitorId } from "../../../domain/shared-kernel/index.js";
import type { SessionStateStore } from "../ports/session-state-store.js";
import type { VisitorStateStore, VisitorWindow } from "../ports/visitor-state-store.js";

export interface Remembered {
  session: SessionState;
  visitor: VisitorState;
  /** Interventions the visitor received within the window, across sessions (fatigue, ADR-027). */
  visitorInterventions: number;
}

export interface Whose {
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
}

/** What to remember: the session always; the visitor only when an intervention was accepted. */
export interface ToRemember {
  session: SessionState;
  intervention?: { visitor: VisitorState; at: Date };
}

export interface StateService {
  /** The session as last remembered (empty when nothing was) and what the visitor received within the window. */
  recall(whose: Whose, now: Date): Promise<Remembered>;
  remember(whose: Whose, state: ToRemember): Promise<void>;
}

export interface StateServiceDependencies {
  sessions: SessionStateStore;
  visitors: VisitorStateStore;
  /** The visitor window of the platform (level 1). */
  visitorWindow: VisitorWindow;
}

export class DefaultStateService implements StateService {
  readonly #deps: StateServiceDependencies;

  constructor(deps: StateServiceDependencies) {
    this.#deps = deps;
  }

  async recall({ merchantId, sessionId, visitorId }: Whose, now: Date): Promise<Remembered> {
    const [session, visitor] = await Promise.all([
      this.#deps.sessions.load(merchantId, sessionId),
      this.#deps.visitors.load(merchantId, visitorId),
    ]);
    const known = visitor ?? VisitorState.empty();
    return {
      session: session ?? SessionState.empty(now),
      visitor: known,
      visitorInterventions: known.countSince(now, this.#deps.visitorWindow.ttlMs),
    };
  }

  async remember({ merchantId, sessionId, visitorId }: Whose, state: ToRemember): Promise<void> {
    const { sessions, visitors, visitorWindow } = this.#deps;
    const intervention = state.intervention;
    await Promise.all([
      sessions.save(merchantId, sessionId, state.session),
      intervention === undefined
        ? Promise.resolve()
        : visitors.save(
            merchantId,
            visitorId,
            intervention.visitor.withIntervention(intervention.at, visitorWindow.ttlMs),
          ),
    ]);
  }
}
