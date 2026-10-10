// The closed vocabularies of the configuration (constitution X, XI; ADR-025, ADR-031, ADR-047): how each
// flow of the platform reaches OPE, what OPE reads it from, and where OPE may intervene. Replicas of the
// contract (`SyncMode`, `PlatformSource`, `Surface`); a test verifies they match. A new mode, source or
// surface is a feature.

/** `push`: the platform sends; `pull`: OPE reads at the merchant's cadence; `subscribe`: the platform notices and OPE reads. */
export const SYNC_MODES = ["push", "pull", "subscribe"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

/** The flows a merchant negotiates a mode for (02 §6). */
export const SYNC_FLOWS = ["catalog", "stockAndPrice", "orders", "returns"] as const;
export type SyncFlow = (typeof SYNC_FLOWS)[number];
export type SyncStrategy = Readonly<Record<SyncFlow, SyncMode>>;

/** What OPE reads a merchant's platform with: `generic` reads nothing (all of it arrives by `push`). */
export const PLATFORM_SOURCES = ["generic", "test"] as const;
export type PlatformSourceName = (typeof PLATFORM_SOURCES)[number];

/** The page types where OPE may intervene. */
export const SURFACES = ["product", "cart"] as const;
export type Surface = (typeof SURFACES)[number];

/** The languages of a merchant's store and the one to fall back to; an empty list restricts nothing. */
export interface Locales {
  supported: readonly string[];
  fallback?: string;
}
