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

export type CatalogError =
  CatalogDuplicateProductId | CatalogDuplicateVariantId | CatalogCapturedInFuture | CatalogOutOfOrder;
