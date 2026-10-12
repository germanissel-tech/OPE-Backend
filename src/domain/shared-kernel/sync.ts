// How each flow of the platform reaches OPE (constitution X; ADR-025, ADR-047): a closed vocabulary, replica of
// the contract (`SyncMode`, the keys of `SyncStrategy`); a test verifies they match. A new mode is a feature.
//
// In the kernel because the modules that receive the flows (catalogue, outcomes), the one that declares their
// mode per merchant (configuration) and the one that reads the platform cannot all depend on each other
// (feature 044), like the barriers and the anchors.

/** `push`: the platform sends; `pull`: OPE reads at the merchant's cadence; `subscribe`: the platform notices and OPE reads. */
export const SYNC_MODES = ["push", "pull", "subscribe"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

/** The flows a merchant negotiates a mode for (02 §6). */
export const SYNC_FLOWS = ["catalog", "stockAndPrice", "orders", "returns"] as const;
export type SyncFlow = (typeof SYNC_FLOWS)[number];
export type SyncStrategy = Readonly<Record<SyncFlow, SyncMode>>;
