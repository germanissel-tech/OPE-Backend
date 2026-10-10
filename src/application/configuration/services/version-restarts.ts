// What a version of a level restarted, as every reading answers it (feature 042).
//
// **Asked of the experiments, not kept on the version.** A version is written before the windows it reaches
// restart, so a list stored with it would say what was about to happen; each experiment records the version
// that restarted it, and that record is the fact. It also answers for the versions published since feature
// 036, which kept nothing.
//
// The publication of a level answers it the same way when it repeats the version in force (feature 042,
// research R-04), so a retry of a corrective version says what the original restarted instead of nothing.
import type { LevelVersion, MerchantConfigurationVersion } from "../../../domain/configuration/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { WindowRestartsService } from "../../experiment/index.js";

/** A version of a level with the experiments whose window it restarted. */
export interface LevelVersionRead {
  version: LevelVersion;
  /** Empty when it restarted nothing: a version that is not corrective, or one that reached nobody. */
  windowsRestarted: readonly Experiment[];
}

/** The version, and what it restarted. */
export async function readOfLevel(
  restarts: WindowRestartsService,
  version: LevelVersion,
): Promise<LevelVersionRead> {
  return {
    version,
    windowsRestarted: await restarts.restartedBy({
      level: version.level,
      configurationVersion: version.version,
    }),
  };
}

/** A version of a merchant's configuration with the experiment whose window it restarted. */
export interface MerchantVersionRead {
  version: MerchantConfigurationVersion;
  /** Empty when it restarted nothing; at most the merchant's own active experiment otherwise (D-G). */
  windowsRestarted: readonly Experiment[];
}

/**
 * The version, and what it restarted. **Asked with the merchant**: a merchant numbers its own versions, so
 * «merchant, version 2» is one version per merchant and only the merchant tells them apart (research R-03).
 */
export async function readOfMerchant(
  restarts: WindowRestartsService,
  version: MerchantConfigurationVersion,
): Promise<MerchantVersionRead> {
  return {
    version,
    windowsRestarted: await restarts.restartedBy(
      { level: "merchant", configurationVersion: version.version },
      version.merchantId,
    ),
  };
}
