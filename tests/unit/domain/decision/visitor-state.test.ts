// Feature 012 (FR-040): what the plane remembers of a visitor across sessions, within a window.
import { describe, expect, it } from "vitest";
import { VisitorState } from "../../../../src/domain/decision/index.js";
import { hours } from "../../../../src/domain/shared-kernel/index.js";

const t0 = new Date("2026-09-19T12:00:00.000Z");
const at = (ms: number): Date => new Date(t0.getTime() + ms);
const DAY = hours(24);

describe("VisitorState", () => {
  it("empty: nothing within any window, no latest instant", () => {
    expect(VisitorState.empty().countSince(t0, DAY)).toBe(0);
    expect(VisitorState.empty().updatedAt()).toBeUndefined();
  });

  it("counts the interventions within the window and forgets the older ones on the next intervention", () => {
    const state = VisitorState.empty()
      .withIntervention(t0, DAY)
      .withIntervention(at(hours(1)), DAY);
    expect(state.countSince(at(hours(2)), DAY)).toBe(2);
    expect(state.countSince(at(hours(25)), DAY)).toBe(0);
    expect(state.countSince(at(hours(24)), DAY)).toBe(1);
    const later = state.withIntervention(at(hours(30)), DAY);
    expect(later.interventions).toEqual([at(hours(30))]);
    expect(later.updatedAt()).toEqual(at(hours(30)));
    // Exactly at the edge of the window the old one is already gone.
    expect(state.withIntervention(at(hours(24)), DAY).interventions).toEqual([at(hours(1)), at(hours(24))]);
    expect(state.withIntervention(at(hours(25)), DAY).interventions).toEqual([at(hours(25))]);
  });

  it("is immutable and rehydrates what a store recorded", () => {
    const state = VisitorState.empty();
    state.withIntervention(t0, DAY);
    expect(state.interventions).toEqual([]);
    expect(VisitorState.rehydrate({ interventions: [t0] }).countSince(at(1), DAY)).toBe(1);
  });
});
