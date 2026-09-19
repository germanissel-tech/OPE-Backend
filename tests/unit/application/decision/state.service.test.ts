// Feature 012: the state service recalls session and visitor together, empty when nothing was remembered.
import { describe, expect, it } from "vitest";
import {
  DefaultStateService,
  SESSION_WINDOW,
  VISITOR_WINDOW,
} from "../../../../src/application/decision/index.js";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { SessionState, VisitorState } from "../../../../src/domain/decision/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { memorySessionStateStore } from "../../../../src/interface-adapters/gateways/decision/memory-session-state-store.js";
import { memoryVisitorStateStore } from "../../../../src/interface-adapters/gateways/decision/memory-visitor-state-store.js";
import { addedToCart } from "../../../helpers/events.js";

const now = new Date("2026-09-19T12:00:00.000Z");
const whose = {
  merchantId: asMerchantId("m_a"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
};

describe("DefaultStateService", () => {
  const clock = { now: () => now };
  const service = new DefaultStateService({
    sessions: memorySessionStateStore(clock, SESSION_WINDOW),
    visitors: memoryVisitorStateStore(clock, VISITOR_WINDOW),
  });

  it("recalls empty state for an unknown session and visitor", async () => {
    const { session, visitor } = await service.recall(whose, now);
    expect(session.signals.isEmpty()).toBe(true);
    expect(session.updatedAt).toBe(now);
    expect(visitor.interventions).toEqual([]);
  });

  it("remembers both and recalls them as they were", async () => {
    const session = SessionState.empty(now)
      .absorb(Signals.of([addedToCart(1)]), now)
      .withIntervention(now);
    const visitor = VisitorState.empty().withIntervention(now, VISITOR_WINDOW.ttlMs);
    await service.remember(whose, { session, visitor });
    const recalled = await service.recall(whose, now);
    expect(recalled.session).toBe(session);
    expect(recalled.visitor).toBe(visitor);
    const other = await service.recall({ ...whose, visitorId: asVisitorId("vis_00000002") }, now);
    expect(other.visitor.interventions).toEqual([]);
    expect(other.session).toBe(session);
  });

  it("remembers the session alone when the visitor did not change", async () => {
    const before = (await service.recall(whose, now)).visitor;
    const session = SessionState.empty(now).absorb(Signals.of([addedToCart(2)]), now);
    await service.remember(whose, { session });
    const recalled = await service.recall(whose, now);
    expect(recalled.session).toBe(session);
    expect(recalled.visitor).toBe(before);
  });
});
