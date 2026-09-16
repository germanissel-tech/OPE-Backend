// Tipos de los manejadores, derivados de los tipos generados desde el contrato (FR-046).
// Un manejador recibe el request tipado de su operación y sólo puede devolver un status
// declarado con el cuerpo declarado para ese status; cualquier otra cosa no compila.
import type { operations } from "./generated/api.js";

/** Forma mínima de una operación tal como la genera openapi-typescript. */
export interface OperationShape {
  parameters: { query?: unknown; header?: unknown; path?: unknown; cookie?: unknown };
  requestBody?: unknown;
  responses: object;
}

/** Restricción para un mapa de operaciones (funciona con interfaces sin index signature). */
export type OperationsMap<Ops> = { [Id in keyof Ops]: OperationShape };

type Content<R> = R extends { content: infer C } ? C[keyof C] : undefined;

type Body<Op extends OperationShape> = Op["requestBody"] extends { content: infer C }
  ? C[keyof C]
  : undefined;

type StatusOf<Op extends OperationShape> = Extract<keyof Op["responses"], number>;

export interface TypedRequest<Op extends OperationShape, Id extends string = string> {
  operationId: Id;
  /** Path del request, para `instance` de Problem Details. */
  instance: string;
  path: Op["parameters"]["path"];
  query: Op["parameters"]["query"];
  headers: Op["parameters"]["header"];
  cookie: Op["parameters"]["cookie"];
  body: Body<Op>;
  /** Resultado de los security handlers, por nombre de esquema (vacío si la operación es pública). */
  security: SecurityResults;
}

/** Lo que cada security handler devolvió, indexado por el nombre del esquema del contrato. */
export type SecurityResults = Readonly<Record<string, unknown>>;

/** Request tal como lo ve un security handler: sólo los headers (la credencial y el Origin). */
export interface SecurityRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

/**
 * Un security handler devuelve el principal (lo que el controller va a leer) o lanza un
 * `SecurityError`; el servidor traduce el error a Problem Details con su status.
 */
export type SecurityHandler = (req: SecurityRequest) => unknown;

export type SecurityFailure = "unauthorized" | "origin-not-allowed";

export class SecurityError extends Error {
  readonly slug: SecurityFailure;
  constructor(slug: SecurityFailure) {
    super(slug);
    this.name = "SecurityError";
    this.slug = slug;
  }
}

/** Unión discriminada por `status` de las respuestas declaradas para la operación. */
export type TypedResponse<Op extends OperationShape> = {
  [S in StatusOf<Op>]: {
    status: S;
    body: Content<Op["responses"][S]>;
    headers?: Record<string, string>;
  };
}[StatusOf<Op>];

/** Manejador de una operación. Depende sólo de esa operación, no del mapa completo. */
export type Handler<Op extends OperationShape, Id extends string = string> = (
  req: TypedRequest<Op, Id>,
) => Promise<TypedResponse<Op>>;

/** Manejador de una operación del contrato generado. */
export type OperationHandler<Id extends keyof operations> = Handler<operations[Id], Id>;

/**
 * Mapa operationId → manejador. Parcial porque una operación declarada sin manejador debe
 * responder 501 en runtime (FR-044), no fallar la compilación.
 */
export type Handlers<Ops extends OperationsMap<Ops> = operations> = Partial<{
  [Id in keyof Ops]: Handler<Ops[Id], Id & string>;
}>;

export type { operations };
