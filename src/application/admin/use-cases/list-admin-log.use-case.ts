// listAdminLog (ADR-031): the admin log, newest first, for an operator. Reading the log is not
// audited (it would fill the log with its own readings); the scope does not apply: the log is
// of the platform, and every entry names its merchant.
import type { AdminEntry } from "../../../domain/admin/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { AdminLog } from "../ports/admin-log.js";

export interface ListAdminLogRequest extends PageQuery {
  actor: Operator;
}

export type ListAdminLogResponse = Page<AdminEntry>;

export interface ListAdminLogDependencies {
  log: AdminLog;
}

export class ListAdminLogUseCase implements UseCase<ListAdminLogRequest, ListAdminLogResponse> {
  readonly #deps: ListAdminLogDependencies;

  constructor(deps: ListAdminLogDependencies) {
    this.#deps = deps;
  }

  execute(request: ListAdminLogRequest): Promise<ListAdminLogResponse> {
    return this.#deps.log.list({ cursor: request.cursor, limit: request.limit });
  }
}
