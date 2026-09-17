// US2 (FR-011, FR-013, FR-050): the assignment ledger in memory keeps one assignment per
// merchant, experiment and visitor; the first record wins; nothing crosses merchants.
import { describe, expect, it } from "vitest";
import { asExperimentId, asMerchantId, asVisitorId } from "../../../src/domain/shared-kernel/index.js";
import { memoryAssignmentLedger } from "../../../src/interface-adapters/gateways/experiment/memory-assignment-ledger.js";
import type { Assignment } from "../../../src/domain/experiment/index.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const E1 = asExperimentId("exp_00000001");
const E2 = asExperimentId("exp_00000002");
const V = asVisitorId("vis_00000001");
const at = (iso: string) => new Date(iso);

const assignment = (over: Partial<Assignment> = {}): Assignment => ({
  merchantId: A,
  experimentId: E1,
  visitorId: V,
  arm: "CONTROL",
  assignedAt: at("2026-09-17T12:00:00.000Z"),
  ...over,
});

describe("memoryAssignmentLedger", () => {
  it("records and finds by merchant, experiment and visitor", async () => {
    const ledger = memoryAssignmentLedger();
    expect(await ledger.record(assignment())).toBe("accepted");
    expect(await ledger.find(A, E1, V)).toEqual(assignment());
  });

  it("idempotency: recording an existing assignment keeps the first (arm and instant) and still accepts", async () => {
    const ledger = memoryAssignmentLedger();
    await ledger.record(assignment());
    expect(
      await ledger.record(assignment({ arm: "TREATMENT", assignedAt: at("2026-09-18T00:00:00.000Z") })),
    ).toBe("accepted");
    expect(await ledger.find(A, E1, V)).toEqual(assignment());
  });

  it("isolation: another merchant or another experiment does not see it", async () => {
    const ledger = memoryAssignmentLedger();
    await ledger.record(assignment());
    expect(await ledger.find(B, E1, V)).toBeUndefined();
    expect(await ledger.find(A, E2, V)).toBeUndefined();
  });
});
