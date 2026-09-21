// The two levels of the release (constitution XI, ADR-031): the platform configuration and the
// treatment defaults, read from their files by the shape readers of the configuration module
// and judged by their factories; a value out of range stops the start naming the level and field.
import path from "node:path";
import { readPlatformConfiguration, readTreatmentDefaults } from "../application/configuration/index.js";
import { ConfigError } from "./config-error.js";
import { parseJson, text } from "./env.js";
import type {
  InvalidConfigurationValue,
  PlatformConfiguration,
  TreatmentDefaults,
} from "../domain/configuration/index.js";

/** The two levels of the release (constitution XI), judged by their factories. */
export interface ReleaseLevels {
  platform: PlatformConfiguration;
  defaults: TreatmentDefaults;
}

/** The files of the release that hold the platform configuration and the treatment defaults. */
const PLATFORM_FILE = "config/platform.json";
const TREATMENT_DEFAULTS_FILE = "config/treatment-defaults.json";

/** `OPE_PLATFORM_CONFIG` and `OPE_TREATMENT_DEFAULTS` name the files; the ones of the repository otherwise. */
export function readLevels(env: NodeJS.ProcessEnv, readFile: (file: string) => string): ReleaseLevels {
  const platform = readPlatformConfiguration(
    parseJson(
      "OPE_PLATFORM_CONFIG",
      readFile(path.resolve(text(env, "OPE_PLATFORM_CONFIG") ?? PLATFORM_FILE)),
    ),
  );
  if (!platform.ok) throw levelError("platform", platform.error);
  const defaults = readTreatmentDefaults(
    parseJson(
      "OPE_TREATMENT_DEFAULTS",
      readFile(path.resolve(text(env, "OPE_TREATMENT_DEFAULTS") ?? TREATMENT_DEFAULTS_FILE)),
    ),
  );
  if (!defaults.ok) throw levelError("treatmentDefaults", defaults.error);
  return { platform: platform.value, defaults: defaults.value };
}

/** A value of a level the domain refuses: the field, prefixed by the level, and the rule. */
function levelError(level: "platform" | "treatmentDefaults", error: InvalidConfigurationValue): ConfigError {
  const { pointer, problem } = error.details;
  return new ConfigError(`${level}.${String(pointer)}`, `is invalid (${String(problem)})`);
}
