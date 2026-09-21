// listAnchorDiagnostics (01 §3.1.1; ADR-031): the anchors the SDK of a merchant could not
// resolve, most recent first, within the scope of the operator.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { AnchorDiagnostic } from "../../../domain/admin/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { AnchorDiagnosticsStore } from "../ports/anchor-diagnostics-store.js";

export interface ListAnchorDiagnosticsRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

export type ListAnchorDiagnosticsResponse = Result<
  Page<AnchorDiagnostic>,
  MerchantOutOfScope | MerchantNotFound
>;

export interface ListAnchorDiagnosticsDependencies {
  scoped: ScopedMerchantService;
  diagnostics: AnchorDiagnosticsStore;
}

export class ListAnchorDiagnosticsUseCase implements UseCase<
  ListAnchorDiagnosticsRequest,
  ListAnchorDiagnosticsResponse
> {
  readonly #deps: ListAnchorDiagnosticsDependencies;

  constructor(deps: ListAnchorDiagnosticsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListAnchorDiagnosticsRequest): Promise<ListAnchorDiagnosticsResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    return ok(await this.#deps.diagnostics.listOf(request.merchantId, request.page));
  }
}
