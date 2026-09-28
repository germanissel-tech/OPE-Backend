// One row of the register: an event **as it arrived**, in one arrival (feature 031, FR-001..FR-006).
//
// What separates it from `Event`, which already exists here: `Event` is what the contract declares,
// and this is a **fact of reception**. The same event can have several — a retry sends it again — and
// each one is a row, which is what makes the register forensic instead of a picture of the traffic
// OPE accepted.
//
// **A type and not a class, which is a correction of this feature's own data model.** It was written
// as a class with three rules, and the rules were all of one kind: keep a row from saying something
// false about **why traffic was not intervened** — the question the register exists to answer. But
// ADR-024 asks for illegal states to be **unrepresentable** before it asks for a rule, and the two
// gates that caught it agreed: a class needs an error, an error of the domain has to appear in the
// public catalogue of problem types, and this one would never be emitted by any endpoint because it
// is not a business error at all. It is a programming mistake — so the discriminated union below
// makes it a compile error instead, and there is nothing left to validate at runtime.
//
// So a recorded arrival is a value without rules, like `Exposure` and `Assignment`, and it is not
// wrapped for the sake of uniformity.
import type { Event } from "./event.js";
import type { BatchId } from "./ids.js";
import type { DecisionId } from "../ledger/index.js";
import type { Arm, MerchantId } from "../shared-kernel/index.js";

/** What became of an event: it entered, it had already been seen, or its batch was refused. */
export type Disposition = "accepted" | "duplicate" | "rejected";

interface Arrival {
  /**
   * Whose traffic it is. It lives **in** the fact rather than beside it, so a queue holding arrivals
   * of several merchants stays a flat list and every row is self-describing: the isolation of
   * constitution V travels with the row instead of depending on who passes it along.
   */
  merchantId: MerchantId;
  /** The arrival it came in. */
  batchId: BatchId;
  /** Its place in that arrival; with `batchId` it identifies the row. */
  position: number;
  /** The event as the contract admits it. It gains no field by being recorded (FR-010). */
  event: Event;
  /** When OPE received it, which is not the instant the client declares (FR-002). */
  receivedAt: Date;
}

/**
 * An event that reached the decision plane, whether or not it was the first time it was seen: a
 * duplicate does reach it, because the plane is given the whole batch.
 *
 * It **always** names a decision, and that is not an assumption: the plane answers one for every
 * batch it is given, degraded to `NO_OP ledger-unavailable` when the ledger cannot record it
 * (ADR-021), but answered.
 */
export interface DecidedArrival extends Arrival {
  disposition: "accepted" | "duplicate";
  decisionId: DecisionId;
  /**
   * Absent when the merchant had no active experiment. That absence is **not** `CONTROL`: writing
   * one would put traffic that was never in an experiment into the control group of the pilot's own
   * figures. And the arm lives here rather than in `Arrival` because only a decision knows it.
   */
  arm?: Arm | undefined;
}

/**
 * A batch an invariant refused. It produces **no decision** and never will — which is exactly the
 * traffic FR-006 asks to be able to see, and the most invisible traffic there is today: OPE answers
 * `422` and nothing is left behind.
 */
export interface RejectedArrival extends Arrival {
  disposition: "rejected";
  /** The `code` of the invariant that refused the batch (`session-visitor-mismatch`, …). */
  rejectedBy: string;
}

/**
 * The union is the whole point: a row claiming to be rejected while naming a decision, or claiming
 * to be accepted while naming an invariant, does not compile.
 *
 * Whoever reads the register narrows it on `disposition`, which is what a discriminated union is for
 * — there is no helper to do it, because a loose function is not what this ring exports (ADR-024).
 */
export type RecordedEvent = DecidedArrival | RejectedArrival;
