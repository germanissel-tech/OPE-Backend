// The two levels of the release, read from the store where an operator publishes them (feature 036).
//
// **This is the file that stops the release from being the source.** It used to be
// `releaseConfigurationLevels`, which answered the entities the boot had built out of the files; now the
// files are the seed and what is in force is the newest version of each level. The service that asks holds
// the answer in memory, so the decision path pays nothing (research R-03).
//
// **The version name is minted here from the number**, because the content an operator publishes does not
// carry one: a level version travels as `platform-3` or `defaults-1`, and that string is its position in an
// immutable history rather than something anyone typed.
//
// **The content goes through the same readers the boot uses**, and not through a cast. They are what knows
// the vocabulary of each level, so a stored version that does not parse says which field is wrong — and it
// **throws**, because that is not a business outcome an operator can act on: it is this build failing to read
// a version it wrote itself, which means a rule changed without its migration. Serving a treatment nobody
// published is the one thing this must not do quietly.
import {
  readPlatformConfiguration,
  readTreatmentDefaults,
  type ConfigurationLevels,
  type LevelStore,
  type ShapeResult,
} from "../../../application/configuration/index.js";
import type { ConfigurationLevel, LevelVersion } from "../../../domain/configuration/index.js";

/** The content of the version in force of a level, with the name its number mints. */
async function inForce(store: LevelStore, level: ConfigurationLevel): Promise<Record<string, unknown>> {
  const version: LevelVersion | undefined = await store.latestOf(level);
  if (version === undefined) {
    throw new Error(`The ${level} level holds no version: the seed was not imported before it was read.`);
  }
  return { ...version.content, version: version.versionName() };
}

/** What a level that does not parse is: a build reading its own record wrong, never an operator's problem. */
function judged<T>(level: ConfigurationLevel, read: ShapeResult<T>): T {
  if (!read.ok) {
    throw new Error(`The ${level} level in force does not parse: ${read.error.message}`);
  }
  return read.value;
}

export function storedConfigurationLevels(store: LevelStore): ConfigurationLevels {
  return {
    async platform() {
      return judged("platform", readPlatformConfiguration(await inForce(store, "platform")));
    },
    async defaults() {
      return judged("defaults", readTreatmentDefaults(await inForce(store, "defaults")));
    },
  };
}
