// FR-046 / US2 escenario 7: un manejador sólo compila si devuelve un status declarado con el
// cuerpo declarado. Este archivo se verifica con `npm run typecheck` (no se ejecuta).
import type { Handlers, OperationHandler } from "../../src/server/handlers.js";

// Compila: 200 con Health completo.
export const ok: OperationHandler<"getHealth"> = async () => ({
  status: 200,
  body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// Compila: 500 con Problem Details (declarado en el contrato).
export const problemResponse: OperationHandler<"getHealth"> = async () => ({
  status: 500,
  body: { type: "urn:ope:problem:internal-error", title: "Error interno", status: 500 },
});

// @ts-expect-error faltan contractVersion y timestamp en Health.
export const incomplete: OperationHandler<"getHealth"> = async () => ({ status: 200, body: { status: "ok" } });

// @ts-expect-error 201 no está declarado para getHealth.
export const undeclaredStatus: OperationHandler<"getHealth"> = async () => ({
  status: 201,
  body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// @ts-expect-error "down" no es un valor del enum de status.
export const badEnum: OperationHandler<"getHealth"> = async () => ({
  status: 200,
  body: { status: "down", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// @ts-expect-error no existe la operación "doesNotExist" en el contrato.
export const unknownOperation: Handlers = { doesNotExist: ok };
