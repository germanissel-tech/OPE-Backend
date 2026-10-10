// What a publication of a text answers (feature 038), whichever layer it was for: the version, whether it
// was created or repeated, and the windows it restarted. The two use cases that publish answer the same
// thing and may not import each other (ADR-023), so the answer lives between them.
import type { Experiment } from "../../domain/experiment/index.js";
import type { TextVersion } from "../../domain/messages/index.js";

/** A version of a text with the experiments whose window it restarted (feature 042): what every reading answers. */
export interface TextVersionRead {
  version: TextVersion;
  /** Empty when it restarted nothing: a version that is not corrective, or one that reached nobody. */
  windowsRestarted: readonly Experiment[];
}

/**
 * The version, what it restarted, and whether this request created it. A repetition answers what the
 * version restarted when it was published (feature 042), the same as any reading of it.
 */
export interface PublishedText extends TextVersionRead {
  outcome: "created" | "repeated";
}
