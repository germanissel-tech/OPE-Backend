// Business errors of the catalogue module (ADR-023, ADR-025): the invariants of a snapshot the
// schema cannot express (ADR-007). Codes are the Problem Details slugs of the catalogue.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "catalog" as const;

export class CatalogDuplicateProductId extends DomainError {
  readonly code = "catalog-duplicate-product-id" as const;
  readonly module = MODULE;
  constructor(productId: string) {
    super(`Product ${productId} appears twice in the snapshot.`);
  }
}

export class CatalogDuplicateVariantId extends DomainError {
  readonly code = "catalog-duplicate-variant-id" as const;
  readonly module = MODULE;
  constructor(variantId: string) {
    super(`Variant ${variantId} appears twice in the snapshot.`);
  }
}

/** The tolerance travels in `details`: the message does not repeat what its constant owns (015 F-022). */
export class CatalogCapturedInFuture extends DomainError {
  readonly code = "catalog-captured-in-future" as const;
  readonly module = MODULE;
  constructor(toleranceMs: number) {
    super("capturedAt is ahead of the server clock beyond the tolerance.", { toleranceMs });
  }
}

/** A delayed replica: its `capturedAt` is older than the snapshot OPE already holds. */
export class CatalogOutOfOrder extends DomainError {
  readonly code = "catalog-out-of-order" as const;
  readonly module = MODULE;
  constructor(currentCapturedAt: Date, incomingCapturedAt: Date) {
    super(
      `The current snapshot was captured at ${currentCapturedAt.toISOString()}; this one at ${incomingCapturedAt.toISOString()}.`,
    );
  }
}

/** A threshold of the synchronisation level rules that is not a positive integer (constitution XI): configuration, never a request. */
export class InvalidSyncLevelRules extends DomainError {
  readonly code = "invalid-sync-level-rules" as const;
  readonly module = MODULE;
  /** The field that offends. */
  readonly path: string;
  constructor(path: string) {
    super(
      "Every synchronisation level threshold must be a positive integer; the receipts kept cover the receipts judged.",
      { path },
    );
    this.path = path;
  }
}

/** A freshness budget that is not a positive number of milliseconds (constitution XI): configuration, never a request. */
export class InvalidFreshnessBudget extends DomainError {
  readonly code = "invalid-freshness-budget" as const;
  readonly module = MODULE;
  /** The field that offends. */
  readonly path: string;
  constructor(path: string) {
    super(
      "Every freshness budget must be a positive number of milliseconds; stock and price never outlive the catalogue.",
      { path },
    );
    this.path = path;
  }
}

export type CatalogError =
  CatalogDuplicateProductId | CatalogDuplicateVariantId | CatalogCapturedInFuture | CatalogOutOfOrder;

/** What the treatment configuration of the catalogue can violate (constitution XI); never a request. */
export type CatalogPolicyError = InvalidSyncLevelRules | InvalidFreshnessBudget;
