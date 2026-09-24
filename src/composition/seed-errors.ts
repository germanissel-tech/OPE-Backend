// A domain error of a factory becomes a configuration error naming the field of the seed
// (ADR-024): the rule is the domain's; the location is the configuration's.
import { ConfigError, type MerchantField } from "./config-error.js";
import type { MerchantSeed } from "../application/merchant/index.js";
import type { ExperimentError, ExperimentSetError } from "../domain/experiment/index.js";
import type { MerchantError } from "../domain/merchant/index.js";
import type { DomainError } from "../domain/shared-kernel/index.js";

/**
 * A domain error of a factory becomes a configuration error naming the field: the rule is the
 * domain's; the location is the configuration's. The entity judges the credentials as one
 * list (ingest, then platform, then signing): the index is translated back to the seed's field.
 */
export function rejected(at: MerchantField, error: DomainError, seed?: MerchantSeed): ConfigError {
  const field = FIELD_BY_CODE[error.code] ?? "";
  const position = error.details[INDEX_DETAIL];
  const offset = seed === undefined ? 0 : credentialOffset(field, seed);
  const index = typeof position === "number" ? `[${position - offset}]` : "";
  return new ConfigError(`${at}${field}${index}`, `is invalid (${error.message})`);
}

/** Where each credential field starts in the list the entity judges. */
function credentialOffset(field: ConfiguredField | "", seed: MerchantSeed): number {
  if (field === ".platformKeys") return seed.ingestKeys.length;
  if (field === ".platformSecrets") return seed.ingestKeys.length + seed.platformKeys.length;
  return 0;
}

/** The detail a domain error uses to name the offending element of a list. */
const INDEX_DETAIL = "index";

/** The configured fields a domain error of a merchant or an experiment can point at. */
type ConfiguredField =
  | ".treatmentShare"
  | ".seed"
  | ".ingestKeys"
  | ".origins"
  | ".platformKeys"
  | ".platformSecrets"
  | ".experiments"
  | ".targetSample"
  | ".cuts";

/** The errors the factories of a seed can return: the codes this file is allowed to name. */
type SeedCode = MerchantError["code"] | ExperimentError["code"] | ExperimentSetError["code"];

/**
 * Which configured field each domain error points at (`[index]` is appended when the error names
 * one). The annotation keeps the lookup by a plain `code`; `satisfies` is what checks the keys:
 * a code renamed in its module stops compiling here instead of falling through to `?? ""` and
 * naming the wrong field.
 */
const FIELD_BY_CODE: Readonly<Record<string, ConfiguredField>> = {
  "invalid-treatment-share": ".treatmentShare",
  "treatment-share-too-fine": ".treatmentShare",
  "invalid-seed": ".seed",
  "invalid-ingest-keys": ".ingestKeys",
  "invalid-origins": ".origins",
  "invalid-origin": ".origins",
  "invalid-platform-keys": ".platformKeys",
  "platform-key-collision": ".platformKeys",
  "invalid-platform-secrets": ".platformSecrets",
  "invalid-platform-secret": ".platformSecrets",
  "experiment-already-open": ".experiments",
  "duplicate-experiment-id": ".experiments",
  "invalid-target-sample": ".targetSample",
  "invalid-experiment-cuts": ".cuts",
} satisfies Readonly<Partial<Record<SeedCode, ConfiguredField>>>;
