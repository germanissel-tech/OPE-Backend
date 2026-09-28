// Application service: what the plane remembers between requests — the session (signals,
// interventions, cooldown) and the visitor (interventions across sessions, for the fatigue
// limit, within the visitor window of the platform) — behind their two stores, so the
// orchestrator recalls and remembers in one step.
//
// **Since feature 032 "remembers" and "can answer" are no longer the same thing.** Hot state is
// still not the source of truth (constitution IV): what is durable is where a forgotten state is
// recovered from, not where it lives. So `recall` has three outcomes and not two — remembered,
// rebuilt, or **could not be determined** — and the third one exists because without it a failed
// read and a new visitor would be the same value, and the plane would hand a failure the whole
// quota of somebody who had never been seen (FR-012).
import { Signals } from "../../../domain/barrier/index.js";
import { SessionState, VisitorState, type StateUnavailable } from "../../../domain/decision/index.js";
import {
  ok,
  type Result,
  type MerchantId,
  type SessionId,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { Event, RecordedEvent } from "../../../domain/ingestion/index.js";
import type { SessionEvents } from "../../ingestion/index.js";
import type { PastDecisions } from "../../ledger/index.js";
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
  /**
   * The session and the visitor as the plane last knew them — from memory, or rebuilt from what is
   * durable when memory has forgotten — or `StateUnavailable` when neither could answer.
   */
  recall(whose: Whose, now: Date): Promise<Result<Remembered, StateUnavailable>>;
  remember(whose: Whose, state: ToRemember): Promise<void>;
}

export interface StateServiceDependencies {
  sessions: SessionStateStore;
  visitors: VisitorStateStore;
  /** The visitor window of the platform (level 1). */
  visitorWindow: VisitorWindow;
  /** The register of what arrived, to replay the signals of a forgotten session (feature 032, FR-004). */
  events: SessionEvents;
  /** What was already decided: the interventions of the session and of the visitor (FR-005, FR-007). */
  decisions: PastDecisions;
}

/**
 * Which arrivals are replayed when a session is rebuilt, and the **one** place that decides it: this
 * is what makes the rebuilt signals the ones the plane actually had, and getting it wrong returns a
 * state that is plausible and different, which is the worst way to be wrong.
 *
 * - `accepted` was absorbed. Replayed.
 * - `duplicate` **was absorbed too.** The plane receives the whole batch, duplicates included —
 *   feature 031 measured that and deliberately did not judge it — so those events did enter the
 *   signals. Leaving them out would rebuild a state the system never had.
 * - `rejected` was **not**. An invariant refused that batch before the plane saw it, so replaying it
 *   would invent signals out of events that were never absorbed.
 *
 * Splitting this between two callers is how the two halves drift apart, and whoever rebuilds has no
 * reason to know that a disposition exists.
 */
const replayed = (arrivals: readonly RecordedEvent[]): readonly Event[] =>
  arrivals.filter((arrival) => arrival.disposition !== "rejected").map((arrival) => arrival.event);

export class States implements StateService {
  readonly #deps: StateServiceDependencies;

  constructor(deps: StateServiceDependencies) {
    this.#deps = deps;
  }

  async recall(whose: Whose, now: Date): Promise<Result<Remembered, StateUnavailable>> {
    const [session, visitor] = await Promise.all([this.#session(whose, now), this.#visitor(whose, now)]);
    if (!session.ok) return session;
    if (!visitor.ok) return visitor;
    // Neither can be `undefined` here: a rebuild that finds nothing durable answers the empty state,
    // because a visitor nobody has a record of **is** a new visitor. That is the one case where the
    // old two answers were right, and it stays.
    const known = visitor.value;
    return ok({
      session: session.value,
      visitor: known,
      visitorInterventions: known.countSince(now, this.#deps.visitorWindow.ttlMs),
    });
  }

  async remember({ merchantId, sessionId, visitorId }: Whose, state: ToRemember): Promise<void> {
    // Only the hot side. What is durable is already written by the ledger and by the register, and
    // writing it a second time here would create two truths that can disagree — and it would put a
    // write on the decision path, which is the line `01 §P9` draws.
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

  /** From memory, or rebuilt; `undefined` never leaves this method. */
  async #session(
    { merchantId, sessionId }: Whose,
    now: Date,
  ): Promise<Result<SessionState, StateUnavailable>> {
    const hot = await this.#deps.sessions.load(merchantId, sessionId);
    if (!hot.ok) return hot;
    if (hot.value !== undefined) return ok(hot.value);
    const [arrivals, decided] = await Promise.all([
      this.#deps.events.bySession(merchantId, sessionId),
      this.#deps.decisions.bySession(merchantId, sessionId),
    ]);
    const interventions = decided.filter((decision) => decision.isIntervention());
    return ok(
      SessionState.rehydrate({
        signals: Signals.of(replayed(arrivals)),
        interventions: interventions.length,
        // When the session last moved, which is not the same as now: the cooldown and the window are
        // measured from it, and stamping the current instant would make an old session look fresh.
        // A session with no arrivals has not moved, so `now` is the honest answer for it.
        updatedAt: arrivals.at(-1)?.receivedAt ?? now,
        lastInterventionAt: interventions.at(-1)?.decidedAt,
      }),
    );
  }

  /** From memory, or rebuilt from the interventions the ledger has for the visitor. */
  async #visitor(
    { merchantId, visitorId }: Whose,
    now: Date,
  ): Promise<Result<VisitorState, StateUnavailable>> {
    const hot = await this.#deps.visitors.load(merchantId, visitorId);
    if (!hot.ok) return hot;
    if (hot.value !== undefined) return ok(hot.value);
    // The window bounds the read, it does not apply the rule: `countSince` does that, on whatever the
    // store hands back. See `VisitorDecisions.byVisitor`.
    const since = new Date(now.getTime() - this.#deps.visitorWindow.ttlMs);
    const past = await this.#deps.decisions.byVisitor(merchantId, visitorId, since);
    return ok(
      VisitorState.rehydrate({
        interventions: past.filter((decision) => decision.isIntervention()).map((d) => d.decidedAt),
      }),
    );
  }
}
