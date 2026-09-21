// Feature 004, US2 (FR-013): deduplication by eventId within the merchant, with a declared window.
import { describe, expect, it } from "vitest";
import { asEventId } from "../../../src/domain/ingestion/index.js";
import { asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import { memoryEventDedup } from "../../../src/interface-adapters/gateways/ingestion/memory-event-dedup.js";
import type { DedupWindow } from "../../../src/application/ingestion/index.js";

/** The window the platform declares (level 1 of the configuration), as the tests declare it. */
const DEDUP_WINDOW: DedupWindow = { ttlMs: 24 * 60 * 60 * 1000, maxIds: 100_000 };

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const e = (n: number) => asEventId(`evt_${String(n).padStart(8, "0")}`);

function clockAt(start: number) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => (t += ms) };
}

describe("memoryEventDedup", () => {
  it("the first time all come in; the second, none", async () => {
    const dedup = memoryEventDedup(clockAt(0), DEDUP_WINDOW);
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([e(1), e(2)]);
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([]);
  });

  it("a batch with one repeated and one new event returns only the new one", async () => {
    const dedup = memoryEventDedup(clockAt(0), DEDUP_WINDOW);
    await dedup.claim(A, [e(1)]);
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([e(2)]);
  });

  it("the same eventId repeated within a batch counts once", async () => {
    const dedup = memoryEventDedup(clockAt(0), DEDUP_WINDOW);
    expect([...(await dedup.claim(A, [e(1), e(1)]))]).toEqual([e(1)]);
  });

  it("the same eventId in another merchant is another event (isolation, FR-050)", async () => {
    const dedup = memoryEventDedup(clockAt(0), DEDUP_WINDOW);
    await dedup.claim(A, [e(1)]);
    expect([...(await dedup.claim(B, [e(1)]))]).toEqual([e(1)]);
  });

  it("size window: past N ids per merchant, the oldest are forgotten", async () => {
    const dedup = memoryEventDedup(clockAt(0), { maxIds: 3, ttlMs: DEDUP_WINDOW.ttlMs });
    await dedup.claim(A, [e(1), e(2), e(3)]);
    await dedup.claim(A, [e(4)]);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([e(1)]);
    expect([...(await dedup.claim(A, [e(4)]))]).toEqual([]);
  });

  it("time window: after 24 h the id comes in again", async () => {
    const clock = clockAt(0);
    const dedup = memoryEventDedup(clock, DEDUP_WINDOW);
    await dedup.claim(A, [e(1)]);
    clock.advance(DEDUP_WINDOW.ttlMs - 1);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([]);
    clock.advance(2);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([e(1)]);
  });
});
