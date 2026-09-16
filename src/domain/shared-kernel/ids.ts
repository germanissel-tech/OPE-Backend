// Identidades del sistema (01-arquitectura-mvp.md §6): cuatro propósitos, cuatro tipos.
// Son tipos marcados: el compilador impide pasar un SessionId donde va un VisitorId.
// `MerchantId` es interno (se deriva de la credencial, constitución V) y no tiene patrón.

declare const brand: unique symbol;
type Branded<T, B extends string> = T & { readonly [brand]: B };

export type MerchantId = Branded<string, "MerchantId">;
export type SessionId = Branded<string, "SessionId">;
export type VisitorId = Branded<string, "VisitorId">;
export type EventId = Branded<string, "EventId">;
export type DecisionId = Branded<string, "DecisionId">;

/** Patrón de los identificadores que viajan por el contrato (los genera el SDK o el backend). */
export const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isWellFormedId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/** Constructores: el contrato ya validó el patrón; acá sólo se marca el tipo. */
export const asMerchantId = (value: string): MerchantId => value as MerchantId;
export const asSessionId = (value: string): SessionId => value as SessionId;
export const asVisitorId = (value: string): VisitorId => value as VisitorId;
export const asEventId = (value: string): EventId => value as EventId;
export const asDecisionId = (value: string): DecisionId => value as DecisionId;
