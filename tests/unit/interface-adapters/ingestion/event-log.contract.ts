// The contract of `EventLog`, written once and run against **both** implementations.
//
// It is one file and not two because the two must not be able to diverge: in feature 030 this is what
// made the in-memory ledger and the SQLite one end up refusing an overwrite the same way, instead of
// the behaviour depending on the deployment. A test per implementation would have let each one drift
// to whatever its own author found natural.
//
// The durable half runs from `tests/durability/`, because a store on a file is what that suite is for;
// the in-memory half runs in the `fast` project. This file knows neither, and takes a factory.
import { expect, it } from "vitest";
import {
  asBatchId,
  asEventId,
  type AddedToCart,
  type DecidedArrival,
  type Event,
  type EventType,
  type ProductViewed,
  type RecordedEvent,
  type RejectedArrival,
} from "../../../../src/domain/ingestion/index.js";
import { asDecisionId } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import type { EventLog } from "../../../../src/application/ingestion/index.js";

const ONE = asMerchantId("m-one");
const OTHER = asMerchantId("m-other");
const at = (ms: number): Date => new Date(Date.UTC(2026, 8, 28, 12, 0, 0, ms));

// Not exported: the arrivals below are what a suite builds on, and a second way to build an event
// outside this file would be a second idea of what a typical one looks like.
const event = (over: Partial<ProductViewed> = {}): Event => ({
  type: "product_viewed",
  eventId: asEventId("evt_00000001"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  occurredAt: at(0),
  page: { pageType: "product", productId: "SKU-1" },
  device: "mobile",
  ...over,
});

/** An event of a second type, so the count by type has something to separate. */
const addedToCart = (eventId: string): AddedToCart => ({
  type: "added_to_cart",
  eventId: asEventId(eventId),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  occurredAt: at(0),
  page: { pageType: "product", productId: "SKU-1" },
  device: "mobile",
  quantity: 1,
});

export const decided = (over: Partial<DecidedArrival> = {}): DecidedArrival => ({
  merchantId: ONE,
  batchId: asBatchId("bat_00000001"),
  position: 0,
  event: event(),
  receivedAt: at(0),
  disposition: "accepted",
  decisionId: asDecisionId("dec_00000001"),
  arm: "TREATMENT",
  ...over,
});

export const rejected = (over: Partial<RejectedArrival> = {}): RejectedArrival => ({
  merchantId: ONE,
  batchId: asBatchId("bat_00000002"),
  position: 0,
  event: event(),
  receivedAt: at(0),
  disposition: "rejected",
  rejectedBy: "session-visitor-mismatch",
  ...over,
});

/** What a suite gives this contract: a log, and a way to make sure what was recorded has been written. */
export interface LogUnderTest {
  log: EventLog;
  /**
   * Waits for whatever `record` deferred, if the implementation defers anything.
   *
   * Declared as a property holding a function and not as a method, so that destructuring it out of
   * the object is not a method torn from its receiver — which is what `unbound-method` is for.
   */
  settle: () => Promise<void>;
}

/**
 * Runs the whole contract. Called from inside a `describe` of the suite that owns the fixture, which
 * is why it registers `it`s rather than returning them.
 */
export function anEventLog(open: () => LogUnderTest): void {
  it("gives back what it recorded, with both instants and the disposition", async () => {
    const { log, settle } = open();
    log.record([decided()]);
    await settle();

    const found = await log.byDecision(ONE, asDecisionId("dec_00000001"));
    expect(found).toHaveLength(1);
    const [row] = found;
    expect(row?.event.eventId).toBe(asEventId("evt_00000001"));
    expect(row?.event.occurredAt).toEqual(at(0));
    expect(row?.receivedAt).toEqual(at(0));
    expect(row?.disposition).toBe("accepted");
  });

  it("keeps a Date a Date, which JSON does not do by itself", async () => {
    // The `$date` mark of `toDocument`/`fromDocument` is what makes this work, and it is the error
    // that reads fine everywhere and breaks in the one place that matters: a string that looks like
    // an instant has no `getTime`.
    const { log, settle } = open();
    log.record([decided()]);
    await settle();

    const [row] = await log.byDecision(ONE, asDecisionId("dec_00000001"));
    expect(row?.receivedAt).toBeInstanceOf(Date);
    expect(row?.event.occurredAt).toBeInstanceOf(Date);
  });

  it("answers the events of a session in arrival order, which feature 032 depends on", async () => {
    const { log, settle } = open();
    // Recorded out of order on purpose: what orders the answer is the arrival, not the argument.
    log.record([
      decided({ batchId: asBatchId("bat_2"), event: event({ eventId: asEventId("evt_2") }) }),
      decided({ batchId: asBatchId("bat_1"), event: event({ eventId: asEventId("evt_1") }) }),
    ]);
    await settle();

    const rows = await log.bySession(ONE, asSessionId("ses_00000001"));
    expect(rows.map((r) => r.event.eventId)).toEqual([asEventId("evt_2"), asEventId("evt_1")]);
  });

  it("answers every arrival of one event id, oldest first", async () => {
    // The whole point of FR-005: a retry is not a row to replace, it is a second fact. The first of
    // these is the original of the duplicate, which is how the reference is rebuilt.
    const { log, settle } = open();
    log.record([decided()]);
    log.record([
      decided({ batchId: asBatchId("bat_00000009"), disposition: "duplicate", receivedAt: at(5) }),
    ]);
    await settle();

    const arrivals = await log.byEvent(ONE, asEventId("evt_00000001"));
    expect(arrivals.map((a) => a.disposition)).toEqual(["accepted", "duplicate"]);
  });

  it("records a rejected batch with its invariant and no decision", async () => {
    const { log, settle } = open();
    log.record([rejected()]);
    await settle();

    const rows = await log.byEvent(ONE, asEventId("evt_00000001"));
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.disposition).toBe("rejected");
    // Narrowed before reading `rejectedBy`, which only exists on that branch of the union.
    if (row?.disposition !== "rejected") return;
    expect(row.rejectedBy).toBe("session-visitor-mismatch");
  });

  it("counts by type per merchant within the window, in one answer", async () => {
    const { log, settle } = open();
    log.record([
      decided(),
      decided({ batchId: asBatchId("bat_b"), event: event({ eventId: asEventId("evt_2") }) }),
      decided({ batchId: asBatchId("bat_c"), event: addedToCart("evt_3") }),
    ]);
    await settle();

    const volume = await log.volume(ONE, { from: at(0), to: new Date(Date.UTC(2100, 0, 1)) });
    const byType = new Map<EventType, number>(volume.map((v) => [v.type, v.count]));
    expect(byType.get("product_viewed")).toBe(2);
    expect(byType.get("added_to_cart")).toBe(1);
  });

  it("answers only what the key asks for, within one merchant", async () => {
    // The mutation gate found this missing, and it was the same omission on all three reads: every
    // test had **one** row per merchant, so a read that ignored its key answered the same as one that
    // honoured it. Two rows of the same merchant under different keys is what tells them apart.
    const under = open();
    under.log.record([
      decided(),
      decided({
        batchId: asBatchId("bat_other_key"),
        decisionId: asDecisionId("dec_00000002"),
        event: event({ eventId: asEventId("evt_2"), sessionId: asSessionId("ses_00000002") }),
      }),
    ]);
    await under.settle();

    expect(await under.log.byDecision(ONE, asDecisionId("dec_00000001"))).toHaveLength(1);
    expect(await under.log.bySession(ONE, asSessionId("ses_00000001"))).toHaveLength(1);
    expect(await under.log.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
  });

  it("counts only what the window covers, on both sides and at its edges", async () => {
    // Also found by the mutation gate: every window in these tests covered everything recorded, so a
    // filter that let everything through was indistinguishable from one that filtered. The edges are
    // here on purpose — the interval is closed, and `>=`/`>` is exactly what a mutant swaps.
    const under = open();
    under.log.record([
      decided({ batchId: asBatchId("bat_before"), receivedAt: at(0) }),
      decided({ batchId: asBatchId("bat_from"), receivedAt: at(10) }),
      decided({ batchId: asBatchId("bat_to"), receivedAt: at(20) }),
      decided({ batchId: asBatchId("bat_after"), receivedAt: at(30) }),
    ]);
    await under.settle();

    // Both edges included, both outsides excluded: two of the four.
    expect(await under.log.volume(ONE, { from: at(10), to: at(20) })).toEqual([
      { type: "product_viewed", count: 2 },
    ]);
    // A window that ends before anything arrived counts nothing, which is not the same as an empty log.
    expect(await under.log.volume(ONE, { from: at(1), to: at(9) })).toEqual([]);
  });

  it("answers the ids of a merchant since an instant, most recent first", async () => {
    // What rebuilds the deduplication window after a restart (feature 033). The order is the promise:
    // the window keeps the most recent ids, so a rebuild that read them oldest first would fill it with
    // the ones about to expire.
    const under = open();
    under.log.record([
      decided({
        batchId: asBatchId("bat_1"),
        event: event({ eventId: asEventId("evt_1") }),
        receivedAt: at(0),
      }),
      decided({
        batchId: asBatchId("bat_2"),
        event: event({ eventId: asEventId("evt_2") }),
        receivedAt: at(10),
      }),
      decided({
        batchId: asBatchId("bat_3"),
        event: event({ eventId: asEventId("evt_3") }),
        receivedAt: at(20),
      }),
    ]);
    await under.settle();

    expect(await under.log.idsSince(ONE, at(0), 10)).toEqual(["evt_3", "evt_2", "evt_1"]);
  });

  it("stops at the limit, keeping the most recent, and leaves out what is older than asked", async () => {
    // Both bounds are the window's own, so both are checked. The instant is inclusive on its edge, like
    // the window of `volume`: an arrival exactly at it is inside.
    const under = open();
    under.log.record([
      decided({
        batchId: asBatchId("bat_1"),
        event: event({ eventId: asEventId("evt_1") }),
        receivedAt: at(0),
      }),
      decided({
        batchId: asBatchId("bat_2"),
        event: event({ eventId: asEventId("evt_2") }),
        receivedAt: at(10),
      }),
      decided({
        batchId: asBatchId("bat_3"),
        event: event({ eventId: asEventId("evt_3") }),
        receivedAt: at(20),
      }),
    ]);
    await under.settle();

    expect(await under.log.idsSince(ONE, at(0), 2)).toEqual(["evt_3", "evt_2"]);
    expect(await under.log.idsSince(ONE, at(10), 10)).toEqual(["evt_3", "evt_2"]);
    expect(await under.log.idsSince(ONE, at(21), 10)).toEqual([]);
  });

  it("answers an id once per arrival, because an arrival is a fact", async () => {
    // The port says so rather than de-duplicating: whoever rebuilds a set does not care, and a
    // `DISTINCT` here would hide which of the two this read promises.
    const under = open();
    under.log.record([
      decided({ batchId: asBatchId("bat_1"), receivedAt: at(0) }),
      decided({ batchId: asBatchId("bat_2"), receivedAt: at(10) }),
    ]);
    await under.settle();

    expect(await under.log.idsSince(ONE, at(0), 10)).toEqual(["evt_00000001", "evt_00000001"]);
  });

  it("shows nothing of another merchant, on every read", async () => {
    // Constitution V, and it is checked on **all five** reads rather than a sample: an isolation that
    // holds on four of them is not isolation.
    const { log, settle } = open();
    log.record([decided(), decided({ merchantId: OTHER, batchId: asBatchId("bat_other") })]);
    await settle();

    expect(await log.byDecision(OTHER, asDecisionId("dec_00000001"))).toHaveLength(1);
    expect(await log.byDecision(ONE, asDecisionId("dec_00000001"))).toHaveLength(1);
    expect(await log.bySession(OTHER, asSessionId("ses_00000001"))).toHaveLength(1);
    expect(await log.byEvent(OTHER, asEventId("evt_00000001"))).toHaveLength(1);
    expect(await log.volume(OTHER, { from: at(0), to: new Date(Date.UTC(2100, 0, 1)) })).toEqual([
      { type: "product_viewed", count: 1 },
    ]);
    expect(await log.idsSince(OTHER, at(0), 10)).toEqual(["evt_00000001"]);
  });

  it("answers a repetition whose original is missing, without pretending it is the first", async () => {
    // **The reference to the original can be absent, and that is correct** (research R-08). The pointer
    // is not stored: it is rebuilt by asking for every arrival of the event id, and the first one is the
    // original. If that first arrival never made it — lost to an abrupt shutdown — the repetition is
    // still there with its own disposition and there is simply nothing before it.
    //
    // Which is coherent with Q3: the register does not promise completeness, it promises to know where
    // it does not have it. A duplicate that claimed to be a first arrival would be the opposite.
    const under = open();
    under.log.record([decided({ batchId: asBatchId("bat_only_the_retry"), disposition: "duplicate" })]);
    await under.settle();

    const arrivals = await under.log.byEvent(ONE, asEventId("evt_00000001"));
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]?.disposition).toBe("duplicate");
  });

  it("answers nothing for what it never recorded, which is not an error", async () => {
    const { log } = open();
    expect(await log.byDecision(ONE, asDecisionId("dec_never"))).toEqual([]);
    expect(await log.bySession(ONE, asSessionId("ses_never"))).toEqual([]);
    expect(await log.byEvent(ONE, asEventId("evt_never"))).toEqual([]);
    expect(await log.volume(ONE, { from: at(0), to: at(1) })).toEqual([]);
  });

  it("takes the same arrival twice without making a second row of it", async () => {
    // `(merchant, batch, position)` is the identity of an arrival, so handing the same one over twice
    // — which a queue that retried would do — is a repetition and not a new fact.
    const { log, settle } = open();
    const twice: RecordedEvent[] = [decided(), decided()];
    log.record(twice);
    await settle();

    expect(await log.byEvent(ONE, asEventId("evt_00000001"))).toHaveLength(1);
  });
}
