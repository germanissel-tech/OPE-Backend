// Feature 031, US1 (FR-001..FR-004, SC-001, SC-002): from the click to the verdict and back, through
// the real server. The gateway tests prove the reads; this one proves the whole path — a `POST` of a
// batch, the queue draining when the app stops, and the register answering with what arrived.
//
// **Why it reads after `close()`**: the queue does not write when it is given something (that is the
// requirement), and in tests its interval is an hour away, so nothing would be there yet. Closing the
// app drains it — which is FR-017 — so this test exercises that at the same time. The in-memory
// register outlives the graph, so what it wrote is still readable.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { EventLogPort } from "../../src/composition/modules/ingestion.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asEventId } from "../../src/domain/ingestion/index.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { testExperiment } from "../helpers/experiments.js";
import { json } from "../helpers/json.js";
import { batchOf, eventOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { EventLog } from "../../src/application/ingestion/index.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-18T12:00:00.000Z";
const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const KEY_A = "key-a-1";
const KEY_B = "key-b-1";

describe("the event register, end to end", () => {
  let app: App;
  let log: EventLog;
  let stopped = false;

  beforeEach(async () => {
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] });
    log = app.resolve(EventLogPort);
    stopped = false;
  });

  afterEach(async () => {
    // Only if the test did not stop it already: a test that reads the register has to drain it first,
    // and draining is what stopping does.
    if (!stopped) await app.close();
  });

  /** Stops the app so the queue drains; what the register holds is readable afterwards. */
  const drained = async (): Promise<void> => {
    await app.close();
    stopped = true;
  };

  it("goes from the decision to what the SDK sent, and from an event back to its decision", async () => {
    const response = await postEvents(app.app, batchOf(3), { key: KEY_A });
    expect(response.statusCode).toBe(202);
    const { decisionId } = (json(response) as IngestResult).decision;
    await drained();

    // From the decision to what arrived (SC-001): three events, in the order they were sent.
    const arrived = await log.byDecision(A, asDecisionId(decisionId));
    expect(arrived).toHaveLength(3);
    expect(arrived.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(arrived.map((row) => row.event.eventId)).toEqual([
      asEventId("evt_00000001"),
      asEventId("evt_00000002"),
      asEventId("evt_00000003"),
    ]);

    // And from an event back to the decision it produced (SC-002) — **including a NO_OP**, which is
    // what almost every batch of a merchant without evidence produces, and the case that would be
    // missing if only interventions were recorded.
    const [back] = await log.byEvent(A, asEventId("evt_00000001"));
    expect(back?.disposition).toBe("accepted");
    if (back === undefined || back.disposition === "rejected") return;
    expect(back.decisionId).toBe(decisionId);
  });

  it("records when OPE received the batch, which is not when the client says it happened", async () => {
    // FR-002. The clock is fixed at NOW and the events declare an instant an hour earlier, so the two
    // cannot be confused by coincidence.
    const earlier = "2026-09-18T11:00:00.000Z";
    await postEvents(app.app, { events: [eventOf(1, { occurredAt: earlier })] }, { key: KEY_A });
    await drained();

    const [row] = await log.bySession(A, asSessionId("ses_00000001"));
    expect(row?.receivedAt).toEqual(new Date(NOW));
    expect(row?.event.occurredAt).toEqual(new Date(earlier));
  });

  it("answers the events of a session in the order they arrived, across two batches", async () => {
    // FR-013, and it is what feature 032 will read to rebuild the signals a decision was taken with.
    await postEvents(app.app, batchOf(2, 1), { key: KEY_A });
    await postEvents(app.app, batchOf(2, 3), { key: KEY_A });
    await drained();

    const rows = await log.bySession(A, asSessionId("ses_00000001"));
    expect(rows.map((row) => row.event.eventId)).toEqual([
      asEventId("evt_00000001"),
      asEventId("evt_00000002"),
      asEventId("evt_00000003"),
      asEventId("evt_00000004"),
    ]);
    // Two arrivals, so two batch identifiers: the register groups by arrival and not by session.
    expect(new Set(rows.map((row) => row.batchId)).size).toBe(2);
  });

  it("shows a merchant nothing of another merchant's traffic", async () => {
    // Constitution V through the whole path, which is where a missing predicate would show up: both
    // merchants send the **same** event ids and session, so only the credential tells them apart.
    await postEvents(app.app, batchOf(2), { key: KEY_A });
    await postEvents(app.app, batchOf(2), { key: KEY_B });
    await drained();

    expect(await log.bySession(A, asSessionId("ses_00000001"))).toHaveLength(2);
    expect(await log.bySession(B, asSessionId("ses_00000001"))).toHaveLength(2);
    const [mine] = await log.byEvent(A, asEventId("evt_00000001"));
    expect(mine?.merchantId).toBe(A);
  });

  it("records no arm when the merchant has no active experiment, and never invents CONTROL", async () => {
    // Merchant B is the one **without** an experiment — A has one, which this test assumed wrongly at
    // first and the run corrected. The absence is meaningful: writing CONTROL here would put traffic
    // that was never in an experiment into the control group of the pilot's own figures.
    await postEvents(app.app, batchOf(1), { key: KEY_B });
    await drained();

    const [row] = await log.bySession(B, asSessionId("ses_00000001"));
    expect(row?.disposition).not.toBe("rejected");
    if (row === undefined || row.disposition === "rejected") return;
    expect(row.arm).toBeUndefined();
  });

  it("records a repeated batch as repetitions, and the response still counts them as duplicates", async () => {
    // The same batch posted twice is what a retrying SDK does. The response says two duplicates; the
    // register keeps **four** rows, because each arrival is a fact (FR-005) — and that difference is
    // exactly what makes the register forensic instead of a picture of what OPE accepted.
    await postEvents(app.app, batchOf(2), { key: KEY_A });
    const again = await postEvents(app.app, batchOf(2), { key: KEY_A });
    expect((json(again) as IngestResult).duplicates).toBe(2);
    await drained();

    expect(await log.bySession(A, asSessionId("ses_00000001"))).toHaveLength(4);
    const arrivals = await log.byEvent(A, asEventId("evt_00000001"));
    expect(arrivals.map((row) => row.disposition)).toEqual(["accepted", "duplicate"]);
  });

  describe("what was discarded (US2)", () => {
    it("tells a merchant that sent nothing from one whose traffic was refused", async () => {
      // **SC-003, and it is impossible today.** A refused batch gets a `422` and leaves nothing behind,
      // so the operator sees the same silence in both cases — and only one of the two has a fix.
      const refused = await postEvents(
        app.app,
        { events: [eventOf(1, { visitorId: "vis_00000001" }), eventOf(2, { visitorId: "vis_00000002" })] },
        { key: KEY_A },
      );
      expect(refused.statusCode).toBe(422);
      await drained();

      // A: refused traffic, and the register says so with the invariant that refused it.
      const rows = await log.bySession(A, asSessionId("ses_00000001"));
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.disposition === "rejected")).toBe(true);
      // B: nothing at all, which is the other answer and now a different one.
      expect(await log.bySession(B, asSessionId("ses_00000001"))).toEqual([]);
    });

    it("names the invariant that refused the batch, not just that something failed", async () => {
      // Two different invariants, so the register has to distinguish them: an operator fixes a clock
      // and a mixed batch in completely different ways.
      const stale = "2020-01-01T00:00:00.000Z";
      await postEvents(app.app, { events: [eventOf(7, { occurredAt: stale })] }, { key: KEY_A });
      await drained();

      const [row] = await log.byEvent(A, asEventId("evt_00000007"));
      expect(row?.disposition).toBe("rejected");
      if (row?.disposition !== "rejected") return;
      expect(row.rejectedBy).toBe("event-timestamp-out-of-range");
    });

    it("keeps a refused batch out of the accepted counts, because it was not accepted", async () => {
      // The register is not a second source of truth about what OPE acted on: the volume of FR-012
      // counts arrivals, and the disposition is what separates them. Recording the refusal must not
      // make it look like traffic that entered.
      await postEvents(app.app, batchOf(2), { key: KEY_A });
      await postEvents(
        app.app,
        { events: [eventOf(8, { visitorId: "vis_00000001" }), eventOf(9, { visitorId: "vis_00000002" })] },
        { key: KEY_A },
      );
      await drained();

      const rows = await log.bySession(A, asSessionId("ses_00000001"));
      expect(rows.filter((row) => row.disposition === "accepted")).toHaveLength(2);
      expect(rows.filter((row) => row.disposition === "rejected")).toHaveLength(2);
    });
  });

  describe("with an experiment running", () => {
    // The whole reason FR-004 exists: the pilot compares CONTROL against TREATMENT, so what arrived has
    // to say which one it arrived with. A separate app because the merchant needs an experiment, and
    // the visitors are chosen with the domain's own assignment so the test does not guess an arm.
    const EXPERIMENT_ID = "exp_a_5050001";
    const merchantWithExperiment = {
      merchantId: "m_a",
      ingestKeys: [KEY_A],
      origins: ["https://a.example"],
      experiments: [
        {
          experimentId: EXPERIMENT_ID,
          treatmentShare: 0.5,
          seed: "seed-5050",
          status: "active" as const,
          openedAt: NOW,
        },
      ],
    };
    const experiment = testExperiment({
      experimentId: EXPERIMENT_ID,
      treatmentShare: 0.5,
      seed: "seed-5050",
      openedAt: new Date(NOW),
    });
    const visitorIn = (arm: "CONTROL" | "TREATMENT"): string => {
      for (let n = 1; n < 10_000; n += 1) {
        const id = `vis_${String(n).padStart(8, "0")}`;
        if (experiment.assign(asVisitorId(id)) === arm) return id;
      }
      throw new Error(`no visitor found for ${arm}`);
    };

    beforeEach(async () => {
      await app.close();
      app = await startTestApp(
        { ports: [replace(ClockPort, fixedClock(NOW))] },
        { merchants: [merchantWithExperiment] },
      );
      log = app.resolve(EventLogPort);
      stopped = false;
    });

    it.each(["CONTROL", "TREATMENT"] as const)("records that the traffic arrived with %s", async (arm) => {
      const visitorId = visitorIn(arm);
      await postEvents(app.app, { events: [eventOf(1, { visitorId })] }, { key: KEY_A });
      await drained();

      const [row] = await log.bySession(A, asSessionId("ses_00000001"));
      expect(row?.disposition).not.toBe("rejected");
      if (row === undefined || row.disposition === "rejected") return;
      expect(row.arm).toBe(arm);
    });
  });
});
