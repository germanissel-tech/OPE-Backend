// notifyPlatformChange (feature 044, ADR-047; research R-06): the platform says an order or a return changed, and
// OPE queues the notice to read it. Nothing of the notice is recorded as a fact of the order: what enters is what
// the scheduler reads. Whether the flow is in `subscribe` is the gate in front of this, not a check in here.
import {
  ok,
  type MerchantId,
  type NoticedFlow,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { NoticeQueue } from "../ports/notice-queue.js";

export interface AcceptNoticeRequest {
  merchantId: MerchantId;
  flow: NoticedFlow;
  reference: string;
  state?: string | undefined;
}

export interface NoticeAccepted {
  flow: NoticedFlow;
  reference: string;
  /** When the notice that is pending arrived: a repeated one answers the first. */
  receivedAt: Date;
}

export type AcceptNoticeResponse = Result<NoticeAccepted, StoreUnavailable>;

export interface AcceptNoticeDependencies {
  clock: Clock;
  queue: NoticeQueue;
}

export class AcceptNoticeUseCase implements UseCase<AcceptNoticeRequest, AcceptNoticeResponse> {
  readonly #deps: AcceptNoticeDependencies;

  constructor(deps: AcceptNoticeDependencies) {
    this.#deps = deps;
  }

  async execute(request: AcceptNoticeRequest): Promise<AcceptNoticeResponse> {
    const now = this.#deps.clock.now();
    // The first read is due at once: the scheduler reads it on its next tick.
    const queued = await this.#deps.queue.enqueue({ ...request, receivedAt: now, attempts: 0, nextAt: now });
    if (!queued.ok) return queued;
    const { flow, reference, receivedAt } = queued.value;
    return ok({ flow, reference, receivedAt });
  }
}
