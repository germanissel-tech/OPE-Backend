// Application configuration: the only thing main.ts reads from the environment. It parses the
// shape of what it reads; the business rules belong to the domain (ADR-024): merchants and
// experiments are judged by their factories (merchants-config, experiments-config) and a
// rejected one stops the start naming the field. Since feature 017 (ADR-031) the merchants are
// a seed: what an empty store imports at start-up through the same use case as the API. The two
// levels of the release (constitution XI) are read from their files (levels-config). No built-in
// merchants: a server nobody configured authenticates nobody (fail-closed).
import path from "node:path";
import { ConfigError } from "./config-error.js";
import { readCorpus } from "./corpus-config.js";
import { text } from "./env.js";
import { readLevels, type ReleaseLevels } from "./levels-config.js";
import { readMerchants, type MerchantConfig } from "./merchants-config.js";
import { readOperators } from "./operators-config.js";
import type { Operator } from "../domain/operator/index.js";
import type { CorpusEntry } from "../interface-adapters/messages/index.js";

export type { MerchantConfig } from "./merchants-config.js";
export type { ReleaseLevels } from "./levels-config.js";
export { ConfigError } from "./config-error.js";

export interface AppConfig {
  port: number;
  host: string;
  contractPath: string;
  merchants: MerchantConfig[];
  /** The operators of OPE (ADR-031); none configured means nobody administers. */
  operators: Operator[];
  levels: ReleaseLevels;
  /** The curated texts of the release (feature 027). */
  corpus: readonly CorpusEntry[];
}

/** Port when `PORT` is not set: the usual local development port. */
const DEFAULT_PORT = 3000;
/** `PORT=0` asks the OS for a free port (tests); 65535 is the last TCP port. */
const MAX_PORT = 65535;

/** Builds the configuration from the environment, or throws a `ConfigError` naming what is wrong. */
export function readConfig(env: NodeJS.ProcessEnv, readFile: (file: string) => string): AppConfig {
  // The order of the reads is the order of the errors: with several things wrong you hear about the
  // seed of the merchants first, because that is what a person is most likely to have just edited.
  // The corpus needs the levels, so it is read after them and not in the literal.
  const merchants = readMerchants(env, readFile);
  const operators = readOperators(env, readFile);
  const levels = readLevels(env, readFile);
  return {
    port: readPort(text(env, "PORT")),
    host: text(env, "HOST") ?? "127.0.0.1",
    contractPath: path.resolve(text(env, "OPE_CONTRACT") ?? "contracts/dist/openapi.yaml"),
    merchants,
    operators,
    levels,
    corpus: readCorpus(env, readFile, defaultLocaleOf(levels)),
  };
}

/**
 * The language a corpus must be complete in: the merchant's reserve language when the release
 * declares one, else the first it serves. A release that declares neither has nothing to be
 * complete in, and the corpus check has nothing to say.
 */
function defaultLocaleOf(levels: ReleaseLevels): string {
  const { locales } = levels.defaults.values;
  return locales.fallback ?? locales.supported[0] ?? "";
}

/** Decimal digits only: `Number()` would also accept hex, exponents and blanks. */
const DECIMAL = /^\d+$/;

function readPort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = DECIMAL.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port > MAX_PORT) {
    throw new ConfigError("PORT", `must be an integer between 0 and ${MAX_PORT}, got "${raw}"`);
  }
  return port;
}
