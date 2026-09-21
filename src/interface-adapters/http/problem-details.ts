// Problem Details (RFC 9457). The API's only error shape.
// The problem types replicate contracts/problem-types.yaml (the source); a test verifies that
// both catalogues match.
import { HTTP_STATUS } from "./status.js";
import type { components } from "./generated/api.js";

export type ProblemDetails = components["schemas"]["ProblemDetails"];
export type ValidationError = NonNullable<ProblemDetails["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
export const PROBLEM_NAMESPACE = "urn:ope:problem:";
const CONFIRMED_IN_FUTURE = "The confirmation instant is in the future";

export const PROBLEM_TYPES = {
  "validation-failed": {
    status: HTTP_STATUS.BAD_REQUEST,
    title: "The request does not satisfy the contract",
  },
  unauthorized: { status: HTTP_STATUS.UNAUTHORIZED, title: "Credential missing or invalid" },
  "not-found": { status: HTTP_STATUS.NOT_FOUND, title: "Path not declared in the contract" },
  "method-not-allowed": { status: HTTP_STATUS.METHOD_NOT_ALLOWED, title: "Method not declared for the path" },
  unprocessable: { status: HTTP_STATUS.UNPROCESSABLE_CONTENT, title: "Valid request rejected on semantics" },
  "internal-error": { status: HTTP_STATUS.INTERNAL_ERROR, title: "Internal error" },
  "response-contract-violation": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The handler response does not satisfy the contract",
  },
  "not-implemented": { status: HTTP_STATUS.NOT_IMPLEMENTED, title: "Operation declared without a handler" },
  "origin-not-allowed": { status: HTTP_STATUS.FORBIDDEN, title: "Origin not registered for the merchant" },
  "session-visitor-mismatch": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The batch mixes sessions or visitors",
  },
  "event-timestamp-out-of-range": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The event timestamp is out of tolerance",
  },
  "exposure-decision-unknown": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The decision does not exist for this merchant",
  },
  "exposure-of-no-op": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "A NO_OP decision has no intervention to expose",
  },
  "idempotency-conflict": { status: HTTP_STATUS.CONFLICT, title: "Same identity, different content" },
  "ledger-unavailable": { status: HTTP_STATUS.SERVICE_UNAVAILABLE, title: "The ledger is not available" },
  "store-unavailable": { status: HTTP_STATUS.SERVICE_UNAVAILABLE, title: "The store is not available" },
  // Configuration errors (ADR-024): DomainErrors that stop the start; no operation emits them.
  "invalid-treatment-share": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The treatment share of an experiment is out of range",
  },
  "invalid-seed": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The seed of an experiment is empty",
  },
  "invalid-origin": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "A registered origin is not scheme://host[:port]",
  },
  "invalid-platform-secret": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A platform signing secret is empty or collides with a key",
  },
  "invalid-money": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A monetary amount or currency is malformed",
  },
  "platform-key-collision": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A platform key is empty or equal to an ingest key",
  },
  "invalid-ingest-keys": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A merchant needs one or two non-empty ingest keys",
  },
  "invalid-origins": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A merchant needs at least one registered origin",
  },
  "invalid-platform-keys": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A merchant has more than two platform keys",
  },
  "invalid-platform-secrets": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A merchant has more than two platform signing secrets",
  },
  "duplicate-experiment-id": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "Two experiments of a merchant share an identifier",
  },
  // Border of the HTTP adapter: the body limit of the consumer, judged before the body is read.
  "payload-too-large": {
    status: HTTP_STATUS.PAYLOAD_TOO_LARGE,
    title: "The request body exceeds the limit of its consumer",
  },
  "capability-missing": {
    status: HTTP_STATUS.FORBIDDEN,
    title: "The credential lacks a capability the operation requires",
  },
  "catalog-duplicate-product-id": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "Two products share an identifier",
  },
  "catalog-duplicate-variant-id": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "Two variants share an identifier",
  },
  "catalog-captured-in-future": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The capture instant is in the future",
  },
  "catalog-out-of-order": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The snapshot is older than the current one",
  },
  "invalid-sync-level-rules": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A synchronisation level threshold is not a positive integer",
  },
  "invalid-freshness-budget": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A freshness budget is not a positive number of milliseconds",
  },
  // Platform signature (ADR-029): the security handler answers them before the body is read.
  "signature-missing": { status: HTTP_STATUS.UNAUTHORIZED, title: "The request is not signed" },
  "signature-invalid": { status: HTTP_STATUS.UNAUTHORIZED, title: "The signature does not match" },
  "signature-expired": {
    status: HTTP_STATUS.UNAUTHORIZED,
    title: "The signature timestamp is outside the window",
  },
  // Outcomes (ADR-028): orders and returns.
  "duplicate-order-item": { status: HTTP_STATUS.UNPROCESSABLE_CONTENT, title: "Two order lines share a SKU" },
  "order-confirmed-in-future": { status: HTTP_STATUS.UNPROCESSABLE_CONTENT, title: CONFIRMED_IN_FUTURE },
  "corroboration-confirmed-in-future": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: CONFIRMED_IN_FUTURE,
  },
  "order-unknown": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The order does not exist for this merchant",
  },
  "return-items-not-in-order": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "A returned item is not in the order",
  },
  // Administration (feature 017, ADR-031): operators, merchants, configuration, experiments.
  "operator-unknown": { status: HTTP_STATUS.UNAUTHORIZED, title: "Operator token missing or unknown" },
  "merchant-out-of-scope": {
    status: HTTP_STATUS.FORBIDDEN,
    title: "The merchant is outside the operator's scope",
  },
  "merchant-not-found": { status: HTTP_STATUS.NOT_FOUND, title: "The merchant does not exist" },
  "merchant-deactivated": { status: HTTP_STATUS.CONFLICT, title: "The merchant is deactivated" },
  "origin-already-registered": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "An origin already belongs to another merchant",
  },
  "rotation-grace-too-long": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The rotation grace exceeds the platform maximum",
  },
  "configuration-frozen": {
    status: HTTP_STATUS.CONFLICT,
    title: "The configuration is frozen while an experiment is active",
  },
  "configuration-reason-required": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "A corrective configuration version needs a reason",
  },
  "invalid-configuration-value": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "A configuration value violates an invariant of its type",
  },
  "experiment-already-open": {
    status: HTTP_STATUS.CONFLICT,
    title: "The merchant already has an open experiment",
  },
  "experiment-not-open": {
    status: HTTP_STATUS.CONFLICT,
    title: "The experiment is not in a state that admits the transition",
  },
  "invalid-experiment-cuts": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The experiment cuts are not strictly increasing",
  },
  "invalid-target-sample": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The target sample is not an integer of at least 1",
  },
  "treatment-exceeds-holdout": {
    status: HTTP_STATUS.UNPROCESSABLE_CONTENT,
    title: "The treatment share leaves less than the holdout of the merchant",
  },
  "experiment-not-found": {
    status: HTTP_STATUS.NOT_FOUND,
    title: "The experiment does not exist",
  },
  "invalid-operator-tokens": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "An operator needs one or two non-empty token fingerprints",
  },
  "invalid-operator-scope": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: 'The scope of an operator is neither "*" nor a list of merchants',
  },
  // Decision policy configuration errors (ADR-026): they stop the start; no operation emits them.
  "invalid-rule-weight": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A rule weight or the policy weights are outside 0..1",
  },
  "invalid-rule-threshold": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A rule threshold or the reading seconds are negative",
  },
  "duplicate-rule-id": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "Two rules of a decision policy share an id, or an id is empty",
  },
  "unknown-barrier": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A rule names a barrier outside the closed vocabulary",
  },
  "unknown-fact": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A condition references an event type, subtype or block OPE does not capture",
  },
  "barrier-without-rules": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "A decision policy has a barrier with no rule",
  },
  "invalid-policy-version": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The decision policy version is empty",
  },
  "invalid-policy-threshold": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The confidence threshold of a decision policy is outside 0..1",
  },
  "invalid-policy-priority": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The priority of a decision policy is not a permutation of the three barriers",
  },
  "invalid-policy-evidence": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The evidence requirements of a decision policy name an unknown barrier",
  },
  // Commercial policy configuration errors (ADR-027): they stop the start; no operation emits them.
  "invalid-commercial-version": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The commercial policy version is empty",
  },
  "invalid-incentive-ceiling": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The incentive ceiling is not an integer percentage between 0 and 100",
  },
  "invalid-incentive-ladder": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The incentive ladder is not strictly increasing within 1 and the ceiling",
  },
  "invalid-margin": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The margin is not a percentage between 0 and 100",
  },
  "invalid-return-risk": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The return-risk condition references a fact OPE does not capture",
  },
  "invalid-intervention-budget": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "An interventions budget of the commercial policy is not an integer of at least 1",
  },
  "invalid-cooldown": {
    status: HTTP_STATUS.INTERNAL_ERROR,
    title: "The cooldown of the commercial policy is negative",
  },
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
  "store-unavailable": { "retry-after": String(LEDGER_RETRY_AFTER_SECONDS) },
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
