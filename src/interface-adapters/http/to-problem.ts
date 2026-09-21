// The one translation from a business error to HTTP (ADR-023): `type` from the error code,
// status and title from the catalogue, `detail` from the message, headers by code, and, when
// the error names the field it is about (`details.pointer`, a path like
// `declared.rules[2].when`), one `errors` entry with that field as a JSON pointer. A code the
// catalogue does not know does not compile: the catalogue is generated from the contract. The
// headers of a status (`Retry-After` of a 503) are the transport's: the infrastructure adds them.
import {
  PROBLEM_TYPES,
  problem,
  type ProblemDetails,
  type ProblemSlug,
  type ValidationError,
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

/** `a.b[2].c` → `/a/b/2/c`: the field a domain error names, as the contract publishes pointers. */
function jsonPointerOf(field: string): string {
  const segments = field.split(".").flatMap((part) => part.split("[").map((s) => s.replace("]", "")));
  return `/${segments.join("/")}`;
}

/** The field the error is about, when it names one. */
function errorsOf(error: CataloguedError): ValidationError[] | undefined {
  const { pointer, problem: rule } = error.details;
  if (typeof pointer !== "string") return undefined;
  return [{ pointer: jsonPointerOf(pointer), message: typeof rule === "string" ? rule : error.message }];
}

export function toProblem<E extends CataloguedError>(error: E, instance: string): ProblemOf<E> {
  const errors = errorsOf(error);
  const { body } = problem(error.code, {
    instance,
    detail: error.message,
    ...(errors === undefined ? {} : { errors }),
  });
  const status: ProblemStatus<E["code"]> = PROBLEM_TYPES[error.code].status;
  return { status, body };
}
