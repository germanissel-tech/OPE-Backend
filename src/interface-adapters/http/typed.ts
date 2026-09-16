// Handler types, derived from the types generated from the contract (FR-046).
// A handler receives the typed request of its operation and can only return a declared status
// with the body declared for that status; anything else does not compile.
import type { operations } from "./generated/api.js";

/** Minimal shape of an operation as openapi-typescript generates it. */
export interface OperationShape {
  parameters: { query?: unknown; header?: unknown; path?: unknown; cookie?: unknown };
  requestBody?: unknown;
  responses: object;
}

/** Constraint for an operations map (works with interfaces without an index signature). */
export type OperationsMap<Ops> = { [Id in keyof Ops]: OperationShape };

type Content<R> = R extends { content: infer C } ? C[keyof C] : undefined;

type Body<Op extends OperationShape> = Op["requestBody"] extends { content: infer C }
  ? C[keyof C]
  : undefined;

type StatusOf<Op extends OperationShape> = Extract<keyof Op["responses"], number>;

export interface TypedRequest<Op extends OperationShape, Id extends string = string> {
  operationId: Id;
  /** Request path, for the `instance` of Problem Details. */
  instance: string;
  path: Op["parameters"]["path"];
  query: Op["parameters"]["query"];
  headers: Op["parameters"]["header"];
  cookie: Op["parameters"]["cookie"];
  body: Body<Op>;
  /** Result of the security handlers, by scheme name (empty if the operation is public). */
  security: SecurityResults;
}

/** What each security handler returned, indexed by the contract scheme name. */
export type SecurityResults = Readonly<Record<string, unknown>>;

/** Request as a security handler sees it: only the headers (the credential and the Origin). */
export interface SecurityRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

/**
 * A security handler returns the principal (what the controller will read) and, optionally,
 * safe fields for the request log (never credentials); or throws a `SecurityError`, which the
 * server translates to Problem Details with its status.
 */
export interface SecurityOutcome {
  principal: unknown;
  log?: Readonly<Record<string, string | number | boolean>>;
}
export type SecurityHandler = (req: SecurityRequest) => SecurityOutcome;

export type SecurityFailure = "unauthorized" | "origin-not-allowed";

export class SecurityError extends Error {
  readonly slug: SecurityFailure;
  constructor(slug: SecurityFailure) {
    super(slug);
    this.name = "SecurityError";
    this.slug = slug;
  }
}

/** Union discriminated by `status` of the responses declared for the operation. */
export type TypedResponse<Op extends OperationShape> = {
  [S in StatusOf<Op>]: {
    status: S;
    body: Content<Op["responses"][S]>;
    headers?: Record<string, string>;
  };
}[StatusOf<Op>];

/** Handler of one operation. Depends only on that operation, not on the whole map. */
export type Handler<Op extends OperationShape, Id extends string = string> = (
  req: TypedRequest<Op, Id>,
) => Promise<TypedResponse<Op>>;

/** Handler of one operation of the generated contract. */
export type OperationHandler<Id extends keyof operations> = Handler<operations[Id], Id>;

/**
 * Map operationId → handler. Partial because an operation declared without a handler must
 * respond 501 at runtime (FR-044), not fail compilation.
 */
export type Handlers<Ops extends OperationsMap<Ops> = operations> = Partial<{
  [Id in keyof Ops]: Handler<Ops[Id], Id & string>;
}>;

export type { operations };
