// Experiment identifiers with the crypto of Node: `exp_` + 12 lowercase base32 characters.
import { asExperimentId } from "../../../domain/shared-kernel/index.js";
import { randomId } from "../../shared-kernel/index.js";
import type { ExperimentIdMinter } from "../../../application/experiment/index.js";

const EXPERIMENT_ID_PREFIX = "exp_";

export const nodeExperimentIdMinter: ExperimentIdMinter = {
  mintExperimentId: () => Promise.resolve(asExperimentId(randomId(EXPERIMENT_ID_PREFIX))),
};
