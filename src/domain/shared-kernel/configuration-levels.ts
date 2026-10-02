// The three levels of the configuration, as a closed vocabulary (constitution XI).
//
// **It lives in the kernel because two modules that cannot depend on each other share it**: the
// configuration module owns the levels and their resolution, and an experiment records which level's version
// restarted its measurement window (feature 036). The context map forbids `experiment` from importing
// `configuration` — rightly, it has nothing to do with it — so the word they both need lives here, which is
// the same rule the shared identities follow.
//
// The literals are the constant: a union of literals is checked by the compiler, so there is nothing to
// declare twice (ADR-011).
export type ConfigurationLevel = "platform" | "defaults" | "merchant";

/** The two levels of the release, which an operator publishes by API; the third is a merchant's own. */
export type ReleaseLevel = Exclude<ConfigurationLevel, "merchant">;
