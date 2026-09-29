// The deduplication window rebuilt from the register (feature 033, US3): **recoverable, not durable**.
// The `claim` keeps being answered from memory; what the restart loses is rebuilt from what is durable
// the first time each merchant appears.
//
// Three properties, and the third is the one that matters most:
//
//   - **once per merchant and per boot**, because this sits on the path of every batch;
//   - the window's own bounds — the time it keeps ids for and how many — so a rebuilt window is not a
//     bigger promise than the one the platform publishes;
//   - **a read that fails does not stop the ingest.** Degrading the ingest because a *measurement*
//     could not be read is exactly the mixing `01 §P9` exists to prevent, and it is the property that
//     a wrapper written the obvious way gets wrong.
import { describe, expect, it } from "vitest";
import { asMerchantId, type MerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryEventDedup } from "../../../../src/interface-adapters/ingestion/gateways/memory-event-dedup.js";
import { recoveringEventDedup } from "../../../../src/interface-adapters/ingestion/gateways/recovering-event-dedup.js";
import type { DedupWindow, EventLog } from "../../../../src/application/ingestion/index.js";
import type { Logger } from "../../../../src/application/shared-kernel/index.js";
import type { EventId } from "../../../../src/domain/ingestion/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const A = asMerchantId("m_uno");
const B = asMerchantId("m_dos");
const ids = (...values: readonly string[]): EventId[] => values.map((value) => value as EventId);

interface Asked {
  merchantId: MerchantId;
  since: Date;
  limit: number;
}

/**
 * The wrapper over the real in-memory window, with a register that answers `held` (most recent first)
 * or throws. `asked` records what it was asked, which is how the bounds are checked.
 */
function subject(options: { held?: readonly EventId[]; throws?: boolean; window?: DedupWindow } = {}) {
  const window = options.window ?? { ttlMs: 60_000, maxIds: 100 };
  const asked: Asked[] = [];
  const logged: { fields: Record<string, unknown>; message: string }[] = [];
  const register = {
    idsSince: (merchantId: MerchantId, since: Date, limit: number) => {
      asked.push({ merchantId, since, limit });
      if (options.throws === true) throw new Error("the store is gone");
      return Promise.resolve(options.held ?? []);
    },
  } as unknown as EventLog;
  const logger: Logger = {
    info: () => undefined,
    warn: (fields, message) => logged.push({ fields, message }),
    error: (fields, message) => logged.push({ fields, message }),
  };
  const dedup = recoveringEventDedup({
    dedup: memoryEventDedup({ now: () => NOW }, window),
    register,
    clock: { now: () => NOW },
    window,
    logger,
  });
  return { dedup, asked, logged };
}

describe("recoveringEventDedup", () => {
  it("counts an id the register already holds as a duplicate", async () => {
    const { dedup } = subject({ held: ids("evt_00000001") });

    expect(await dedup.claim(A, ids("evt_00000001", "evt_00000002"))).toEqual(new Set(ids("evt_00000002")));
  });

  it("rebuilds once per merchant and per boot, and each merchant on its own", async () => {
    const { dedup, asked } = subject();

    await dedup.claim(A, ids("evt_00000001"));
    await dedup.claim(A, ids("evt_00000002"));
    await dedup.claim(B, ids("evt_00000003"));

    expect(asked.map((ask) => ask.merchantId)).toEqual([A, B]);
  });

  it("asks for the window's own bounds and nothing wider", async () => {
    const { dedup, asked } = subject({ window: { ttlMs: 30_000, maxIds: 7 } });

    await dedup.claim(A, ids("evt_00000001"));

    expect(asked[0]?.limit).toBe(7);
    expect(asked[0]?.since).toEqual(new Date(NOW.getTime() - 30_000));
  });

  it("keeps the most recent ids when the rebuild does not fit in the window", async () => {
    // The register answers most recent first and the window evicts the oldest **entered**, so the
    // rebuild has to enter them the other way round. Claimed in the order received, the cap would keep
    // the oldest ids and forget the newest — the opposite of what the window promises.
    const { dedup } = subject({ held: ids("evt_b", "evt_a"), window: { ttlMs: 60_000, maxIds: 2 } });

    // The rebuild fills the window with a and b; this claim enters a third id and evicts one.
    expect(await dedup.claim(A, ids("evt_c"))).toEqual(new Set(ids("evt_c")));
    // The newest of the two rebuilt ones survived, so it is still a duplicate.
    expect(await dedup.claim(A, ids("evt_b"))).toEqual(new Set());
    // And the oldest was the one that left, which is the eviction the window declares.
    expect(await dedup.claim(A, ids("evt_a"))).toEqual(new Set(ids("evt_a")));
  });

  it("answers the claim when the register cannot be read, and says so once", async () => {
    // The property this file exists for. An ingest that fails because the rebuild failed would trade a
    // duplicate counted twice — a dirty figure — for a batch of events lost.
    const { dedup, asked, logged } = subject({ throws: true });

    expect(await dedup.claim(A, ids("evt_00000001"))).toEqual(new Set(ids("evt_00000001")));
    expect(logged).toHaveLength(1);
    // **Which merchant, and why**: a warning that says a rebuild failed and not whose is a line nobody
    // can act on — every merchant of the platform goes through here.
    expect(logged[0]?.fields).toMatchObject({ merchantId: A, cause: "the store is gone" });

    // And it does not try again on the next batch: on the path of every request, a store that is down
    // would otherwise cost a failed read per batch for as long as it is down.
    expect(await dedup.claim(A, ids("evt_00000002"))).toEqual(new Set(ids("evt_00000002")));
    expect(asked).toHaveLength(1);
    expect(logged).toHaveLength(1);
  });

  it("does not ask the register twice when two batches of a merchant arrive at once", async () => {
    // The mark cannot be "I started": two batches that interleave would both read, and the second
    // could claim before the first rebuild landed. What is shared is the rebuild itself.
    const { dedup, asked } = subject({ held: ids("evt_00000001") });

    const [first, second] = await Promise.all([
      dedup.claim(A, ids("evt_00000001")),
      dedup.claim(A, ids("evt_00000001")),
    ]);

    expect(asked).toHaveLength(1);
    // Whichever ran first, the id was already in the window: neither reports it as new.
    expect([...first, ...second]).toEqual([]);
  });
});
