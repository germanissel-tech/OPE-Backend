// Lote de eventos de una sesión y sus invariantes (contrato: EventBatch.x-invariants; ADR-007).
// El esquema ya validó forma y rangos; acá van las reglas que el esquema no expresa.
import type { Event } from "./event.js";

export interface EventBatch {
  events: readonly Event[];
}

/** Tolerancia del instante respecto del reloj del backend: 24 h a pasado, 5 min a futuro. */
export const TIMESTAMP_TOLERANCE = { pastMs: 24 * 60 * 60 * 1000, futureMs: 5 * 60 * 1000 } as const;

export type BatchInvariant = "session-visitor-mismatch" | "event-timestamp-out-of-range";

export type BatchCheck = { ok: true } | { ok: false; invariant: BatchInvariant; detail: string };

/** Devuelve la primera invariante violada (en el orden en que están declaradas) o `ok`. */
export function checkBatch(batch: EventBatch, now: Date): BatchCheck {
  const [first, ...rest] = batch.events;
  if (first === undefined) return { ok: true };
  for (const event of rest) {
    if (event.sessionId !== first.sessionId || event.visitorId !== first.visitorId) {
      return {
        ok: false,
        invariant: "session-visitor-mismatch",
        detail: `El evento ${event.eventId} no pertenece a la sesión y el visitante del lote.`,
      };
    }
  }
  const earliest = now.getTime() - TIMESTAMP_TOLERANCE.pastMs;
  const latest = now.getTime() + TIMESTAMP_TOLERANCE.futureMs;
  for (const event of batch.events) {
    const t = event.occurredAt.getTime();
    if (Number.isNaN(t) || t < earliest || t > latest) {
      return {
        ok: false,
        invariant: "event-timestamp-out-of-range",
        detail: `El instante del evento ${event.eventId} está fuera de la tolerancia (24 h a pasado, 5 min a futuro).`,
      };
    }
  }
  return { ok: true };
}
