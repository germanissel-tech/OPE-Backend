// Feature 011 (FR-001, FR-002, FR-030, FR-031, FR-050; constitution I, III; ADR-021): the
// orchestrator invokes the authorities in order, records how it reasoned, keeps the session and
// degrades when the ledger is down — with doubles for every port.
import { describe, expect, it } from "vitest";
import {
  RuleBasedBarrierInference,
  type BarrierInference,
} from "../../../../src/application/barrier/index.js";
import { DefaultProductTruthService, type CatalogStore } from "../../../../src/application/catalog/index.js";
import {
  DecisionService,
  DefaultStateService,
  type SessionStateStore,
  type VisitorStateStore,
} from "../../../../src/application/decision/index.js";
import { DefaultDecisionRecorder } from "../../../../src/application/ledger/index.js";
import { CatalogSnapshot, asProductId, asVariantId } from "../../../../src/domain/catalog/index.js";
import { type CommercialPolicy } from "../../../../src/domain/commercial/index.js";
import {
  DecisionPolicy,
  type SessionState,
  type VisitorState,
} from "../../../../src/domain/decision/index.js";
import { EventBatch, type Event } from "../../../../src/domain/ingestion/index.js";
import { LedgerUnavailable, asDecisionId, type Decision } from "../../../../src/domain/ledger/index.js";
import {
  asExperimentId,
  asMerchantId,
  fail,
  ok,
  Money,
  BARRIERS,
  type Arm,
  type Barrier,
  type ConfigurationVersions,
  type MerchantId,
  type SessionId,
  type VisitorId,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../../src/interface-adapters/gateways/ledger/memory-decision-ledger.js";
import {
  BASE,
  addedToCart,
  checkout,
  cta,
  dwell,
  removedFromCart,
  sizeSelector,
  viewed,
} from "../../../helpers/events.js";
import {
  TEST_CATALOG_POLICIES,
  TEST_TOLERANCE,
  TEST_VERSIONS,
  testVisitorWindow,
} from "../../../helpers/platform.js";
import { testLevels } from "../../../helpers/test-app.js";
import { recordingLogger, unavailableDecisionLedger } from "../../../helpers/unavailable-ledgers.js";
import type { AssignmentService } from "../../../../src/application/experiment/index.js";
import type { ExperimentPhase } from "../../../../src/domain/experiment/index.js";
import type { MerchantProfile } from "../../../../src/domain/selection/index.js";

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
  /** The phase of the experiment (feature 017); accumulation unless a test says otherwise. */
  phase?: ExperimentPhase;
  catalog?: CatalogSnapshot;
  ledgerDown?: boolean;
  inference?: BarrierInference;
  decision?: DecisionPolicy;
  commercial?: CommercialPolicy;
  profile?: MerchantProfile;
  /** The kill switch (feature 017); on unless a test says otherwise. */
  enabled?: boolean;
  /** The barriers the merchant enables (feature 017); all unless a test says otherwise. */
  barriers?: readonly Barrier[];
  versions?: ConfigurationVersions;
}

const DEFAULT_DECISION_POLICY = () => testLevels().defaults.values.decisionPolicy;

function subject(options: Options = {}) {
  const calls: string[] = [];
  const arm = options.arm ?? "TREATMENT";
  const assignment: AssignmentService = {
    assign: (merchantId, visitorId) => {
      calls.push("assign");
      if (arm === "down") return Promise.resolve(fail(new LedgerUnavailable()));
      if (arm === "none") return Promise.resolve(ok(undefined));
      return Promise.resolve(
        ok({
          assignment: {
            merchantId,
            visitorId,
            experimentId: asExperimentId("exp_00000001"),
            arm,
            assignedAt: NOW,
          },
          phase: options.phase ?? "accumulation",
        }),
      );
    },
  };
  const sessions = new Map<string, SessionState>();
  const visitors = new Map<string, VisitorState>();
  const visitorStore: VisitorStateStore = {
    load: (m: MerchantId, v: VisitorId) => Promise.resolve(visitors.get(`${m}/${v}`)),
    save: (m: MerchantId, v: VisitorId, state) => {
      visitors.set(`${m}/${v}`, state);
      return Promise.resolve();
    },
  };
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
    replace: () => Promise.resolve(ok(undefined)),
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
      bySession: (m, sid) => decisions.bySession(m, sid),
    },
    decisionIds: { next: () => asDecisionId(`dec_${String(++minted).padStart(8, "0")}`) },
    logger,
  });
  const service = new DecisionService({
    assignment,
    policies: {
      policiesFor: () =>
        Promise.resolve({
          decision: options.decision ?? testLevels().defaults.values.decisionPolicy,
          commercial: options.commercial ?? testLevels().defaults.values.commercialPolicy,
          profile: options.profile ?? { returnsPolicy: true, fitData: true, authorizedAttributes: [] },
          barriers: options.barriers ?? BARRIERS,
          versions: options.versions ?? TEST_VERSIONS,
          enabled: options.enabled ?? true,
        }),
    },
    state: new DefaultStateService({
      sessions: sessionStore,
      visitors: visitorStore,
      visitorWindow: testVisitorWindow(),
    }),
    inference,
    truth: new DefaultProductTruthService({
      clock: { now: () => NOW },
      store,
      policies: TEST_CATALOG_POLICIES,
    }),
    recorder,
  });
  const decide = async (events: Event[]): Promise<Decision> => {
    const batch = EventBatch.of(events, NOW, {
      pastMs: TEST_TOLERANCE.eventPastMs(),
      futureMs: TEST_TOLERANCE.skewMs(),
    });
    if (!batch.ok) throw new Error(batch.error.message);
    return service.decide({ merchantId: A, batch: batch.value, now: NOW });
  };
  return { decide, calls, sessions, visitors, decisions, entries };
}

describe("DecisionService.decide — order of the authorities (constitution I)", () => {
  it("assignment → session → truth → inference → record → session save, and INTERVENE with everything the ledger needs", async () => {
    const { decide, calls, decisions, sessions, visitors } = subject({ catalog: snapshot });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(calls).toEqual(["assign", "sessions.load", "truth", "infer", "record", "sessions.save"]);
    expect(decision.isIntervention()).toBe(true);
    expect(decision.isIntervention() && decision.intervention).toEqual({
      anchor: "size_selector",
      messageVersionId: "msg_fit_size_selector_information_v0",
    });
    expect(decision.reason).toBe("fit");
    expect(decision.experiment).toEqual({ experimentId: "exp_00000001", arm: "TREATMENT" });
    expect(decision.phase).toBeUndefined();
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
    expect(visitors.get("m_a/vis_00000001")?.interventions).toEqual([NOW]);
  });

  it("while the experiment calibrates the decision is taken the same way and stamped as calibration (03 §4.10)", async () => {
    const { decide } = subject({ catalog: snapshot, phase: "calibration" });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision.isIntervention()).toBe(true);
    expect(decision.phase).toBe("calibration");
    expect(decision.experiment).toEqual({ experimentId: "exp_00000001", arm: "TREATMENT" });
  });

  it("a NO_OP without a candidate records the inference without a barrier key at all", async () => {
    const { decide } = subject({ catalog: snapshot });
    const decision = await decide([sizeSelector(1)]);
    expect(decision.reason).toBe("barrier-unclear");
    expect(Object.keys(decision.inference ?? {})).not.toContain("barrier");
    expect(decision.inference?.trigger).toBe("none");
  });

  it("the ledger keeps the selection: every candidate judged, the chosen one and the commercial version (constitution IX)", async () => {
    const { decide } = subject({ catalog: snapshot });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision.selection).toEqual({
      candidates: [
        { candidateId: "msg_fit_size_selector_information_v0", step: "information", verdict: "acceptable" },
        { candidateId: "msg_fit_policies_reassurance_v0", step: "reassurance", verdict: "acceptable" },
        { candidateId: "msg_fit_size_selector_evidence_v0", step: "evidence", verdict: "acceptable" },
      ],
      chosen: "msg_fit_size_selector_information_v0",
      commercialVerdict: { blocked: false },
      commercialPolicyVersion: "commercial-default-1",
    });
  });

  it("CONTROL records the selection too, with what would have been chosen", async () => {
    const { decide } = subject({ catalog: snapshot, arm: "CONTROL" });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision.reason).toBe("control-arm");
    expect(decision.selection).toMatchObject({
      chosen: "msg_fit_size_selector_information_v0",
      commercialVerdict: { blocked: false },
    });
  });

  it("with an empty profile the gate rejects every claim and the ledger names each reason", async () => {
    const { decide } = subject({
      catalog: snapshot,
      profile: { returnsPolicy: false, fitData: false, authorizedAttributes: [] },
    });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision.isIntervention() && decision.intervention.messageVersionId).toBe(
      "msg_fit_size_selector_information_v0",
    );
    expect(decision.selection?.candidates.map((c) => c.reason)).toEqual([
      undefined,
      "no-returns-policy",
      "no-fit-data",
    ]);
  });

  it("the gate has its own guard on stale stock and price: with a policy that does not pre-check it, the current-price candidate is rejected", async () => {
    const lenient = DecisionPolicy.rehydrate({
      version: "lenient",
      rules: DEFAULT_DECISION_POLICY().rules,
      threshold: DEFAULT_DECISION_POLICY().threshold,
      priority: DEFAULT_DECISION_POLICY().priority,
      evidence: { freshStockAndPrice: [], availableVariant: [] },
    });
    const stale = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: new Date(BASE.getTime() - 2 * 3_600_000),
      receivedAt: BASE,
      products: snapshot.products,
    });
    const { decide } = subject({ catalog: stale, decision: lenient });
    const decision = await decide([dwell(1, "price", 6000), cta(2)]);
    // The default commercial policy has no margin: the incentive is blocked, the value message goes out.
    expect(decision.isIntervention() && decision.intervention.messageVersionId).toBe(
      "msg_price_price_information_v0",
    );
    expect(decision.selection?.commercialVerdict).toEqual({ blocked: false });
    expect(decision.selection?.candidates).toEqual([
      { candidateId: "msg_price_price_information_v0", step: "information", verdict: "acceptable" },
      {
        candidateId: "msg_price_price_evidence_v0",
        step: "evidence",
        verdict: "unacceptable",
        reason: "stale-price",
      },
      { candidateId: "msg_price_price_incentive_v0", step: "incentive", verdict: "acceptable" },
    ]);
    expect(decision.inference?.evidence).toEqual({ truth: "known", stockAndPrice: "stale", available: true });
  });

  it("without a variant in focus the gate sees no variant: the size recommendation is unacceptable", async () => {
    const lenient = DecisionPolicy.rehydrate({
      version: "lenient",
      rules: DEFAULT_DECISION_POLICY().rules,
      threshold: DEFAULT_DECISION_POLICY().threshold,
      priority: DEFAULT_DECISION_POLICY().priority,
      evidence: { freshStockAndPrice: [], availableVariant: [] },
    });
    const { decide } = subject({ catalog: snapshot, decision: lenient });
    const page = { pageType: "product" as const, productId: "SKU-1" };
    const decision = await decide([
      sizeSelector(1),
      sizeSelector(2),
      dwell(3, "size_guide", 6000),
      viewed(4, page),
    ]);
    expect(decision.selection?.candidates.at(-1)).toEqual({
      candidateId: "msg_fit_size_selector_evidence_v0",
      step: "evidence",
      verdict: "unacceptable",
      reason: "variant-unavailable",
    });
  });

  it("a page without a resolved product → page-context-incomplete without consulting the truth nor inferring", async () => {
    const { decide, calls } = subject({ catalog: snapshot });
    const decision = await decide([viewed(1, { pageType: "listing" })]);
    expect(decision.reason).toBe("page-context-incomplete");
    expect(decision.inference).toBeUndefined();
    expect(decision.selection).toBeUndefined();
    expect(calls).toEqual(["assign", "sessions.load", "record", "sessions.save"]);
  });

  it("CONTROL goes through the same inference and the ledger keeps it (constitution III)", async () => {
    const { decide } = subject({ catalog: snapshot, arm: "CONTROL" });
    const decision = await decide([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "control-arm" });
    expect(decision.inference).toMatchObject({ barrier: "fit", trigger: "rules", confidences: { fit: 0.8 } });
  });

  it("with the kill switch off → merchant-off before assigning: no experiment, no inference, recorded (feature 017)", async () => {
    const { decide, calls } = subject({ catalog: snapshot, enabled: false });
    const decision = await decide([sizeSelector(1), sizeSelector(2)]);
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "merchant-off" });
    expect(decision.experiment).toBeUndefined();
    expect(decision.inference).toBeUndefined();
    expect(calls).not.toContain("assign");
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
    expect(decision.selection?.candidates).toEqual([]);
    expect(Object.keys(decision.selection ?? {})).not.toContain("chosen");
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
