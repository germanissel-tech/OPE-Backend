// Feature 012: the state service recalls session and visitor together, empty when nothing was
// remembered; since feature 017 it applies the visitor window of the platform (level 1) when it
// counts the interventions a visitor received and when it records one.
//
// Since feature 032 it has a **third** answer, and the three are what the rest of this file is about:
// remembered decides, forgotten rebuilds, failed degrades. The third one is the reason the shape
// changed at all — without it a failed read and a new visitor are the same value.
import { describe, expect, it } from "vitest";
import {
  States,
  type StateServiceDependencies,
  type PastActivity,
} from "../../../../src/application/decision/index.js";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { SessionState, StateUnavailable } from "../../../../src/domain/decision/index.js";
import {
  asBatchId,
  type DecidedArrival,
  type Event,
  type RecordedEvent,
} from "../../../../src/domain/ingestion/index.js";
import {
  InterveneDecision,
  NoOpDecision,
  asDecisionId,
  type Decision,
  type DecisionFacts,
} from "../../../../src/domain/ledger/index.js";
import {
  asMerchantId,
  asSessionId,
  asVisitorId,
  fail,
  ok,
} from "../../../../src/domain/shared-kernel/index.js";
import { silentLogger } from "../../../../src/infrastructure/logging/pino-logger.js";
import { memorySessionStateStore } from "../../../../src/interface-adapters/decision/gateways/memory-session-state-store.js";
import { memoryVisitorStateStore } from "../../../../src/interface-adapters/decision/gateways/memory-visitor-state-store.js";
import { addedToCart, checkout, variantSelector } from "../../../helpers/events.js";
import { testVisitorWindow } from "../../../helpers/platform.js";
import { testLevels } from "../../../helpers/test-app.js";

const now = new Date("2026-09-19T12:00:00.000Z");
const later = (ms: number): Date => new Date(now.getTime() + ms);
const whose = {
  merchantId: asMerchantId("m_a"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
};

/** Nothing durable: what every test of the hot path had implicitly before this feature. */
const nothingDurable = (): Pick<StateServiceDependencies, "past"> => ({ past: pastActivity().port });

/** Built inside each test: what a file evaluates while it loads is static for the mutation gate. */
function subject(over: Partial<StateServiceDependencies> = {}) {
  const clock = { now: () => now };
  const window = testVisitorWindow();
  const service = new States({
    sessions: memorySessionStateStore(clock, { ttlMs: window.ttlMs, maxSessions: 100 }),
    visitors: memoryVisitorStateStore(clock, window),
    limits: { visitorWindowMs: window.ttlMs, sessionDurationMs: testLevels().platform.sessionDurationMs },
    logger: silentLogger(),
    ...nothingDurable(),
    ...over,
  });
  return { service, window };
}

/** What `recall` answered, or a failure of the test: the three answers are asserted by name below. */
async function recalled(service: States, at: Date = now) {
  const result = await service.recall(whose, at);
  if (!result.ok) throw new Error(`recall failed: ${result.error.message}`);
  return result.value;
}

const facts = (id: string, over: Partial<DecisionFacts> = {}): DecisionFacts => ({
  decisionId: asDecisionId(id),
  merchantId: whose.merchantId,
  sessionId: whose.sessionId,
  visitorId: whose.visitorId,
  decidedAt: now,
  configuration: { platform: "platform-2", defaults: "defaults-1" },
  ...over,
});

const intervened = (id: string, at: Date = now): Decision =>
  InterveneDecision.of(facts(id, { decidedAt: at }), "barrier-fit", {
    text: "If it does not fit, the exchange is free.",
    messageVersionId: "msg-1",
    anchor: "variant_selector",
  });

let arrivals = 0;
/**
 * One row of the register, with the disposition the test is about.
 *
 * `receivedAt` counts up from a minute before `now` and is **not** the instant of the event: it is when
 * OPE received it, and the rebuild measures the age of the session from it. The event helpers date their
 * events a day before `now`, so reusing that here made every rebuilt session look older than its own
 * duration — which the rule of FR-003 then correctly discarded, and three tests said so.
 */
function arrival(event: Event, disposition: RecordedEvent["disposition"]): RecordedEvent {
  arrivals += 1;
  const base = {
    merchantId: whose.merchantId,
    batchId: asBatchId(`bat_${String(arrivals).padStart(8, "0")}`),
    position: 0,
    event,
    receivedAt: later(arrivals * 1000 - 60_000),
  };
  return disposition === "rejected"
    ? { ...base, disposition, rejectedBy: "session-visitor-mismatch" }
    : ({ ...base, disposition, decisionId: asDecisionId("dec_00000001") } satisfies DecidedArrival);
}

/**
 * The three durable reads, as one double.
 *
 * Two things about it are deliberate. `decisionsOfVisitor` **honours `since`**, like both real gateways
 * do: a double that ignored it let a mutant turn `now - window` into `now + window` and nothing
 * noticed, because the exact cut happens later in `countSince` either way. And `failing` names **which**
 * read cannot answer, one at a time, because the whole point of the port is that the three do not fail
 * the same way — a double where they failed together could not tell FR-013 from FR-015.
 */
interface PastOptions {
  arrivals?: readonly RecordedEvent[];
  session?: readonly Decision[];
  visitor?: readonly Decision[];
  failing?: "arrivals" | "session" | "visitor";
}

function pastActivity(over: PastOptions = {}) {
  const asked: Date[] = [];
  const port: PastActivity = {
    arrivalsOf: () =>
      Promise.resolve(
        over.failing === "arrivals" ? fail(new StateUnavailable("session")) : ok(over.arrivals ?? []),
      ),
    decisionsOf: () =>
      Promise.resolve(
        over.failing === "session" ? fail(new StateUnavailable("session")) : ok(over.session ?? []),
      ),
    decisionsOfVisitor: (_merchantId, _visitorId, since) => {
      asked.push(since);
      if (over.failing === "visitor") return Promise.resolve(fail(new StateUnavailable("visitor")));
      return Promise.resolve(ok((over.visitor ?? []).filter((decision) => decision.decidedAt >= since)));
    },
  };
  return { port, asked };
}

describe("States", () => {
  it("recalls empty state for an unknown session and visitor", async () => {
    const { service } = subject();
    const { session, visitor, visitorInterventions } = await recalled(service);
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
    const { visitor } = await recalled(service);
    await service.remember(whose, { session, intervention: { visitor, at: now } });
    const again = await recalled(service);
    expect(again.session).toBe(session);
    expect(again.visitor.interventions).toEqual([now]);
    expect(again.visitorInterventions).toBe(1);
    expect((await recalled(service, later(window.ttlMs))).visitorInterventions).toBe(0);
    const other = await service.recall({ ...whose, visitorId: asVisitorId("vis_00000002") }, now);
    expect(other.ok && other.value.visitor.interventions).toEqual([]);
    expect(other.ok && other.value.session).toBe(session);
  });

  it("remembers the session alone when the visitor did not change", async () => {
    const { service } = subject();
    const before = (await recalled(service)).visitor;
    const session = SessionState.empty(now).absorb(Signals.of([addedToCart(2)]), now);
    await service.remember(whose, { session });
    const again = await recalled(service);
    expect(again.session).toBe(session);
    expect(again.visitor.interventions).toEqual(before.interventions);
  });

  describe("when memory has forgotten (feature 032, FR-004..FR-007)", () => {
    it("rebuilds the session from what arrived and what was already decided", async () => {
      // Nothing was ever saved here, so the hot store answers "I do not remember" — which is the same
      // answer a restart gives, and the whole point: the state comes back without it.
      // **Three arrivals and not two**, because "the last one" is what the rebuild reads and two
      // elements cannot tell it from "the second one": with two, taking index 1 instead of the last is
      // the same value, and a mutant of exactly that survived the first version of this test.
      const first = variantSelector(1);
      const second = addedToCart(2);
      const last = checkout(3);
      const arrived = [arrival(first, "accepted"), arrival(second, "accepted"), arrival(last, "accepted")];
      const { service } = subject({
        past: pastActivity({
          arrivals: arrived,
          session: [intervened("dec_00000002"), NoOpDecision.of(facts("dec_00000003"), "control-arm")],
        }).port,
      });

      const { session } = await recalled(service);
      // The signals are the ones the plane had, asserted through what a rule can ask of them: a
      // `toEqual` on two `Signals` says nothing, because its state is in private fields and every
      // instance therefore compares equal — the first version of this test was vacuous for that reason.
      expect(session.signals.count({ type: first.type })).toBe(1);
      expect(session.signals.count({ type: second.type })).toBe(1);
      expect(session.signals.count({ type: last.type })).toBe(1);
      // And in arrival order, which is what makes "a before b" answerable at all.
      expect(session.signals.sequence({ type: first.type }, { type: second.type })).toBe(true);
      // One intervention, not two: the NO_OP of the same session is not one, and which decisions count
      // is `decision.isIntervention()` and not a filter written here.
      expect(session.interventions).toBe(1);
      expect(session.lastInterventionAt).toEqual(now);
      // When the session last moved, which is when its **last arrival** was received and not now: the
      // cooldown, the window and the duration are measured from it, so stamping the current instant
      // would make an old session look fresh.
      expect(session.updatedAt).toEqual(arrived[2]?.receivedAt);
      expect(session.updatedAt).not.toEqual(arrived[1]?.receivedAt);
    });

    it("rebuilds the visitor from the interventions of the ledger, across sessions", async () => {
      const earlier = later(-1000);
      const ledger = pastActivity({
        visitor: [
          intervened("dec_00000004", earlier),
          intervened("dec_00000005", now),
          NoOpDecision.of(facts("dec_00000006"), "visitor-fatigue"),
        ],
      });
      const { service, window } = subject({ past: ledger.port });

      const { visitor, visitorInterventions } = await recalled(service);
      expect(visitor.interventions).toEqual([earlier, now]);
      expect(visitorInterventions).toBe(2);
      // And the ledger was asked for the window **behind** now, which is the one direction that can be
      // wrong without changing this answer: the exact cut happens afterwards in `countSince`, so a
      // bound pointing forward would only show up as a store asked for the wrong range.
      expect(ledger.asked).toEqual([later(-window.ttlMs)]);
    });

    it("asks the ledger only for the window, so an intervention older than it never arrives", async () => {
      const window = testVisitorWindow();
      const ledger = pastActivity({
        visitor: [intervened("dec_00000007", later(-window.ttlMs - 1)), intervened("dec_00000008", now)],
      });
      const { service } = subject({ past: ledger.port });

      const { visitor, visitorInterventions } = await recalled(service);
      expect(visitor.interventions).toEqual([now]);
      expect(visitorInterventions).toBe(1);
    });

    it("answers a session nothing is known of as a new one, which it is", async () => {
      // The one case where the two old answers were right: nothing in memory and nothing durable is a
      // new visitor, not a failure. Rebuilding has to keep saying so.
      const { service } = subject();
      const { session, visitor } = await recalled(service);
      expect(session.interventions).toBe(0);
      expect(session.lastInterventionAt).toBeUndefined();
      expect(visitor.interventions).toEqual([]);
    });

    it("does not rebuild a session older than its duration: it is another visit", async () => {
      // FR-003. The register still has the rows, and that is exactly why the rule is needed: replaying
      // them would carry yesterday's signals into today's decision. The SDK owed this visit a new
      // `sessionId`, and what arrived instead is a client not holding its end of the rule.
      const stale = arrival(addedToCart(8), "accepted");
      const duration = testLevels().platform.sessionDurationMs;
      const logged: { fields: Record<string, unknown>; message: string }[] = [];
      const { service } = subject({
        past: pastActivity({
          arrivals: [{ ...stale, receivedAt: later(-duration) }],
          session: [intervened("dec_00000009")],
        }).port,
        logger: {
          info: () => undefined,
          warn: (fields, message) => logged.push({ fields, message }),
          error: () => undefined,
        },
      });

      const { session } = await recalled(service);
      // Empty, not rebuilt: no signals and no spent budget carried over from the visit before.
      expect(session.signals.isEmpty()).toBe(true);
      expect(session.interventions).toBe(0);
      expect(session.lastInterventionAt).toBeUndefined();
      expect(session.updatedAt).toBe(now);
      // And it is reported, because an SDK reusing an expired identifier is information, not noise.
      expect(logged).toHaveLength(1);
      expect(logged[0]?.fields).toMatchObject({ inactivityMs: duration, sessionDurationMs: duration });
    });

    it("rebuilds a session one millisecond short of its duration, which is the boundary", async () => {
      // The pair of the test above, and the reason there are two: one millisecond of difference is a
      // session either rebuilt or thrown away, so `>` and `>=` have to be told apart by a test rather
      // than by reading the code. At exactly the duration the session is over — the duration is the
      // inactivity **after which** it ends.
      const duration = testLevels().platform.sessionDurationMs;
      const fresh = arrival(addedToCart(9), "accepted");
      const { service } = subject({
        past: pastActivity({
          arrivals: [{ ...fresh, receivedAt: later(1 - duration) }],
          session: [intervened("dec_00000010")],
        }).port,
      });

      const { session } = await recalled(service);
      expect(session.signals.count({ type: "added_to_cart" })).toBe(1);
      expect(session.interventions).toBe(1);
    });

    it("replays the duplicates, because the plane absorbed them too", async () => {
      // SC-002 turns on this and on the next test, and they are two and not one because both errors
      // return a state that is plausible: without the duplicates the session comes back with fewer
      // signals than it had.
      const once = variantSelector(3);
      const again = variantSelector(4);
      const { service } = subject({
        past: pastActivity({ arrivals: [arrival(once, "accepted"), arrival(again, "duplicate")] }).port,
      });

      const { session } = await recalled(service);
      // Two, not one: the duplicate counts, because the plane counted it.
      expect(session.signals.count({ type: once.type })).toBe(2);
    });

    it("does not replay what an invariant refused, because the plane never saw it", async () => {
      // A refused batch produces no decision: it never reached the plane, so replaying it would invent
      // signals out of events that were never absorbed.
      const absorbed = variantSelector(5);
      const refused = checkout(6);
      const { service } = subject({
        past: pastActivity({ arrivals: [arrival(absorbed, "accepted"), arrival(refused, "rejected")] }).port,
      });

      const { session } = await recalled(service);
      expect(session.signals.count({ type: absorbed.type })).toBe(1);
      expect(session.signals.count({ type: refused.type })).toBe(0);
    });
  });

  describe("when neither could answer (FR-012, FR-013)", () => {
    it("fails rather than pass a failure off as a visitor nobody has seen", async () => {
      // The damage this whole feature exists to undo, reappearing through the back door: if a failed
      // read came back as `undefined`, the plane would treat it as a new visitor and hand over the
      // entire quota. Three answers, three values.
      const { service } = subject({
        visitors: {
          load: () => Promise.resolve(fail(new StateUnavailable("visitor"))),
          save: () => Promise.resolve(),
        },
      });

      const result = await service.recall(whose, now);
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.code).toBe("state-unavailable");
      expect(result.ok ? undefined : result.error.details).toMatchObject({ path: "visitor" });
    });

    it("fails when it is the session side that could not be read, and says which side", async () => {
      const { service } = subject({
        sessions: {
          load: () => Promise.resolve(fail(new StateUnavailable("session"))),
          save: () => Promise.resolve(),
        },
      });

      const result = await service.recall(whose, now);
      expect(result.ok ? undefined : result.error.details).toMatchObject({ path: "session" });
    });

    it("degrades when the interventions of the session cannot be read", async () => {
      // FR-013, the half that has to fail closed: these are the interventions the session budget is
      // counted from, and nothing can stand in for them. Answering with zero would mean handing out a
      // fresh budget every time the store hiccups.
      const { service } = subject({ past: pastActivity({ failing: "session" }).port });

      const result = await service.recall(whose, now);
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.code).toBe("state-unavailable");
    });

    it("degrades when the interventions of the visitor cannot be read", async () => {
      // The same on the other side, and it matters more: the visitor cap is what keeps a chain of
      // failures from having no ceiling at all.
      const { service } = subject({ past: pastActivity({ failing: "visitor" }).port });

      const result = await service.recall(whose, now);
      expect(result.ok ? undefined : result.error.details).toMatchObject({ path: "visitor" });
    });

    it("decides with the current batch when the signals cannot be read, and says the signals were short", async () => {
      // FR-015, the half that does **not** degrade, and the whole argument of the asymmetry in one test:
      // the session comes back with its budget intact — read from the ledger, which answered — and with
      // no signals, which is what every session of this system looks like on its first batch. Refusing
      // to decide here would cost interventions that are being emitted right now and buy nothing.
      const { service } = subject({
        past: pastActivity({
          failing: "arrivals",
          session: [intervened("dec_00000011")],
        }).port,
      });

      const recall = await recalled(service);
      expect(recall.session.signals.isEmpty()).toBe(true);
      // The cap held: one intervention, from the read that did answer.
      expect(recall.session.interventions).toBe(1);
      // And the decision will carry it, so analysis does not read this as a visit where nothing happened.
      expect(recall.signalsIncomplete).toBe(true);
    });

    it("does not say the signals were short when they were whole", async () => {
      // The pair of the test above: a flag that were always set would say nothing, and a flag that were
      // never set would be unreachable. Both are killed by having the two cases.
      const { service } = subject({ past: pastActivity({ session: [intervened("dec_00000012")] }).port });

      expect((await recalled(service)).signalsIncomplete).toBe(false);
    });

    it("does not read what is durable when memory already has the answer", async () => {
      // This is SC-004 at the unit level: the normal case must not pay for the rebuild. A rebuild that
      // ran anyway would still return the right state, so nothing else here would notice.
      //
      // The two **session** reads are counted and the visitor one is not: nothing remembered an
      // intervention here, so the visitor is legitimately still forgotten and its read does happen.
      let durableReads = 0;
      const counted: PastActivity = {
        arrivalsOf: () => {
          durableReads += 1;
          return Promise.resolve(ok([]));
        },
        decisionsOf: () => {
          durableReads += 1;
          return Promise.resolve(ok([]));
        },
        decisionsOfVisitor: () => Promise.resolve(ok([])),
      };
      const { service } = subject({ past: counted });
      const session = SessionState.empty(now).absorb(Signals.of([addedToCart(7)]), now);
      await service.remember(whose, { session });
      durableReads = 0;

      expect((await recalled(service)).session).toBe(session);
      expect(durableReads).toBe(0);
    });
  });
});
