// Problem Details (RFC 9457). The API's only error shape. The problem types come generated from
// contracts/problem-types.yaml (`npm run contract:types`, generated/problem-types): one source,
// no replica; the status of every type is a literal, so a controller cannot answer a status
// the contract does not declare.
import { PROBLEM_NAMESPACE, PROBLEM_TYPES, type ProblemSlug } from "#generated/problem-types.js";
import type { components } from "#generated/api.js";

export { PROBLEM_TYPES, type ProblemSlug };

export type ProblemDetails = components["schemas"]["ProblemDetails"];
export type ValidationError = NonNullable<ProblemDetails["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export interface ProblemOptions {
  detail?: string;
  instance?: string;
  errors?: ValidationError[];
}

export interface ProblemResponse {
  status: number;
  body: ProblemDetails;
}

/** Builds the error response for a catalogue type. Never includes internal details. */
export function problem(slug: ProblemSlug, options: ProblemOptions = {}): ProblemResponse {
  const { status, title } = PROBLEM_TYPES[slug];
  const body: ProblemDetails = { type: `${PROBLEM_NAMESPACE}${slug}`, title, status };
  if (options.detail !== undefined) body.detail = options.detail;
  if (options.instance !== undefined) body.instance = options.instance;
  if (options.errors !== undefined) body.errors = options.errors;
  return { status, body };
}
