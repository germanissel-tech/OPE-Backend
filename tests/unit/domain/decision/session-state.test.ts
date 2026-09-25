// Feature 011 (FR-050): what the plane remembers of a session, immutable and derived from the signals.
import { describe, expect, it } from "vitest";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { SessionState } from "../../../../src/domain/decision/index.js";
import { addedToCart, checkout, removedFromCart, variantSelector } from "../../../helpers/events.js";

const t0 = new Date("2026-09-18T12:00:00.000Z");
const t1 = new Date("2026-09-18T12:05:00.000Z");

describe("SessionState", () => {
  it("empty: nothing seen, no intervention", () => {
    const state = SessionState.empty(t0);
    expect(state.signals.isEmpty()).toBe(true);
    expect(state.interventions).toBe(0);
    expect(state.updatedAt).toBe(t0);
    expect(state.addedToCart()).toBe(false);
    expect(state.enteredCheckout()).toBe(false);
    expect(state.abandoned()).toBe(false);
  });

  it("absorb merges the batch into the session and stamps the instant; the previous value is untouched", () => {
    const first = SessionState.empty(t0).absorb(Signals.of([variantSelector(1), addedToCart(2)]), t0);
    const second = first.absorb(Signals.of([variantSelector(10), removedFromCart(11)]), t1);
    expect(first.signals.count({ type: "variant_selector_interacted" })).toBe(1);
    expect(second.signals.count({ type: "variant_selector_interacted" })).toBe(2);
    expect(second.updatedAt).toBe(t1);
    expect(second.interventions).toBe(0);
    expect(first.abandoned()).toBe(false);
    expect(second.abandoned()).toBe(true);
    expect(second.addedToCart()).toBe(true);
  });

  it("withIntervention counts one more, keeps the signals and starts the cooldown; absorb keeps it", () => {
    const state = SessionState.empty(t0)
      .absorb(Signals.of([checkout(1)]), t0)
      .withIntervention(t1);
    expect(state.interventions).toBe(1);
    expect(state.enteredCheckout()).toBe(true);
    expect(state.lastInterventionAt).toBe(t1);
    expect(state.withIntervention(t1).interventions).toBe(2);
    const later = state.absorb(Signals.of([addedToCart(2)]), new Date(t1.getTime() + 1000));
    expect(later.lastInterventionAt).toBe(t1);
    expect(later.interventions).toBe(1);
    expect(SessionState.empty(t0).lastInterventionAt).toBeUndefined();
  });

  it("rehydrate keeps a recorded state as is", () => {
    const signals = Signals.of([addedToCart(1)]);
    const state = SessionState.rehydrate({ signals, interventions: 3, updatedAt: t1 });
    expect(state.signals).toBe(signals);
    expect(state.interventions).toBe(3);
  });
});
