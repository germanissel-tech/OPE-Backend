// Problem Details (RFC 9457). The API's only error shape.
// The problem types replicate contracts/problem-types.yaml (the source); a test verifies that
// both catalogues match.
import type { components } from "./generated/api.js";

export type ProblemDetails = components["schemas"]["ProblemDetails"];
export type ValidationError = NonNullable<ProblemDetails["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
export const PROBLEM_NAMESPACE = "urn:ope:problem:";
const CONFIRMED_IN_FUTURE = "The confirmation instant is in the future";

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
  // Configuration errors (ADR-024): DomainErrors that stop the start; no operation emits them.
  "invalid-treatment-share": { status: 500, title: "The treatment share of an experiment is out of range" },
  "invalid-seed": { status: 500, title: "The seed of an experiment is empty" },
  "invalid-origin": { status: 500, title: "A registered origin is not scheme://host[:port]" },
  "invalid-money": { status: 500, title: "A monetary amount or currency is malformed" },
  "platform-key-collision": { status: 500, title: "A platform key is empty or equal to an ingest key" },
  "capability-missing": { status: 403, title: "The credential lacks a capability the operation requires" },
  "catalog-duplicate-product-id": { status: 422, title: "Two products share an identifier" },
  "catalog-duplicate-variant-id": { status: 422, title: "Two variants share an identifier" },
  "catalog-captured-in-future": { status: 422, title: "The capture instant is in the future" },
  "catalog-out-of-order": { status: 422, title: "The snapshot is older than the current one" },
  // Outcomes (ADR-028): orders and returns.
  "duplicate-order-item": { status: 422, title: "Two order lines share a SKU" },
  "order-confirmed-in-future": { status: 422, title: CONFIRMED_IN_FUTURE },
  "corroboration-confirmed-in-future": { status: 422, title: CONFIRMED_IN_FUTURE },
  "order-unknown": { status: 422, title: "The order does not exist for this merchant" },
  "return-items-not-in-order": { status: 422, title: "A returned item is not in the order" },
  // Decision policy configuration errors (ADR-026): they stop the start; no operation emits them.
  "invalid-rule-weight": { status: 500, title: "A rule weight or the policy weights are outside 0..1" },
  "invalid-rule-threshold": { status: 500, title: "A rule threshold or the reading seconds are negative" },
  "duplicate-rule-id": {
    status: 500,
    title: "Two rules of a decision policy share an id, or an id is empty",
  },
  "unknown-barrier": { status: 500, title: "A rule names a barrier outside the closed vocabulary" },
  "unknown-fact": {
    status: 500,
    title: "A condition references an event type, subtype or block OPE does not capture",
  },
  "barrier-without-rules": { status: 500, title: "A decision policy has a barrier with no rule" },
  "invalid-policy-version": { status: 500, title: "The decision policy version is empty" },
  "invalid-policy-threshold": {
    status: 500,
    title: "The confidence threshold of a decision policy is outside 0..1",
  },
  "invalid-policy-priority": {
    status: 500,
    title: "The priority of a decision policy is not a permutation of the three barriers",
  },
  "invalid-policy-evidence": {
    status: 500,
    title: "The evidence requirements of a decision policy name an unknown barrier",
  },
  // Commercial policy configuration errors (ADR-027): they stop the start; no operation emits them.
  "invalid-commercial-version": { status: 500, title: "The commercial policy version is empty" },
  "invalid-incentive-ceiling": {
    status: 500,
    title: "The incentive ceiling is not an integer percentage between 0 and 100",
  },
  "invalid-incentive-ladder": {
    status: 500,
    title: "The incentive ladder is not strictly increasing within 1 and the ceiling",
  },
  "invalid-margin": { status: 500, title: "The margin is not a percentage between 0 and 100" },
  "invalid-return-risk": {
    status: 500,
    title: "The return-risk condition references a fact OPE does not capture",
  },
  "invalid-intervention-budget": {
    status: 500,
    title: "An interventions budget of the commercial policy is not an integer of at least 1",
  },
  "invalid-cooldown": { status: 500, title: "The cooldown of the commercial policy is negative" },
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
