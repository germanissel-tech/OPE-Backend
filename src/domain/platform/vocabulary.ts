// What OPE reads a merchant's platform with (ADR-047): a closed vocabulary, replica of the contract
// (`PlatformSource`); a test verifies they match. A new source is a feature. How each flow arrives is the
// kernel's vocabulary (`domain/shared-kernel/sync.ts`), because more modules than this one need it.

/** `generic` reads nothing (all of it arrives by `push`). */
export const PLATFORM_SOURCES = ["generic", "test"] as const;
export type PlatformSourceName = (typeof PLATFORM_SOURCES)[number];
