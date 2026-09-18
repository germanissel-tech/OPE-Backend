// Use case: exposure confirmation (FR-031). Only a decision of the merchant's own that was an
// intervention can be exposed; nonexistent, foreign or with another session/visitor get the same
// response (nothing is revealed). Returns a result, never throws on business rules; a ledger
// that cannot accept the exposure returns LedgerUnavailable and the SDK retries (ADR-021).
import {
  ExposureDecisionUnknown,
  ExposureOfNoOp,
  type Anchor,
  type Exposure,
  type LedgerError,
  type DecisionId,
} from "../../../domain/ledger/index.js";
import {
  fail,
  type MerchantId,
  type Result,
  type SessionId,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { DecisionLedger } from "../ports/decision-ledger.js";
import type { ExposureLedger, ExposureRecordStatus } from "../ports/exposure-ledger.js";

export interface ConfirmExposureRequest {
  merchantId: MerchantId;
  decisionId: DecisionId;
  sessionId: SessionId;
  visitorId: VisitorId;
  exposedAt: Date;
  anchor: Anchor;
}

export type ConfirmExposureResponse = Result<ExposureRecordStatus, LedgerError>;

export interface ConfirmExposureDependencies {
  decisions: DecisionLedger;
  exposures: ExposureLedger;
}

export class ConfirmExposureUseCase implements UseCase<ConfirmExposureRequest, ConfirmExposureResponse> {
  readonly #deps: ConfirmExposureDependencies;

  constructor(deps: ConfirmExposureDependencies) {
    this.#deps = deps;
  }

  async execute(request: ConfirmExposureRequest): Promise<ConfirmExposureResponse> {
    const { decisions, exposures } = this.#deps;
    const decision = await decisions.find(request.merchantId, request.decisionId);
    if (!decision?.belongsTo(request.sessionId, request.visitorId))
      return fail(new ExposureDecisionUnknown());
    if (!decision.isIntervention()) return fail(new ExposureOfNoOp(decision.decisionId));
    const exposure: Exposure = {
      merchantId: request.merchantId,
      decisionId: request.decisionId,
      sessionId: request.sessionId,
      visitorId: request.visitorId,
      exposedAt: request.exposedAt,
      anchor: request.anchor,
    };
    return exposures.record(exposure);
  }
}
