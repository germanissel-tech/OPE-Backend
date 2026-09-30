// The queue: what it defers, what it drops, and what it drains. It runs the shared contract too —
// wrapping a log must not change what a log answers — and then the four things only it does.
import { afterEach, describe, expect, it, vi } from "vitest";
import { asEventId } from "../../../../src/domain/ingestion/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryEventLog, queuedEventLog } from "../../../../src/interface-adapters/ingestion/index.js";
import { anEventLog, decided } from "./event-log.contract.js";
import type { EventLog } from "../../../../src/application/ingestion/index.js";
import type { Logger } from "../../../../src/application/shared-kernel/index.js";

const ONE = asMerchantId("m-one");

function said(): { logger: Logger; lines: { fields: Record<string, unknown>; message: string }[] } {
  const lines: { fields: Record<string, unknown>; message: string }[] = [];
  const record = (fields: Record<string, unknown>, message: string): void => {
    lines.push({ fields, message });
  };
  return { logger: { info: record, warn: record, error: record }, lines };
}

/** Never on its own: a test that wants a write asks for it, so nothing here depends on a timer. */
const NEVER_MS = 60_000;

/** A queue over a fresh writer, with the two knobs defaulted to "roomy" and "never", and a free store. */
function queueOver(
  writer: EventLog,
  over: Partial<{
    logger: Logger;
    maxArrivals: number;
    flushIntervalMs: number;
    busy: () => boolean;
  }> = {},
) {
  return queuedEventLog({
    writer,
    logger: said().logger,
    maxArrivals: 100,
    flushIntervalMs: NEVER_MS,
    busy: () => false,
    ...over,
  });
}

describe("queuedEventLog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Wrapping must not change any answer, so the whole contract runs through it. `settle` is where the
  // difference lives: here it has to flush, and that is the only line of the contract that knows a
  // queue might exist.
  describe("answers everything a log answers", () => {
    anEventLog(() => {
      const queue = queueOver(memoryEventLog());
      return {
        log: queue,
        settle: () => {
          queue.flush();
          return Promise.resolve();
        },
      };
    });
  });

  it("does not write when it is given something, which is the whole requirement", async () => {
    // FR-007 seen from the inside: after `record` the writer has nothing, because nothing waited.
    const writer = memoryEventLog();
    const queue = queueOver(writer);

    queue.record([decided()]);
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toEqual([]);

    queue.flush();
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
  });

  it("writes on its own interval, without anyone asking", async () => {
    vi.useFakeTimers();
    const writer = memoryEventLog();
    const queue = queueOver(writer, { flushIntervalMs: 250 });

    queue.record([decided()]);
    vi.advanceTimersByTime(250);

    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
    queue.close();
  });

  it("drains what is pending when it closes, which is what an orderly shutdown does", async () => {
    const writer = memoryEventLog();
    const queue = queueOver(writer);

    queue.record([decided()]);
    // Without the drain this would be lost: the interval is a minute away and the process is going.
    queue.close();

    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
  });

  it("drops what does not fit and says how much, instead of waiting for room", async () => {
    const writer = memoryEventLog();
    const heard = said();
    const queue = queueOver(writer, { logger: heard.logger, maxArrivals: 1 });

    queue.record([decided(), decided({ position: 1 }), decided({ position: 2 })]);

    expect(heard.lines).toHaveLength(1);
    expect(heard.lines[0]?.message).toBe(
      "The event register queue is full; those arrivals were not recorded.",
    );
    expect(heard.lines[0]?.fields["dropped"]).toBe(2);
    // The one that fitted is still written: a full queue loses the surplus, not everything.
    queue.close();
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
  });

  it("says nothing when nothing was dropped", () => {
    const heard = said();
    const queue = queueOver(memoryEventLog(), { logger: heard.logger });

    queue.record([decided()]);
    queue.close();
    expect(heard.lines).toEqual([]);
  });

  it("does not touch the writer when there is nothing pending", () => {
    // The guard that skips an empty flush has a cost to justify: without it the interval would open a
    // transaction against the store every quarter of a second forever, for nothing. Nothing else
    // observes it, so this is what observes it.
    let writes = 0;
    const counting: EventLog = {
      ...memoryEventLog(),
      record() {
        writes += 1;
      },
    };
    const queue = queueOver(counting);

    queue.flush();
    queue.close();
    expect(writes).toBe(0);
  });

  it("is never the reason a process stays alive", () => {
    // A repeating timer holds the event loop, so without `unref` a process with nothing left to do
    // would hang until someone closed the queue. The effect is observable without spawning anything:
    // Node lists the resources keeping the loop alive, and an unreferenced timer is **not** among them.
    const timersBefore = process.getActiveResourcesInfo().filter((kind) => kind === "Timeout").length;
    const queue = queueOver(memoryEventLog());
    try {
      expect(process.getActiveResourcesInfo().filter((kind) => kind === "Timeout").length).toBe(timersBefore);
    } finally {
      queue.close();
    }
  });

  it("stops flushing once it is closed, which is what closing means", () => {
    // The mutation gate asked for this: dropping `clearInterval` left a queue that kept writing after
    // it was closed, and nothing noticed. The effect is what is observed here, not the call.
    vi.useFakeTimers();
    let writes = 0;
    const counting: EventLog = {
      ...memoryEventLog(),
      record() {
        writes += 1;
      },
    };
    const queue = queueOver(counting, { flushIntervalMs: 100 });

    queue.close();
    queue.record([decided()]);
    vi.advanceTimersByTime(1_000);

    expect(writes).toBe(0);
  });

  it("does not write and does not lose while somebody else's unit of work is open", async () => {
    // **Feature 034, US2.** An administration action holds the store for the length of one local write,
    // and the register cannot wait for it: `flush` is synchronous and `record` returns `void` on purpose,
    // so that nobody can wait for a measurement (ADR-039, principle IV). What it does instead is what a
    // queue is for — it keeps the arrivals and takes them next time.
    //
    // Without the question this is a **loss**, not a delay: the write would reach the store, the guard
    // would throw because it did not wait its turn, and the gateway would log those arrivals as lost.
    let busy = true;
    const writer = memoryEventLog();
    const queue = queueOver(writer, { busy: () => busy });

    queue.record([decided(), decided({ position: 1 })]);
    queue.flush();
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toEqual([]);

    busy = false;
    queue.flush();
    // The **two** of them, and once each: what was held is written whole, not half and not twice.
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(2);
    queue.close();
    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(2);
  });

  it("asks again on each flush, so a busy store delays nothing beyond its own unit", () => {
    // The question is asked per flush and not remembered: a queue that had learned "busy" once would
    // stay quiet after the unit closed, which is the failure this shape cannot have.
    let asked = 0;
    let writes = 0;
    const counting: EventLog = {
      ...memoryEventLog(),
      record() {
        writes += 1;
      },
    };
    const queue = queueOver(counting, {
      busy: () => {
        asked += 1;
        return asked === 1;
      },
    });

    queue.record([decided()]);
    queue.flush();
    expect(writes).toBe(0);
    queue.flush();
    expect(writes).toBe(1);
    queue.close();
  });

  it("says so when a unit is still open at shutdown, instead of losing them in silence", () => {
    // The one case where "next time" does not exist. The server closes before the store and waits for
    // its requests, so a unit open here is already unusual — and unusual and silent is what feature 031
    // forbade for every other loss of the register (FR-018). It is said with the same voice.
    const heard = said();
    const queue = queueOver(memoryEventLog(), { logger: heard.logger, busy: () => true });

    queue.record([decided()]);
    queue.close();

    expect(heard.lines).toHaveLength(1);
    expect(heard.lines[0]?.message).toBe(
      "A unit of work was open when the event register drained; those arrivals were not recorded.",
    );
    expect(heard.lines[0]?.fields["held"]).toBe(1);
  });

  it("writes nothing twice when a flush happens while one is in flight", async () => {
    // What is pending is taken **before** the write and replaced with an empty list, so an arrival
    // that comes in during the write waits for the next one instead of being written twice.
    const writer = memoryEventLog();
    const queue = queueOver(writer);

    queue.record([decided()]);
    queue.flush();
    queue.flush();

    expect(await writer.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
    queue.close();
  });
});
