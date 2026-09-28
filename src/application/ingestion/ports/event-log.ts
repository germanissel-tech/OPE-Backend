// The register of what the SDK sends (feature 031). It is the first port of this system that lives on
// the **measurement** side of `01 §P9` — asynchronous, durable, auditable — and its shape is what
// keeps it there.
//
// **`record` returns `void`, not a `Promise`, and has no failure channel.** Both are deliberate and
// both are the requirement made unbreakable by the type:
//
// - A type that can be awaited invites being awaited, and there FR-007 is lost: the decision path
//   must not wait for the register. A `void` cannot be awaited into a wait.
// - There is nothing a caller could do with a failure it must not wait for. Every other durable port
//   answers `LedgerUnavailable` because the decision plane needs it to fail closed (ADR-021); here
//   failing closed would mean degrading a decision because a **measurement** could not be written,
//   which is exactly the mixing `01 §P9` exists to prevent. What was lost is counted at start-up,
//   where the information is of use (FR-018), and logged where it happened.
//
// The reads throw rather than answer a failure, like every other durable port: giving reads a failure
// channel changes every port and is the part of the milestone this feature leaves out.
import type { EventId, EventType, RecordedEvent } from "../../../domain/ingestion/index.js";
import type { DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";

/** How many events of one type a merchant received within a window (FR-012). */
export interface EventTypeCount {
  type: EventType;
  count: number;
}

/** A closed interval of time, as the volume question asks it. */
export interface TimeWindow {
  from: Date;
  to: Date;
}

/**
 * What the register knows it is missing (FR-018, SC-010). The register **does not promise
 * completeness; it promises to know where it does not have it** (Q3), and this is that promise made
 * answerable.
 *
 * It exists because the write is queued: an orderly shutdown drains, but a process killed without one
 * loses what it held. The decisions ledger does **not** lose it — that write is synchronous — so a
 * decision that declares how many events its batch carried and has no events in the register is a
 * batch that arrived and was never written.
 *
 * **The two halves of the register do not have the same guarantee, and that is declared rather than
 * averaged out.** An *accepted* batch leaves a decision, so its loss is reconcilable and counted here.
 * A batch an invariant **refused** leaves no decision — that is the whole point of FR-006 — so nothing
 * durable says it ever arrived, and a crash that loses its rows loses them without trace. What names
 * that half is the operational log, which records the request and its `422` and does not live in the
 * queue. Saying the register knows about both would be the kind of claim this feature exists to stop
 * making.
 */
export interface Hole {
  /** How many events were never written. */
  events: number;
  /** How many arrivals they belonged to. */
  batches: number;
  /** When the earliest of those decisions was taken, and the latest: the interval SC-010 asks for. */
  from: Date;
  to: Date;
}

export interface EventLog {
  /**
   * Takes an arrival to be written. Returns **immediately** and never fails: see the note above.
   *
   * Each arrival carries its own `merchantId`, so a queue holding several of them stays a flat list
   * and every row is self-describing — the isolation of constitution V travels with the fact instead
   * of alongside it.
   */
  record(arrivals: readonly RecordedEvent[]): void;

  /** Everything recorded for a decision, in arrival order (FR-003). */
  byDecision(merchantId: MerchantId, decisionId: DecisionId): Promise<readonly RecordedEvent[]>;

  /**
   * Everything recorded for a session, in arrival order (FR-013). This is what feature 032 reads to
   * rebuild the signals a decision was taken with, which is why the order is part of the promise.
   */
  bySession(merchantId: MerchantId, sessionId: SessionId): Promise<readonly RecordedEvent[]>;

  /**
   * **Every** arrival of one event id, oldest first (FR-005). More than one is the normal answer: a
   * retry sends the same event again and each arrival is a fact. The first is the original of a
   * duplicate, which is how the reference is rebuilt without the deduplication window having to
   * carry one.
   */
  byEvent(merchantId: MerchantId, eventId: EventId): Promise<readonly RecordedEvent[]>;

  /** How many events of each type a merchant received within a window, in one query (FR-012). */
  volume(merchantId: MerchantId, window: TimeWindow): Promise<readonly EventTypeCount[]>;

  /**
   * What the register is missing, or nothing when it is whole (FR-018).
   *
   * **Asked at start-up and only there**, which is what makes the answer sound: at that moment nothing
   * is queued, so a decision without its events is a loss and not a write still on its way. Asking it
   * while the process is running would report the queue's own backlog as a hole.
   *
   * It is a question about the register even though answering it reads the ledger too: the register is
   * the thing that promises to know where it is incomplete, and it cannot know that alone.
   */
  unrecorded(): Promise<Hole | undefined>;
}
