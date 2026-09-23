// Handler types, derived from the types generated from the contract (FR-046).
// A handler receives the typed request of its operation and can only return a declared status
// with the body declared for that status; anything else does not compile.
import type { operations } from "#generated/api.js";
import type { ProblemSlug } from "./problem-details.js";

/** The types the contract generates (`npm run contract:types`): the modules of the ring read them from here. */
export type { components, operations } from "#generated/api.js";

/**
 * Which operations the contract orders to be audited (feature 021). Derived from the contract, so
 * nobody chooses it; the composition graph reads it from here, the way it reads `operations`.
 */
export type { AuditedOperation } from "#generated/audited-operations.js";
export { AUDITED_OPERATIONS } from "#generated/audited-operations.js";

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

/**
 * Request as a security handler sees it: the headers (the credential, the Origin, the signature)
 * and the body bytes exactly as received, for the platform signature (ADR-029). Never the parsed body.
 */
export interface SecurityRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawBody?: Uint8Array | undefined;
}

/**
 * A security handler returns the principal (what the controller will read) and, optionally,
 * safe fields for the request log (never credentials); or throws a `SecurityError`, which the
 * server translates to Problem Details with its status.
 */
export interface SecurityOutcome {
  principal: unknown;
  /** What the credential may do: the capabilities of its consumer (ADR-020); the server checks the operation's. */
  capabilities: readonly string[];
  log?: Readonly<Record<string, string | number | boolean>>;
}
export type SecurityHandler = (req: SecurityRequest) => SecurityOutcome | Promise<SecurityOutcome>;

/** A security scheme as a module wires it: the handler and the header that carries the credential (ADR-025). */
/** Who sends the credential: a browser (the SDK) or a server (the merchant's platform). */
export type SchemeConsumer = "browser" | "server";

export interface SecurityScheme {
  handler: SecurityHandler;
  /** Lowercase header name; log redaction derives from it, and CORS from the browser ones (ADR-025 §5, §7). */
  header: string;
  /** Only the headers of browser consumers are announced to a preflight: a server credential never travels from a page. */
  consumer: SchemeConsumer;
}

export class SecurityError extends Error {
  /** The problem type the server answers with: any code of the catalogue, decided by the handler. */
  readonly slug: ProblemSlug;
  constructor(slug: ProblemSlug) {
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
