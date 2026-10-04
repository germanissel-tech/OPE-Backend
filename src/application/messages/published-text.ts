// What a publication of a text answers (feature 038), whichever layer it was for: the version, whether it
// was created or repeated, and the windows it restarted. The two use cases that publish answer the same
// thing and may not import each other (ADR-023), so the answer lives between them.
import type { Experiment } from "../../domain/experiment/index.js";
import type { TextVersion } from "../../domain/messages/index.js";

export interface PublishedText {
  version: TextVersion;
  outcome: "created" | "repeated";
  /** The experiments whose measurement window this version restarted; empty unless it was corrective. */
  windowsRestarted: readonly Experiment[];
}
