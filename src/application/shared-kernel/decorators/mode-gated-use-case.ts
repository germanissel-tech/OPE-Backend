// The entry by a mode that does not govern the flow is refused (feature 044, ADR-047; research R-08): a `push`
// to a flow the merchant has OPE read, or a notice to a flow that is not subscribed. Accepting it would leave
// two writers of one truth, and the one the merchant chose would not know about the other.
//
// A decorator and not a check inside each use case, because the use case does not know who calls it: the
// scheduler deposits through the same four use cases the `push` does, and only the composition knows which
// entrance it is wiring. So the composition puts this in front of the entrance, with the mode that entrance
// is, and the use case behind stays the same for every mode. A cross-cutting concern like LoggedUseCase and
// AuditedUseCase, so it lives with them: the modules of the entrances and the platform module, which feeds the
// same use cases by the other modes, cannot depend on each other.
import {
  fail,
  SyncModeNotConfigured,
  type Fail,
  type MerchantId,
  type SyncFlow,
  type SyncMode,
} from "../../../domain/shared-kernel/index.js";
import type { SyncStrategies } from "../ports/sync-strategies.js";
import type { UseCase } from "../use-case.js";

export interface ModeGatedUseCaseDependencies {
  strategies: SyncStrategies;
}

/**
 * Which flow the entrance feeds, and by which mode it arrives. The flow is fixed for the entrances of one flow, and
 * read from the request for the one that names it — a notice says whether it is about an order or a return.
 */
export interface ModeGate<Request = unknown> {
  flow: SyncFlow | ((request: Request) => SyncFlow);
  mode: SyncMode;
}

export class ModeGatedUseCase<Request extends { merchantId: MerchantId }, Response> implements UseCase<
  Request,
  Response | Fail<SyncModeNotConfigured>
> {
  readonly #inner: UseCase<Request, Response>;
  readonly #deps: ModeGatedUseCaseDependencies;
  readonly #gate: ModeGate<Request>;

  constructor(
    inner: UseCase<Request, Response>,
    deps: ModeGatedUseCaseDependencies,
    gate: ModeGate<Request>,
  ) {
    this.#inner = inner;
    this.#deps = deps;
    this.#gate = gate;
  }

  /** The mode in force is read on every entry: a new configuration version changes it without a restart. */
  async execute(request: Request): Promise<Response | Fail<SyncModeNotConfigured>> {
    const { mode } = this.#gate;
    const flow = typeof this.#gate.flow === "function" ? this.#gate.flow(request) : this.#gate.flow;
    const configured = await this.#deps.strategies.modeOf(request.merchantId, flow);
    if (configured !== mode) return fail(new SyncModeNotConfigured(flow, configured));
    return this.#inner.execute(request);
  }
}
