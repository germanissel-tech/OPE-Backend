// The closed vocabularies of the configuration (constitution X, XI; ADR-025, ADR-031): how each
// flow of the platform reaches OPE, and where OPE may intervene. Replicas of the contract
// (`SyncMode`, `Surface`); a test verifies they match. A new mode or surface is a feature.

/** `push` is built (the platform notifies); `pull` and `subscribe` are accepted as a declaration until the platform port feature. */
export const SYNC_MODES = ["push", "pull", "subscribe"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

/** The flows a merchant negotiates a mode for (02 §6). */
export const SYNC_FLOWS = ["catalog", "stockAndPrice", "orders", "returns"] as const;
export type SyncFlow = (typeof SYNC_FLOWS)[number];
export type SyncStrategy = Readonly<Record<SyncFlow, SyncMode>>;

/** The page types where OPE may intervene. */
export const SURFACES = ["product", "cart"] as const;
export type Surface = (typeof SURFACES)[number];

/** The shape of a BCP 47 language tag (`es-AR`, `en`); the contract publishes the same pattern. */
export const LOCALE_PATTERN = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

/** The languages of a merchant's store and the one to fall back to; an empty list restricts nothing. */
export interface Locales {
  supported: readonly string[];
  fallback?: string;
}
