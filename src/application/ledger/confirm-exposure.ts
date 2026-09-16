// Caso de uso: confirmación de exposición (FR-031). Sólo una decisión propia del merchant que fue
// intervención puede exponerse; inexistente, ajena o con otra sesión/visitante reciben la misma
// respuesta (no se revela nada). Devuelve un resultado, nunca lanza por reglas de negocio.
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
  { ok: true; status: ExposureRecordStatus } | { ok: false; invariant: ExposureInvariant; detail: string };

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
        detail: "La decisión no existe para este merchant, sesión y visitante.",
      };
    }
    if (decision.outcome !== "INTERVENE") {
      return {
        ok: false,
        invariant: "exposure-of-no-op",
        detail: `La decisión ${decision.decisionId} fue NO_OP: no hay intervención que exponer.`,
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
    return { ok: true, status: await exposureLedger.record(exposure) };
  };
}
