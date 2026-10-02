// The two levels of the release (constitution XI; ADR-031 as amended by feature 036): the platform
// configuration and the treatment defaults, read from their files by the shape readers of the configuration
// module and judged by their factories; a value out of range stops the start naming the level and field.
//
// **The files hold values and no version, and that is the hole this closes.** They used to declare one by
// hand (`"version": "platform-2"`) that nothing read: the version of a level is minted by the store from its
// number, so the declared string was dead — and it could **collide**, because the second publication of that
// level mints `platform-2` for a different content. A name that means two treatments is exactly what
// numbering came to prevent, so the field is gone and the name of what the file holds is the one below.
import path from "node:path";
import { readPlatformConfiguration, readTreatmentDefaults } from "../application/configuration/index.js";
import { ConfigError } from "./config-error.js";
import { parseJson, text, withoutSchemaReference } from "./env.js";
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

/**
 * The content of a release file with the name of the **seed** on it, which is the name it travels under until
 * a store numbers it.
 *
 * It is **not** a version of the level and cannot be mistaken for one: a minted name is always
 * `<level>-<number>` (`platform-3`), so `-seed` collides with nothing a publication can produce. What reaches
 * the store is the content without it (`importConfigurationLevels`), and what every consumer reads afterwards
 * is the minted name. If this string ever shows up in a decision or in what the SDK receives, something
 * served the file instead of the level in force — and it says so instead of looking like version 1.
 */
const SEED_NAMES = { platform: "platform-seed", defaults: "defaults-seed" } as const;

function named(content: unknown, level: keyof typeof SEED_NAMES): unknown {
  // Anything that is not an object falls through, so what answers is the reader's own complaint about the
  // shape rather than a crash about a spread.
  if (typeof content !== "object" || content === null || Array.isArray(content)) return content;
  return { ...(content as Record<string, unknown>), version: SEED_NAMES[level] };
}

/** `OPE_PLATFORM_CONFIG` and `OPE_TREATMENT_DEFAULTS` name the files; the ones of the repository otherwise. */
export function readLevels(env: NodeJS.ProcessEnv, readFile: (file: string) => string): ReleaseLevels {
  const platform = readPlatformConfiguration(
    named(
      withoutSchemaReference(
        parseJson(
          "OPE_PLATFORM_CONFIG",
          readFile(path.resolve(text(env, "OPE_PLATFORM_CONFIG") ?? PLATFORM_FILE)),
        ),
      ),
      "platform",
    ),
  );
  if (!platform.ok) throw levelError("platform", platform.error);
  const defaults = readTreatmentDefaults(
    named(
      withoutSchemaReference(
        parseJson(
          "OPE_TREATMENT_DEFAULTS",
          readFile(path.resolve(text(env, "OPE_TREATMENT_DEFAULTS") ?? TREATMENT_DEFAULTS_FILE)),
        ),
      ),
      "defaults",
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
