// The one translation from a business error to HTTP (ADR-023): `type` from the error code,
// status and title from the catalogue, `detail` from the message, headers by code. A code the
// catalogue does not know does not compile: the replica test keeps catalogue and domain in step.
import {
  HEADERS_BY_CODE,
  PROBLEM_TYPES,
  problem,
  type ProblemDetails,
  type ProblemSlug,
} from "./problem-details.js";
import type { DomainError } from "../../domain/shared-kernel/index.js";

/** A business error whose code the catalogue declares. */
export type CataloguedError = DomainError & { readonly code: ProblemSlug };

type ProblemStatus<C extends ProblemSlug> = (typeof PROBLEM_TYPES)[C]["status"];

/** The response of `toProblem`: one member per possible code, discriminated by its status. */
export type ProblemOf<E extends CataloguedError> = {
  [C in E["code"]]: {
    status: ProblemStatus<C>;
    body: ProblemDetails;
    headers?: Record<string, string>;
  };
}[E["code"]];

export function toProblem<E extends CataloguedError>(error: E, instance: string): ProblemOf<E> {
  const { body } = problem(error.code, { instance, detail: error.message });
  const status: ProblemStatus<E["code"]> = PROBLEM_TYPES[error.code].status;
  const headers = HEADERS_BY_CODE[error.code];
  const response = headers === undefined ? { status, body } : { status, body, headers };
  return response;
}
