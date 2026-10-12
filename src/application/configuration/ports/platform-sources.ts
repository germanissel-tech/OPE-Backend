// What this deployment can read a platform with (feature 044, ADR-047; research R-08): the sources it
// installed and the modes each one reads every flow by. The configuration asks it before a version is
// published, so a mode nothing would execute is refused at its field instead of being silently ignored.
//
// A port and not a list in the configuration because what is installed is the deployment's decision: the test
// source exists in the local deployment and, in the durable one, only when it is asked for (R-09).
import type { PlatformSourceName, SourceModes } from "../../../domain/platform/index.js";

export interface PlatformSources {
  /** What the source reads each flow by besides `push`, or `undefined` when this deployment did not install it. */
  modesOf(source: PlatformSourceName): SourceModes | undefined;
}
