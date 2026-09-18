// Identities of the system (01-arquitectura-mvp.md §6), as branded types: the compiler prevents
// passing a SessionId where a VisitorId goes. An identity lives in the shared kernel only when
// modules that cannot depend on each other share it (ADR-024): the tenant (`MerchantId`,
// constitution V), the SDK identities no module owns (`SessionId`, `VisitorId`) and the
// experiment the ledger references (`ExperimentId`; `experiment` already depends on `ledger`).
// An identity with one owner lives with it (`DecisionId` in ledger, `EventId` in ingestion).

declare const brand: unique symbol;
/** A `T` the compiler tells apart from every other `T` by its brand `B`. */
export type Branded<T, B extends string> = T & { readonly [brand]: B };

/** Internal (derived from the credential, constitution V); it has no pattern. */
export type MerchantId = Branded<string, "MerchantId">;
export type SessionId = Branded<string, "SessionId">;
export type VisitorId = Branded<string, "VisitorId">;
export type ExperimentId = Branded<string, "ExperimentId">;

/** Constructors: the contract already validated the pattern; here only the brand is applied. */
export const asMerchantId = (value: string): MerchantId => value as MerchantId;
export const asSessionId = (value: string): SessionId => value as SessionId;
export const asVisitorId = (value: string): VisitorId => value as VisitorId;
export const asExperimentId = (value: string): ExperimentId => value as ExperimentId;
