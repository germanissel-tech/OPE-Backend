// Outcome of an operation that can fail on business rules (ADR-023): success with a value or
// failure with a DomainError. Closed over the root so nothing else can travel as an error.
import type { DomainError } from "./errors.js";

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}
export interface Fail<E extends DomainError> {
  readonly ok: false;
  readonly error: E;
}
export type Result<T, E extends DomainError> = Ok<T> | Fail<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const fail = <E extends DomainError>(error: E): Fail<E> => ({ ok: false, error });
