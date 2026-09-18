// Problem Details (RFC 9457). The API's only error shape.
// The problem types replicate contracts/problem-types.yaml (the source); a test verifies that
// both catalogues match.
import type { components } from "./generated/api.js";

export type ProblemDetails = components["schemas"]["ProblemDetails"];
export type ValidationError = NonNullable<ProblemDetails["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
export const PROBLEM_NAMESPACE = "urn:ope:problem:";
export const PROBLEM_TYPES = {
  "validation-failed": { status: 400, title: "The request does not satisfy the contract" },
  unauthorized: { status: 401, title: "Credential missing or invalid" },
  "not-found": { status: 404, title: "Path not declared in the contract" },
  "method-not-allowed": { status: 405, title: "Method not declared for the path" },
  unprocessable: { status: 422, title: "Valid request rejected on semantics" },
  "internal-error": { status: 500, title: "Internal error" },
  "response-contract-violation": { status: 500, title: "The handler response does not satisfy the contract" },
  "not-implemented": { status: 501, title: "Operation declared without a handler" },
  "origin-not-allowed": { status: 403, title: "Origin not registered for the merchant" },
  "session-visitor-mismatch": { status: 422, title: "The batch mixes sessions or visitors" },
  "event-timestamp-out-of-range": { status: 422, title: "The event timestamp is out of tolerance" },
  "exposure-decision-unknown": { status: 422, title: "The decision does not exist for this merchant" },
  "exposure-of-no-op": { status: 422, title: "A NO_OP decision has no intervention to expose" },
  "idempotency-conflict": { status: 409, title: "Same identity, different content" },
  "ledger-unavailable": { status: 503, title: "The ledger is not available" },
} as const satisfies Record<string, { status: number; title: string }>;

export type ProblemSlug = keyof typeof PROBLEM_TYPES;

export interface ProblemOptions {
  detail?: string;
  instance?: string;
  errors?: ValidationError[];
}

export interface ProblemResponse {
  status: number;
  body: ProblemDetails;
}

/** Seconds the SDK waits before retrying a write the ledger could not accept (ADR-021). */
const LEDGER_RETRY_AFTER_SECONDS = 5;

/** Response headers a problem type carries, by code (ADR-023: `toProblem` adds them). */
export const HEADERS_BY_CODE: Partial<Record<ProblemSlug, Readonly<Record<string, string>>>> = {
  "ledger-unavailable": { "retry-after": String(LEDGER_RETRY_AFTER_SECONDS) },
};

/** Builds the error response for a catalogue type. Never includes internal details. */
export function problem(slug: ProblemSlug, options: ProblemOptions = {}): ProblemResponse {
  const { status, title } = PROBLEM_TYPES[slug];
  const body: ProblemDetails = { type: `${PROBLEM_NAMESPACE}${slug}`, title, status };
  if (options.detail !== undefined) body.detail = options.detail;
  if (options.instance !== undefined) body.instance = options.instance;
  if (options.errors !== undefined) body.errors = options.errors;
  return { status, body };
}
