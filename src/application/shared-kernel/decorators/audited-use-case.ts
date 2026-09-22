// Audit (ADR-031, ADR-034): every administration use case leaves an entry in the audit trail —
// accepted, rejected by a business rule (with its code) or denied by scope — with the actor, the
// merchant and what the action produced. A cross-cutting concern of the platform, like
// LoggedUseCase: it lives in the kernel, is applied in the composition, and is never invoked
// inside a use case.
import {
  DomainError,
  type AuditOutcome,
  type AuditResult,
  type MerchantId,
} from "../../../domain/shared-kernel/index.js";
import type { AuditTrail } from "../ports/audit-trail.js";
import type { Clock } from "../ports/clock.js";
import type { UseCase } from "../use-case.js";

/**
 * What every administration request carries: who acts and, when the action names one, on which
 * merchant. The actor is read as an identifier: which identity it belongs to is not the kernel's
 * business (ADR-034).
 */
export interface AdminRequest {
  actor: { readonly operatorId: string };
  merchantId?: MerchantId | undefined;
}

export interface AuditedUseCaseDependencies {
  log: AuditTrail;
  clock: Clock;
}

/** How the entry reads the response and the request; both optional. */
export interface AuditedUseCaseReaders<Request, Response> {
  /** What the action produced, from a successful response. */
  result?: (response: Response) => AuditResult | undefined;
  /** The reason the operator declared, from the request. */
  reason?: (request: Request) => string | undefined;
  /** The merchant the action produced, when the request could not name one (a creation). */
  merchantId?: (response: Response) => MerchantId | undefined;
}

const OUT_OF_SCOPE = "merchant-out-of-scope";

/** The failed Result's error, or undefined for a success or a response that is not a Result. */
function errorOf(response: unknown): DomainError | undefined {
  const error: unknown =
    typeof response === "object" && response !== null ? Reflect.get(response, "error") : undefined;
  return error instanceof DomainError ? error : undefined;
}

function outcomeOf(error: DomainError | undefined): AuditOutcome {
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
      merchantId: request.merchantId ?? this.#readers.merchantId?.(response),
      outcome,
      ...(error === undefined ? {} : { code: error.code }),
      ...(result === undefined ? {} : { result }),
      ...(reason === undefined ? {} : { reason }),
    });
    return response;
  }
}
