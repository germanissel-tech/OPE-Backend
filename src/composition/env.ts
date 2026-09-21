// What every reader of the environment shares (ADR-024, ADR-031): a variable as text, JSON
// parsed with the variable named on failure, and the problems the shape readers report.
import { ConfigError, type Variable } from "./config-error.js";

export const NOT_AN_OBJECT = "is not an object";
export const NON_EMPTY_STRING = "must be a non-empty string";
export const STRING_ARRAY = "must be an array of strings";

export function parseJson(variable: Variable, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      variable,
      `is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

/** A variable set to blank counts as unset: nothing here means "empty string". */
export function text(env: NodeJS.ProcessEnv, name: Variable): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}
