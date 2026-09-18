// Feature 011 (FR-050; constitution IV, V): session state per merchant, expiring with the window.
import { describe, expect, it } from "vitest";
import { Signals } from "../../../src/domain/barrier/index.js";
import { SessionState } from "../../../src/domain/decision/index.js";
import { asMerchantId, asSessionId, hours } from "../../../src/domain/shared-kernel/index.js";
import { memorySessionStateStore } from "../../../src/interface-adapters/gateways/decision/memory-session-state-store.js";
import { addedToCart } from "../../helpers/events.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const S1 = asSessionId("ses_00000001");
const S2 = asSessionId("ses_00000002");
const t0 = new Date("2026-09-18T12:00:00.000Z");
const at = (ms: number): Date => new Date(t0.getTime() + ms);

function store(window = { ttlMs: hours(24), maxSessions: 100_000 }) {
  let now = t0;
  const clock = { now: () => now };
  return { store: memorySessionStateStore(clock, window), advance: (ms: number) => (now = at(ms)) };
}

describe("memorySessionStateStore", () => {
  it("saves and loads per merchant and session; another merchant does not see it", async () => {
    const { store: s } = store();
    const state = SessionState.empty(t0).absorb(Signals.of([addedToCart(1)]), t0);
    await s.save(A, S1, state);
    expect(await s.load(A, S1)).toBe(state);
    expect(await s.load(B, S1)).toBeUndefined();
    expect(await s.load(A, S2)).toBeUndefined();
  });

  it("forgets a session untouched for the window; a save refreshes it", async () => {
    const { store: s, advance } = store();
    await s.save(A, S1, SessionState.empty(t0));
    advance(hours(23));
    await s.save(A, S2, SessionState.empty(at(hours(23))));
    advance(hours(24));
    expect(await s.load(A, S1)).toBeUndefined();
    expect(await s.load(A, S2)).toBeDefined();
  });

  it("keeps at most the window's sessions per merchant, dropping the least recently saved", async () => {
    const { store: s } = store({ ttlMs: hours(24), maxSessions: 2 });
    await s.save(A, S1, SessionState.empty(t0));
    await s.save(A, S2, SessionState.empty(t0));
    await s.save(A, S1, SessionState.empty(t0));
    await s.save(A, asSessionId("ses_00000003"), SessionState.empty(t0));
    expect(await s.load(A, S2)).toBeUndefined();
    expect(await s.load(A, S1)).toBeDefined();
    await s.save(B, S2, SessionState.empty(t0));
    expect(await s.load(B, S2)).toBeDefined();
  });
});
