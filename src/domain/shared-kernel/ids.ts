// Identities of the system (01-arquitectura-mvp.md §6): four purposes, four types.
// They are branded types: the compiler prevents passing a SessionId where a VisitorId goes.
// `MerchantId` is internal (derived from the credential, constitution V) and has no pattern.

declare const brand: unique symbol;
type Branded<T, B extends string> = T & { readonly [brand]: B };

export type MerchantId = Branded<string, "MerchantId">;
export type SessionId = Branded<string, "SessionId">;
export type VisitorId = Branded<string, "VisitorId">;
export type EventId = Branded<string, "EventId">;
export type DecisionId = Branded<string, "DecisionId">;
export type ExperimentId = Branded<string, "ExperimentId">;

/** Constructors: the contract already validated the pattern; here only the brand is applied. */
export const asMerchantId = (value: string): MerchantId => value as MerchantId;
export const asSessionId = (value: string): SessionId => value as SessionId;
export const asVisitorId = (value: string): VisitorId => value as VisitorId;
export const asEventId = (value: string): EventId => value as EventId;
export const asDecisionId = (value: string): DecisionId => value as DecisionId;
export const asExperimentId = (value: string): ExperimentId => value as ExperimentId;
