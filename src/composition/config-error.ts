// A configuration value that cannot start the server (ADR-024): named after the variable or
// the field of `OPE_MERCHANTS`, never silently defaulted. Shared by the readers of the
// configuration; `config.ts` re-exports it for main and the tests.

/** The environment variables the server reads; anything else in the environment is ignored. */
export type Variable =
  | "PORT"
  | "HOST"
  | "OPE_CONTRACT"
  | "OPE_MERCHANTS"
  | "OPE_MERCHANTS_FILE"
  | "OPE_ADMIN_OPERATORS"
  | "OPE_ADMIN_OPERATORS_FILE"
  | "OPE_PLATFORM_CONFIG"
  | "OPE_TREATMENT_DEFAULTS";

/** A field inside the merchants configuration, as a path from `merchants[i]`. */
export type MerchantField = `merchants[${number}]${string}`;

/** A field inside the operators configuration, as a path from `operators[i]`. */
export type OperatorField = `operators[${number}]${string}`;

/** A field inside a level of the release, as a path from the file. */
export type LevelField = `platform.${string}` | `treatmentDefaults.${string}`;

export class ConfigError extends Error {
  constructor(variable: Variable | MerchantField | OperatorField | LevelField, problem: string) {
    super(`${variable} ${problem}.`);
    this.name = "ConfigError";
  }
}
