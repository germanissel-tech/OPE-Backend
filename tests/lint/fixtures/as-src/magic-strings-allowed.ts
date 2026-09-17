// Lint fixture (as if under src/): repeated literals the compiler already checks are not magic.
type Slug = "validation-failed" | "unauthorized";
declare function problem(slug: Slug): string;

/** The declaration names the constant: its literals are the name, not a repetition. */
export const SIGNALS = ["SIGINT", "SIGTERM"] as const satisfies readonly NodeJS.Signals[];

/** Argument checked against the literal union, twice. */
export function asArguments(): string {
  return problem("validation-failed") + problem("validation-failed");
}

/** Comparison and switch against a literal-typed value. */
export function asComparisons(kind: Slug, other: Slug): boolean {
  if (kind === "unauthorized") return true;
  switch (other) {
    case "unauthorized":
      return true;
    case "validation-failed":
      return false;
  }
}

/** The declared value of a variable (with a ternary); later uses are typed by inference. */
export function asDeclaredValue(values: string[]): boolean {
  const status = values.length > 0 ? "accepted" : "duplicate";
  return status === "accepted";
}

/** Punctuation is a separator, not a value that drifts; keys and declared properties are names. */
export function asPunctuationAndKeys(values: string[]): string {
  const record = { "content-type": values.join(", "), other: { "content-type": values.join(", ") } };
  return record["content-type"] + record.other["content-type"];
}
