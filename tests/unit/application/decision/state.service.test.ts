// Feature 012: the state service recalls session and visitor together, empty when nothing was
// remembered; since feature 017 it applies the visitor window of the platform (level 1) when it
// counts the interventions a visitor received and when it records one.
import { describe, expect, it } from "vitest";
import { States } from "../../../../src/application/decision/index.js";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { SessionState } from "../../../../src/domain/decision/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { memorySessionStateStore } from "../../../../src/interface-adapters/decision/gateways/memory-session-state-store.js";
import { memoryVisitorStateStore } from "../../../../src/interface-adapters/decision/gateways/memory-visitor-state-store.js";
import { addedToCart } from "../../../helpers/events.js";
import { testVisitorWindow } from "../../../helpers/platform.js";

const now = new Date("2026-09-19T12:00:00.000Z");
const later = (ms: number): Date => new Date(now.getTime() + ms);
const whose = {
  merchantId: asMerchantId("m_a"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
};

/** Built inside each test: what a file evaluates while it loads is static for the mutation gate. */
function subject() {
  const clock = { now: () => now };
  const window = testVisitorWindow();
  const service = new States({
    sessions: memorySessionStateStore(clock, { ttlMs: window.ttlMs, maxSessions: 100 }),
    visitors: memoryVisitorStateStore(clock, window),
    visitorWindow: window,
  });
  return { service, window };
}

describe("States", () => {
  it("recalls empty state for an unknown session and visitor", async () => {
    const { service } = subject();
    const { session, visitor, visitorInterventions } = await service.recall(whose, now);
    expect(session.signals.isEmpty()).toBe(true);
    expect(session.updatedAt).toBe(now);
    expect(visitor.interventions).toEqual([]);
    expect(visitorInterventions).toBe(0);
  });

  it("remembers the session and the intervention of the visitor, and counts it within the window", async () => {
    const { service, window } = subject();
    const session = SessionState.empty(now)
      .absorb(Signals.of([addedToCart(1)]), now)
      .withIntervention(now);
    const { visitor } = await service.recall(whose, now);
    await service.remember(whose, { session, intervention: { visitor, at: now } });
    const recalled = await service.recall(whose, now);
    expect(recalled.session).toBe(session);
    expect(recalled.visitor.interventions).toEqual([now]);
    expect(recalled.visitorInterventions).toBe(1);
    expect((await service.recall(whose, later(window.ttlMs))).visitorInterventions).toBe(0);
    const other = await service.recall({ ...whose, visitorId: asVisitorId("vis_00000002") }, now);
    expect(other.visitor.interventions).toEqual([]);
    expect(other.session).toBe(session);
  });

  it("remembers the session alone when the visitor did not change", async () => {
    const { service } = subject();
    const before = (await service.recall(whose, now)).visitor;
    const session = SessionState.empty(now).absorb(Signals.of([addedToCart(2)]), now);
    await service.remember(whose, { session });
    const recalled = await service.recall(whose, now);
    expect(recalled.session).toBe(session);
    expect(recalled.visitor.interventions).toEqual(before.interventions);
  });
});
