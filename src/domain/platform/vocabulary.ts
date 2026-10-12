// What OPE reads a merchant's platform with (ADR-047): a closed vocabulary, replica of the contract
// (`PlatformSource`); a test verifies they match. A new source is a feature. How each flow arrives is the
// kernel's vocabulary (`domain/shared-kernel/sync.ts`), because more modules than this one need it.
import type { SyncFlow, SyncMode } from "../shared-kernel/index.js";

/** `generic` reads nothing (all of it arrives by `push`). */
export const PLATFORM_SOURCES = ["generic", "test"] as const;
export type PlatformSourceName = (typeof PLATFORM_SOURCES)[number];

/**
 * What a source reads each flow by, besides `push` (research R-08): `push` is not in the list because no
 * source executes it — the platform sends and the generic adapter receives — so every merchant has it.
 */
export type SourceModes = Readonly<Record<SyncFlow, readonly SyncMode[]>>;
