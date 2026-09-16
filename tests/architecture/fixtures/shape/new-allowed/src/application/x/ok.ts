// Shape fixture: builtins and domain classes may be instantiated anywhere.
import { randomUUID } from "node:crypto";
import { DomainError } from "../../domain/x/error.js";

export function ok(): unknown {
  const when = new Date();
  const seen = new Map<string, number>();
  const id = randomUUID();
  return { when, seen, id, err: new DomainError("x") };
}
