// Identities of the catalogue: owned by the catalogue module. Product and variant identifiers
// are the platform's own (what the SDK resolves on the page); the brand only tells them apart.
import type { Branded } from "../shared-kernel/index.js";

export type ProductId = Branded<string, "ProductId">;
export type VariantId = Branded<string, "VariantId">;

/** The contract already validated the pattern; here only the brand is applied. */
export const asProductId = (value: string): ProductId => value as ProductId;
export const asVariantId = (value: string): VariantId => value as VariantId;
