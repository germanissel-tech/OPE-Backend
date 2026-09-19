// Application service: what the plane remembers between requests — the session (signals,
// interventions, cooldown) and the visitor (interventions across sessions, for the fatigue
// limit) — behind their two stores, so the orchestrator recalls and remembers in one step.
import { SessionState, VisitorState } from "../../../domain/decision/index.js";
import type { MerchantId, SessionId, VisitorId } from "../../../domain/shared-kernel/index.js";
import type { SessionStateStore } from "../ports/session-state-store.js";
import type { VisitorStateStore } from "../ports/visitor-state-store.js";

export interface Remembered {
  session: SessionState;
  visitor: VisitorState;
}

export interface Whose {
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
}

/** What to remember: the session always; the visitor only when it changed (an intervention was accepted). */
export interface ToRemember {
  session: SessionState;
  visitor?: VisitorState;
}

export interface StateService {
  /** The session and the visitor as last remembered; empty ones when nothing was. */
  recall(whose: Whose, now: Date): Promise<Remembered>;
  remember(whose: Whose, state: ToRemember): Promise<void>;
}

export interface StateServiceDependencies {
  sessions: SessionStateStore;
  visitors: VisitorStateStore;
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
    return { session: session ?? SessionState.empty(now), visitor: visitor ?? VisitorState.empty() };
  }

  async remember({ merchantId, sessionId, visitorId }: Whose, state: ToRemember): Promise<void> {
    await Promise.all([
      this.#deps.sessions.save(merchantId, sessionId, state.session),
      state.visitor ? this.#deps.visitors.save(merchantId, visitorId, state.visitor) : Promise.resolve(),
    ]);
  }
}
