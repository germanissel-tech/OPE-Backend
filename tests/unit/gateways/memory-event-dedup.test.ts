// US2 (FR-013): deduplicación por eventId dentro del merchant, con ventana declarada.
import { describe, expect, it } from "vitest";
import { asEventId, asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import {
  DEDUP_WINDOW,
  memoryEventDedup,
} from "../../../src/interface-adapters/gateways/ingestion/memory-event-dedup.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const e = (n: number) => asEventId(`evt_${String(n).padStart(8, "0")}`);

function clockAt(start: number) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => (t += ms) };
}

describe("memoryEventDedup", () => {
  it("la primera vez todos entran; la segunda, ninguno", async () => {
    const dedup = memoryEventDedup(clockAt(0));
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([e(1), e(2)]);
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([]);
  });

  it("un lote con un evento repetido y uno nuevo devuelve sólo el nuevo", async () => {
    const dedup = memoryEventDedup(clockAt(0));
    await dedup.claim(A, [e(1)]);
    expect([...(await dedup.claim(A, [e(1), e(2)]))]).toEqual([e(2)]);
  });

  it("el mismo eventId repetido dentro de un lote cuenta una sola vez", async () => {
    const dedup = memoryEventDedup(clockAt(0));
    expect([...(await dedup.claim(A, [e(1), e(1)]))]).toEqual([e(1)]);
  });

  it("el mismo eventId en otro merchant es otro evento (aislamiento, FR-050)", async () => {
    const dedup = memoryEventDedup(clockAt(0));
    await dedup.claim(A, [e(1)]);
    expect([...(await dedup.claim(B, [e(1)]))]).toEqual([e(1)]);
  });

  it("ventana por tamaño: pasados los N ids por merchant, los más viejos se olvidan", async () => {
    const dedup = memoryEventDedup(clockAt(0), { maxIds: 3, ttlMs: DEDUP_WINDOW.ttlMs });
    await dedup.claim(A, [e(1), e(2), e(3)]);
    await dedup.claim(A, [e(4)]);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([e(1)]);
    expect([...(await dedup.claim(A, [e(4)]))]).toEqual([]);
  });

  it("ventana por tiempo: pasadas 24 h el id vuelve a entrar", async () => {
    const clock = clockAt(0);
    const dedup = memoryEventDedup(clock);
    await dedup.claim(A, [e(1)]);
    clock.advance(DEDUP_WINDOW.ttlMs - 1);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([]);
    clock.advance(2);
    expect([...(await dedup.claim(A, [e(1)]))]).toEqual([e(1)]);
  });

  it("la ventana declarada es la del contrato: 24 h o 100 000 ids por merchant", () => {
    expect(DEDUP_WINDOW).toEqual({ ttlMs: 24 * 60 * 60 * 1000, maxIds: 100_000 });
  });
});
