// The closed vocabularies of the configuration (constitution XI; ADR-031): where OPE may intervene and in which
// languages. Replicas of the contract (`Surface`); a test verifies they match. A new surface is a feature. How a
// flow reaches OPE is the platform module's vocabulary (`domain/platform/vocabulary.ts`), re-exported here.

/** The page types where OPE may intervene. */
export const SURFACES = ["product", "cart"] as const;
export type Surface = (typeof SURFACES)[number];

/** The languages of a merchant's store and the one to fall back to; an empty list restricts nothing. */
export interface Locales {
  supported: readonly string[];
  fallback?: string;
}
