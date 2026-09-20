// Audit (ADR-031): every administration use case leaves an entry in the admin log — accepted,
// rejected by a business rule (with its code) or denied by scope — with the actor, the
// merchant and what the action produced. A cross-cutting concern, like LoggedUseCase: applied
// in the composition, never inside a use case.
import { DomainError, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { AdminOutcome, AdminResult, Operator } from "../../../domain/admin/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { AdminLog } from "../ports/admin-log.js";

/** What every administration request carries: who acts and, when the action names one, on which merchant. */
export interface AdminRequest {
  actor: Operator;
  merchantId?: MerchantId | undefined;
}

export interface AuditedUseCaseDependencies {
  log: AdminLog;
  clock: Clock;
}

/** How the entry reads the response and the request; both optional. */
export interface AuditedUseCaseReaders<Request, Response> {
  /** What the action produced, from a successful response. */
  result?: (response: Response) => AdminResult | undefined;
  /** The reason the operator declared, from the request. */
  reason?: (request: Request) => string | undefined;
}

const OUT_OF_SCOPE = "merchant-out-of-scope";

/** The failed Result's error, or undefined for a success or a response that is not a Result. */
function errorOf(response: unknown): DomainError | undefined {
  const error: unknown =
    typeof response === "object" && response !== null ? Reflect.get(response, "error") : undefined;
  return error instanceof DomainError ? error : undefined;
}

function outcomeOf(error: DomainError | undefined): AdminOutcome {
  if (error === undefined) return "accepted";
  return error.code === OUT_OF_SCOPE ? "denied" : "rejected";
}

export class AuditedUseCase<Request extends AdminRequest, Response> implements UseCase<Request, Response> {
  readonly #operation: string;
  readonly #inner: UseCase<Request, Response>;
  readonly #deps: AuditedUseCaseDependencies;
  readonly #readers: AuditedUseCaseReaders<Request, Response>;

  constructor(
    operation: string,
    inner: UseCase<Request, Response>,
    deps: AuditedUseCaseDependencies,
    readers: AuditedUseCaseReaders<Request, Response> = {},
  ) {
    this.#operation = operation;
    this.#inner = inner;
    this.#deps = deps;
    this.#readers = readers;
  }

  async execute(request: Request): Promise<Response> {
    const response = await this.#inner.execute(request);
    const error = errorOf(response);
    const outcome = outcomeOf(error);
    const result = outcome === "accepted" ? this.#readers.result?.(response) : undefined;
    const reason = this.#readers.reason?.(request);
    await this.#deps.log.record({
      at: this.#deps.clock.now(),
      operatorId: request.actor.operatorId,
      operation: this.#operation,
      merchantId: request.merchantId,
      outcome,
      ...(error === undefined ? {} : { code: error.code }),
      ...(result === undefined ? {} : { result }),
      ...(reason === undefined ? {} : { reason }),
    });
    return response;
  }
}
