// The identity of an operator of OPE (ADR-031): an opaque identifier, never a personal datum.
import type { Branded } from "../shared-kernel/index.js";

export type OperatorId = Branded<string, "OperatorId">;

/** The configuration already validated the shape; here only the brand is applied. */
export const asOperatorId = (value: string): OperatorId => value as OperatorId;

/** The actor of what the system does by itself (the import of the seed at start-up). */
export const SYSTEM_OPERATOR: OperatorId = asOperatorId("system");
