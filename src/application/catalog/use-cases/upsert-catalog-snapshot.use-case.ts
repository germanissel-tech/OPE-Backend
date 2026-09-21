// Use case: the platform replaces the merchant's catalogue (ADR-025). The snapshot is built by
// its factory (invariants), compared with the current one by `capturedAt` (older: out of order;
// same instant: idempotent if the content is the same, a conflict if not; newer: replaces) and
// the summary carries the observed synchronisation level. A store that cannot accept the
// snapshot answers LedgerUnavailable and the platform retries (ADR-021): nothing is replaced.
import {
  CatalogOutOfOrder,
  CatalogSnapshot,
  type CatalogError,
  type SyncLevel,
  type Product,
} from "../../../domain/catalog/index.js";
import {
  fail,
  IdempotencyConflict,
  ok,
  type MerchantId,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, ClockTolerance, Logger, UseCase } from "../../shared-kernel/index.js";
import type { CatalogPolicies } from "../ports/catalog-policies.js";
import type { CatalogStore } from "../ports/catalog-store.js";

export interface UpsertCatalogSnapshotRequest {
  merchantId: MerchantId;
  capturedAt: Date;
  products: readonly Product[];
}

export interface CatalogSummary {
  products: number;
  variants: number;
  receivedAt: Date;
  observedSyncLevel: SyncLevel;
  /** `created` for a new instant; `repeated` when the same instant with the same content came again. */
  outcome: "created" | "repeated";
}

export type UpsertCatalogSnapshotResponse = Result<
  CatalogSummary,
  CatalogError | IdempotencyConflict | LedgerUnavailable
>;

export interface UpsertCatalogSnapshotDependencies {
  clock: Clock;
  tolerance: ClockTolerance;
  store: CatalogStore;
  policies: CatalogPolicies;
  logger: Logger;
}

export class UpsertCatalogSnapshotUseCase implements UseCase<
  UpsertCatalogSnapshotRequest,
  UpsertCatalogSnapshotResponse
> {
  readonly #deps: UpsertCatalogSnapshotDependencies;

  constructor(deps: UpsertCatalogSnapshotDependencies) {
    this.#deps = deps;
  }

  async execute(request: UpsertCatalogSnapshotRequest): Promise<UpsertCatalogSnapshotResponse> {
    const { clock, tolerance, store, policies, logger } = this.#deps;
    const now = clock.now();
    const built = CatalogSnapshot.of(
      {
        merchantId: request.merchantId,
        capturedAt: request.capturedAt,
        receivedAt: now,
        products: request.products,
      },
      tolerance.skewMs(),
    );
    if (!built.ok) return fail(built.error);
    const snapshot = built.value;
    const current = await store.current(request.merchantId);
    if (current !== undefined) {
      const order = snapshot.capturedAt.getTime() - current.capturedAt.getTime();
      if (order < 0) return fail(new CatalogOutOfOrder(current.capturedAt, snapshot.capturedAt));
      if (order === 0) {
        if (!current.sameContentAs(snapshot)) {
          return fail(new IdempotencyConflict(`A snapshot captured at ${current.capturedAt.toISOString()}`));
        }
        return ok(await this.#summary(request.merchantId, current, "repeated"));
      }
    }
    const rules = await policies.syncLevelRulesFor(request.merchantId);
    const written = await store.replace(request.merchantId, snapshot, rules.receiptsKept);
    if (!written.ok) return fail(written.error);
    const summary = await this.#summary(request.merchantId, snapshot, "created");
    logger.info(
      {
        merchantId: request.merchantId,
        products: summary.products,
        variants: summary.variants,
        observedSyncLevel: summary.observedSyncLevel,
      },
      "catalog snapshot replaced",
    );
    return ok(summary);
  }

  async #summary(
    merchantId: MerchantId,
    snapshot: CatalogSnapshot,
    outcome: CatalogSummary["outcome"],
  ): Promise<CatalogSummary> {
    const { products, variants } = snapshot.counts();
    const rules = await this.#deps.policies.syncLevelRulesFor(merchantId);
    const level = rules.observe(await this.#deps.store.receipts(merchantId), this.#deps.clock.now());
    return { products, variants, receivedAt: snapshot.receivedAt, observedSyncLevel: level, outcome };
  }
}
