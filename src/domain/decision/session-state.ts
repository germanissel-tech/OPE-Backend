// Session state of the decision plane (01-arquitectura-mvp.md §4.2; ADR-026): what the plane
// remembers of a session between batches — the accumulated signals and how many interventions
// it already decided. Hot, bounded state (constitution IV): it lives in memory behind a port
// with the window of the deduplication; a forgotten session starts over. Immutable: every
// change is a new value.
import { Signals, type EventRef } from "../barrier/index.js";

const ADDED_TO_CART: EventRef = { type: "added_to_cart" };
const REMOVED_FROM_CART: EventRef = { type: "removed_from_cart" };
const CHECKOUT_ADVANCED: EventRef = { type: "checkout_advanced" };

export interface SessionStateRecord {
  signals: Signals;
  interventions: number;
  updatedAt: Date;
  /** When the ledger last accepted an intervention of this session; the cooldown counts from here. */
  lastInterventionAt?: Date;
}

export class SessionState {
  readonly signals: Signals;
  readonly interventions: number;
  readonly updatedAt: Date;
  readonly lastInterventionAt?: Date;

  private constructor(record: SessionStateRecord) {
    this.signals = record.signals;
    this.interventions = record.interventions;
    this.updatedAt = record.updatedAt;
    if (record.lastInterventionAt) this.lastInterventionAt = record.lastInterventionAt;
  }

  /** A session nothing was seen of yet. */
  static empty(now: Date): SessionState {
    return new SessionState({ signals: Signals.empty(), interventions: 0, updatedAt: now });
  }

  /** A state a store recorded. */
  static rehydrate(record: SessionStateRecord): SessionState {
    return new SessionState(record);
  }

  /** The state after this batch: its signals merged into the session's. */
  absorb(batch: Signals, now: Date): SessionState {
    return new SessionState({ ...this.#record(), signals: this.signals.merge(batch), updatedAt: now });
  }

  /** The state after an intervention the ledger accepted: one more, and the cooldown starts now. */
  withIntervention(now: Date): SessionState {
    return new SessionState({
      ...this.#record(),
      interventions: this.interventions + 1,
      updatedAt: now,
      lastInterventionAt: now,
    });
  }

  #record(): SessionStateRecord {
    const base = { signals: this.signals, interventions: this.interventions, updatedAt: this.updatedAt };
    return this.lastInterventionAt ? { ...base, lastInterventionAt: this.lastInterventionAt } : base;
  }

  addedToCart(): boolean {
    return this.signals.count(ADDED_TO_CART) >= 1;
  }

  enteredCheckout(): boolean {
    return this.signals.count(CHECKOUT_ADVANCED) >= 1;
  }

  /** Added to the cart and later removed: the abandonment a policy may answer. */
  abandoned(): boolean {
    return this.signals.sequence(ADDED_TO_CART, REMOVED_FROM_CART);
  }
}
