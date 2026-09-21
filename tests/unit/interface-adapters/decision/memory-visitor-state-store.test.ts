// Feature 012 (FR-040; constitution IV, V): visitor state per merchant, expiring with the window.
import { describe, expect, it } from "vitest";
import { VisitorState } from "../../../../src/domain/decision/index.js";
import { asMerchantId, asVisitorId, hours } from "../../../../src/domain/shared-kernel/index.js";
import { memoryVisitorStateStore } from "../../../../src/interface-adapters/decision/gateways/memory-visitor-state-store.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const V1 = asVisitorId("vis_00000001");
const V2 = asVisitorId("vis_00000002");
const t0 = new Date("2026-09-19T12:00:00.000Z");
const at = (ms: number): Date => new Date(t0.getTime() + ms);
const DAY = hours(24);

function store(window = { ttlMs: DAY, maxVisitors: 100_000 }) {
  let now = t0;
  const clock = { now: () => now };
  return { store: memoryVisitorStateStore(clock, window), advance: (ms: number) => (now = at(ms)) };
}

describe("memoryVisitorStateStore", () => {
  it("saves and loads per merchant and visitor; another merchant does not see it", async () => {
    const { store: s } = store();
    const state = VisitorState.empty().withIntervention(t0, DAY);
    await s.save(A, V1, state);
    expect(await s.load(A, V1)).toBe(state);
    expect(await s.load(B, V1)).toBeUndefined();
    expect(await s.load(A, V2)).toBeUndefined();
  });

  it("forgets a visitor whose last intervention is older than the window", async () => {
    const { store: s, advance } = store();
    await s.save(A, V1, VisitorState.empty().withIntervention(t0, DAY));
    advance(hours(1));
    await s.save(A, V2, VisitorState.empty().withIntervention(at(hours(1)), DAY));
    advance(hours(24));
    expect(await s.load(A, V1)).toBeUndefined();
    expect(await s.load(A, V2)).toBeDefined();
    advance(hours(25));
    expect(await s.load(A, V2)).toBeUndefined();
  });

  it("keeps at most the window's visitors per merchant, dropping the least recently saved", async () => {
    const { store: s } = store({ ttlMs: DAY, maxVisitors: 2 });
    const fresh = () => VisitorState.empty().withIntervention(t0, DAY);
    await s.save(A, V1, fresh());
    await s.save(A, V2, fresh());
    await s.save(A, V1, fresh());
    await s.save(A, asVisitorId("vis_00000003"), fresh());
    expect(await s.load(A, V2)).toBeUndefined();
    expect(await s.load(A, V1)).toBeDefined();
  });
});
