// Experiment identifier port: the owner of the experiment mints its identifier (randomness lives
// behind a port; the application imports nothing from Node).
import type { ExperimentId } from "../../../domain/shared-kernel/index.js";

export interface ExperimentIdMinter {
  mintExperimentId(): Promise<ExperimentId>;
}
