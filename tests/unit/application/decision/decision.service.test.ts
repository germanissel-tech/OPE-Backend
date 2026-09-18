// Feature 011 (FR-001, FR-002, FR-030, FR-031, FR-050; constitution I, III; ADR-021): the
// orchestrator invokes the authorities in order, records how it reasoned, keeps the session and
// degrades when the ledger is down — with doubles for every port.
import { describe, expect, it } from "vitest";
import {
  RuleBasedBarrierInference,
  type BarrierInference,
} from "../../../../src/application/barrier/index.js";
import { DefaultProductTruthService, type CatalogStore } from "../../../../src/application/catalog/index.js";
import { DecisionService, type SessionStateStore } from "../../../../src/application/decision/index.js";
import { DefaultDecisionRecorder } from "../../../../src/application/ledger/index.js";
import { CatalogSnapshot, asProductId, asVariantId } from "../../../../src/domain/catalog/index.js";
import { DEFAULT_DECISION_POLICY, type SessionState } from "../../../../src/domain/decision/index.js";
import { EventBatch, type Event } from "../../../../src/domain/ingestion/index.js";
import { LedgerUnavailable, asDecisionId, type Decision } from "../../../../src/domain/ledger/index.js";
import {
  asExperimentId,
  asMerchantId,
  fail,
  ok,
  Money,
  type Arm,
  type MerchantId,
  type SessionId,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../../src/interface-adapters/gateways/ledger/memory-decision-ledger.js";
import {
  BASE,
  addedToCart,
  checkout,
  dwell,
  removedFromCart,
  sizeSelector,
  viewed,
} from "../../../helpers/events.js";
import { recordingLogger, unavailableDecisionLedger } from "../../../helpers/unavailable-ledgers.js";
import type { AssignmentService } from "../../../../src/application/experiment/index.js";

const A = asMerchantId("m_a");
const NOW = new Date(BASE.getTime() + 60_000);

const snapshot = CatalogSnapshot.rehydrate({
  merchantId: A,
  capturedAt: BASE,
  receivedAt: BASE,
  products: [
    {
      productId: asProductId("SKU-1"),
      title: "Runner",
      attributes: [{ key: "category", value: "shoes" }],
      variants: [
        {
          variantId: asVariantId("SKU-1-M"),
          size: "M",
          color: "black",
          available: true,
          price: Money.rehydrate({ amount: "10.00", currency: "USD" }),
        },
        {
          variantId: asVariantId("SKU-1-L"),
          size: "L",
          color: "black",
          available: false,
          price: Money.rehydrate({ amount: "10.00", currency: "USD" }),
        },
      ],
    },
  ],
});

interface Options {
  arm?: Arm | "none" | "down";
  catalog?: CatalogSnapshot;
  ledgerDown?: boolean;
  inference?: BarrierInference;
}

function subject(options: Options = {}) {
  const calls: string[] = [];
  const arm = options.arm ?? "TREATMENT";
  const assignment: AssignmentService = {
    assign: (merchantId, visitorId) => {
      calls.push("assign");
      if (arm === "down") return Promise.resolve(fail(new LedgerUnavailable()));
      if (arm === "none") return Promise.resolve(ok(undefined));
      return Promise.resolve(
        ok({ merchantId, visitorId, experimentId: asExperimentId("exp_00000001"), arm, assignedAt: NOW }),
      );
    },
  };
  const sessions = new Map<string, SessionState>();
  const sessionStore: SessionStateStore = {
    load: (m: MerchantId, s: SessionId) => {
      calls.push("sessions.load");
      return Promise.resolve(sessions.get(`${m}/${s}`));
    },
    save: (m: MerchantId, s: SessionId, state) => {
      calls.push("sessions.save");
      sessions.set(`${m}/${s}`, state);
      return Promise.resolve();
    },
  };
  const store: CatalogStore = {
    current: () => {
      calls.push("truth");
      return Promise.resolve(options.catalog);
    },
    replace: () => Promise.resolve(),
    receipts: () => Promise.resolve([]),
  };
  const inner = options.inference ?? new RuleBasedBarrierInference();
  const inference: BarrierInference = {
    infer: (context) => {
      calls.push("infer");
      return inner.infer(context);
    },
  };
  const decisions = options.ledgerDown ? unavailableDecisionLedger() : memoryDecisionLedger();
  let minted = 0;
  const { logger, entries } = recordingLogger();
  const recorder = new DefaultDecisionRecorder({
    decisions: {
      record: (d) => {
        calls.push("record");
        return decisions.record(d);
      },
      find: (m, id) => decisions.find(m, id),
    },
    decisionIds: { next: () => asDecisionId(`dec_${String(++minted).padStart(8, "0")}`) },
    logger,
  });
  const service = new DecisionService({
    assignment,
    policies: { policyFor: () => Promise.resolve(DEFAULT_DECISION_POLICY) },
    sessions: sessionStore,
    inference,
    truth: new DefaultProductTruthService({ clock: { now: () => NOW }, store }),
    recorder,
  });
  const decide = async (events: Event[]): Promise<Decision> => {
    const batch = EventBatch.of(events, NOW);
    if (!batch.ok) throw new Error(batch.error.message);
    return service.decide({ merchantId: A, batch: batch.value, now: NOW });
  };
  return { decide, calls, sessions, decisions, entries };
}

describe("DecisionService.decide — order of the authorities (constitution I)", () => {
  it("assignment → session → truth → inference → record → session save, and INTERVENE with everything the ledger needs", async () => {
    const { decide, calls, decisions, sessions } = subject({ catalog: snapshot });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(calls).toEqual(["assign", "sessions.load", "truth", "infer", "record", "sessions.save"]);
    expect(decision.isIntervention()).toBe(true);
    expect(decision.isIntervention() && decision.intervention).toEqual({
      anchor: "size_selector",
      messageVersionId: "msg_fit_size_selector_v0",
    });
    expect(decision.reason).toBe("fit");
    expect(decision.experiment).toEqual({ experimentId: "exp_00000001", arm: "TREATMENT" });
    expect(decision.inference).toEqual({
      policyVersion: "default-1",
      confidences: { fit: 0.8, price: 0, returns: 0 },
      matched: ["fit.size-selector-twice", "fit.size-guide-read"],
      barrier: "fit",
      trigger: "rules",
      evidence: { truth: "known", stockAndPrice: "fresh", available: true },
    });
    expect(await decisions.find(A, decision.decisionId)).toBe(decision);
    expect(sessions.get("m_a/ses_00000001")?.interventions).toBe(1);
  });

  it("a NO_OP without a candidate records the inference without a barrier key at all", async () => {
    const { decide } = subject({ catalog: snapshot });
    const decision = await decide([sizeSelector(1)]);
    expect(decision.reason).toBe("barrier-unclear");
    expect(Object.keys(decision.inference ?? {})).not.toContain("barrier");
    expect(decision.inference?.trigger).toBe("none");
  });

  it("a page without a resolved product → page-context-incomplete without consulting the truth nor inferring", async () => {
    const { decide, calls } = subject({ catalog: snapshot });
    const decision = await decide([viewed(1, { pageType: "listing" })]);
    expect(decision.reason).toBe("page-context-incomplete");
    expect(decision.inference).toBeUndefined();
    expect(calls).toEqual(["assign", "sessions.load", "record", "sessions.save"]);
  });

  it("CONTROL goes through the same inference and the ledger keeps it (constitution III)", async () => {
    const { decide } = subject({ catalog: snapshot, arm: "CONTROL" });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "control-arm" });
    expect(decision.inference).toMatchObject({ barrier: "fit", trigger: "rules", confidences: { fit: 0.8 } });
  });

  it("without an active experiment → no-active-experiment, still inferred", async () => {
    const { decide } = subject({ catalog: snapshot, arm: "none" });
    const decision = await decide([sizeSelector(1), sizeSelector(2)]);
    expect(decision.reason).toBe("no-active-experiment");
    expect(decision.experiment).toBeUndefined();
    expect(decision.inference?.confidences.fit).toBe(0.4);
  });
});

describe("DecisionService.decide — evidence and session", () => {
  it("no catalogue → evidence-missing with the evidence recorded", async () => {
    const { decide } = subject();
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision.reason).toBe("evidence-missing");
    expect(decision.inference?.evidence).toEqual({ truth: "absent" });
  });

  it("the unavailable variant in focus with fit → variant-unavailable", async () => {
    const { decide } = subject({ catalog: snapshot });
    const page = { pageType: "product" as const, productId: "SKU-1", variantId: "SKU-1-L" };
    const decision = await decide([
      sizeSelector(1, "L"),
      sizeSelector(2, "L"),
      dwell(3, "size_guide", 6000),
      viewed(4, page),
    ]);
    expect(decision.reason).toBe("variant-unavailable");
    expect(decision.inference?.evidence).toEqual({
      truth: "known",
      stockAndPrice: "fresh",
      available: false,
    });
  });

  it("the product without a variant in focus: attributes serve the rules, fit is evidence-missing", async () => {
    const { decide } = subject({ catalog: snapshot });
    const page = { pageType: "product" as const, productId: "SKU-1" };
    const decision = await decide([
      sizeSelector(1),
      sizeSelector(2),
      dwell(3, "size_guide", 6000),
      viewed(4, page),
    ]);
    expect(decision.reason).toBe("evidence-missing");
    expect(decision.inference?.evidence).toEqual({ truth: "known-product", stockAndPrice: "fresh" });
  });

  it("the session accumulates across batches: one signal per batch reaches the threshold on the second", async () => {
    const { decide } = subject({ catalog: snapshot });
    expect((await decide([sizeSelector(1), sizeSelector(2)])).reason).toBe("barrier-unclear");
    expect((await decide([dwell(10, "size_guide", 6000)])).isIntervention()).toBe(true);
    expect((await decide([dwell(20, "size_guide", 6000)])).reason).toBe("session-budget-exhausted");
  });

  it("an abandonment without a signal → returns reassurance", async () => {
    const { decide } = subject({ catalog: snapshot });
    const decision = await decide([addedToCart(1), removedFromCart(2)]);
    expect(decision.isIntervention() && decision.intervention.anchor).toBe("policies");
    expect(decision.inference).toMatchObject({ trigger: "abandonment", barrier: "returns" });
  });

  it("the checkout → high-intent", async () => {
    const { decide } = subject({ catalog: snapshot });
    const decision = await decide([
      sizeSelector(1),
      sizeSelector(2),
      dwell(3, "size_guide", 6000),
      checkout(4),
    ]);
    expect(decision.reason).toBe("high-intent");
  });
});

describe("DecisionService.decide — the ledger is down (ADR-021)", () => {
  it("assignment not recorded → NO_OP ledger-unavailable, nothing recorded, no session touched", async () => {
    const { decide, calls, entries } = subject({ catalog: snapshot, arm: "down" });
    const decision = await decide([sizeSelector(1)]);
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "ledger-unavailable" });
    expect(calls).toEqual(["assign"]);
    expect(entries.map((e) => e.message)).toEqual(["assignment not recorded: ledger-unavailable"]);
  });

  it("decision not recorded → NO_OP ledger-unavailable and the intervention is not counted against the session", async () => {
    const { decide, sessions, entries } = subject({ catalog: snapshot, ledgerDown: true });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "ledger-unavailable" });
    expect(decision.inference?.barrier).toBe("fit");
    expect(sessions.get("m_a/ses_00000001")?.interventions).toBe(0);
    expect(sessions.get("m_a/ses_00000001")?.signals.count({ type: "size_selector_interacted" })).toBe(2);
    expect(entries.map((e) => e.message)).toEqual(["decision not recorded: ledger-unavailable"]);
  });
});
