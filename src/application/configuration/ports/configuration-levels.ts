// The levels of the release (constitution XI; ADR-031 as amended by feature 036): the platform
// configuration and the treatment defaults, read from the store where an operator publishes them. The
// files that travel with the code are the seed of version 1; from the second boot what is in force is a
// published version, and this port answers it.
import type { PlatformConfiguration, TreatmentDefaults } from "../../../domain/configuration/index.js";

export interface ConfigurationLevels {
  platform(): Promise<PlatformConfiguration>;
  defaults(): Promise<TreatmentDefaults>;
}

/**
 * The platform level in force, read **when a value is used** and not handed over at construction
 * (feature 036, FR-015).
 *
 * **It is the shape of the fix and not a convenience.** Thirteen values of level 1 reached eleven
 * components as numbers when the server was built, which turned a configured value into a constant of the
 * process: publishing a version changed nothing until a restart. A reader is the smallest thing that keeps
 * them configurable — one call, in memory, with no I/O, so the decision path pays nothing — and it is why
 * ADR-031 now says that a level is read rather than baked at boot.
 *
 * It answers synchronously because what asks is often synchronous (the clock tolerance of the HTTP edge,
 * the bounds of a window the hot state evicts by). The service that implements it holds the level in
 * memory: the boot loads it before the server listens and a publication replaces it, so the only way this
 * can fail is being asked before the boot primed it, which is a programming error and says so.
 *
 * **An interface with a method and not a bare function**, which is a constraint of the composition rather
 * than a taste: a component a test replaces between cases is read through a proxy over its members, and a
 * component that *is* a function cannot be proxied that way.
 */
export interface PlatformLevelReader {
  inForce(): PlatformConfiguration;
}
