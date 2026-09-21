// reportAnchorDiagnostics (01 §3.1.1; ADR-031): what the SDK could not resolve, kept per merchant
// with the instant and the configuration version it had loaded; a repeated key counts, never
// duplicates. Nothing of the page nor of the person beyond the anchor and the page type.
import {
  fail,
  ok,
  type Anchor,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { AnchorDiagnosticsStore } from "../ports/anchor-diagnostics-store.js";

export interface UnresolvedAnchor {
  anchor: Anchor;
  pageType: string;
}

export interface ReportAnchorDiagnosticsRequest {
  merchantId: MerchantId;
  configurationVersion?: number | undefined;
  unresolved: readonly UnresolvedAnchor[];
}

export type ReportAnchorDiagnosticsResponse = Result<{ received: number }, StoreUnavailable>;

export interface ReportAnchorDiagnosticsDependencies {
  diagnostics: AnchorDiagnosticsStore;
  clock: Clock;
}

export class ReportAnchorDiagnosticsUseCase implements UseCase<
  ReportAnchorDiagnosticsRequest,
  ReportAnchorDiagnosticsResponse
> {
  readonly #deps: ReportAnchorDiagnosticsDependencies;

  constructor(deps: ReportAnchorDiagnosticsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ReportAnchorDiagnosticsRequest): Promise<ReportAnchorDiagnosticsResponse> {
    const { diagnostics, clock } = this.#deps;
    const lastSeenAt = clock.now();
    for (const { anchor, pageType } of request.unresolved) {
      const recorded = await diagnostics.upsert({
        merchantId: request.merchantId,
        anchor,
        pageType,
        configurationVersion: request.configurationVersion,
        lastSeenAt,
      });
      if (!recorded.ok) return fail(recorded.error);
    }
    return ok({ received: request.unresolved.length });
  }
}
