// Decisión (01-arquitectura-mvp.md §5, §7; constitución II): siempre existe, con motivo. El ledger
// no sabe de lotes ni de eventos: registra lo que otros módulos deciden.
import type { DecisionId, MerchantId, SessionId, VisitorId } from "../shared-kernel/index.js";

export type Anchor = "size_selector" | "price" | "cta" | "policies";

/** Lugar reservado para el plano de decisión (PROPUESTO en el contrato). */
export interface Intervention {
  messageVersionId: string;
  anchor: Anchor;
}

export type DecisionOutcome = "NO_OP" | "INTERVENE";

export interface Decision {
  decisionId: DecisionId;
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
  decidedAt: Date;
  outcome: DecisionOutcome;
  /** Motivo del resultado: slug del catálogo `contracts/no-op-reasons.yaml` cuando es NO_OP. */
  reason: string;
  intervention?: Intervention;
}

export type NoOpInput = Omit<Decision, "outcome" | "intervention">;

export function noOp(input: NoOpInput): Decision {
  return { ...input, outcome: "NO_OP" };
}
