// listMerchantAdminLog (ADR-031): the admin log of one merchant, newest first, within the
// operator's scope (judged before the log is read; nothing is revealed outside it).
import type { AdminEntry } from "../../../domain/admin/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { AdminLog } from "../ports/admin-log.js";

export interface ListMerchantAdminLogRequest extends PageQuery {
  actor: Operator;
  merchantId: MerchantId;
}

export type ListMerchantAdminLogResponse = Result<Page<AdminEntry>, MerchantOutOfScope>;

export interface ListMerchantAdminLogDependencies {
  log: AdminLog;
}

export class ListMerchantAdminLogUseCase implements UseCase<
  ListMerchantAdminLogRequest,
  ListMerchantAdminLogResponse
> {
  readonly #deps: ListMerchantAdminLogDependencies;

  constructor(deps: ListMerchantAdminLogDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListMerchantAdminLogRequest): Promise<ListMerchantAdminLogResponse> {
    const scoped = request.actor.scopeFor(request.merchantId);
    if (!scoped.ok) return scoped;
    const page = await this.#deps.log.listOf(scoped.value, { cursor: request.cursor, limit: request.limit });
    return { ok: true, value: page };
  }
}
