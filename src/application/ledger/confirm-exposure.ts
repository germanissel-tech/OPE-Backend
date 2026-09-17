// Use case: exposure confirmation (FR-031). Only a decision of the merchant's own that was an
// intervention can be exposed; nonexistent, foreign or with another session/visitor get the same
// response (nothing is revealed). Returns a result, never throws on business rules.
import type { DecisionLedger } from "./ports/decision-ledger.js";
import type { ExposureLedger, ExposureRecordStatus } from "./ports/exposure-ledger.js";
import type { Anchor, Exposure } from "../../domain/ledger/index.js";
import type { DecisionId, MerchantId, SessionId, VisitorId } from "../../domain/shared-kernel/index.js";

export interface ConfirmExposureInput {
  merchantId: MerchantId;
  decisionId: DecisionId;
  sessionId: SessionId;
  visitorId: VisitorId;
  exposedAt: Date;
  anchor: Anchor;
}

export type ExposureInvariant = "exposure-decision-unknown" | "exposure-of-no-op";

export type ConfirmExposureResult =
  | { ok: true; status: Exclude<ExposureRecordStatus, "unavailable"> }
  | { ok: false; invariant: ExposureInvariant; detail: string }
  /** The ledger could not accept the exposure (ADR-021): nothing recorded, the SDK retries. */
  | { ok: false; unavailable: true };

export type ConfirmExposure = (input: ConfirmExposureInput) => Promise<ConfirmExposureResult>;

export interface ConfirmExposureDeps {
  decisionLedger: DecisionLedger;
  exposureLedger: ExposureLedger;
}

export function makeConfirmExposure({
  decisionLedger,
  exposureLedger,
}: ConfirmExposureDeps): ConfirmExposure {
  return async (input) => {
    const decision = await decisionLedger.find(input.merchantId, input.decisionId);
    const belongs = decision?.sessionId === input.sessionId && decision.visitorId === input.visitorId;
    if (!decision || !belongs) {
      return {
        ok: false,
        invariant: "exposure-decision-unknown",
        detail: "The decision does not exist for this merchant, session and visitor.",
      };
    }
    if (decision.outcome !== "INTERVENE") {
      return {
        ok: false,
        invariant: "exposure-of-no-op",
        detail: `Decision ${decision.decisionId} was NO_OP: there is no intervention to expose.`,
      };
    }
    const exposure: Exposure = {
      merchantId: input.merchantId,
      decisionId: input.decisionId,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      exposedAt: input.exposedAt,
      anchor: input.anchor,
    };
    const status = await exposureLedger.record(exposure);
    if (status === "unavailable") return { ok: false, unavailable: true };
    return { ok: true, status };
  };
}
