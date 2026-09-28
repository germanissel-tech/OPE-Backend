// Identifiers of an arrival: UUID v4 without dashes (32 hex) with the `bat_` prefix, the same shape
// the ledger mints a decision with. It never travels to the SDK, so no contract pattern constrains
// it; keeping the shape anyway means an identifier of this system reads like one anywhere it is seen.
import { randomUUID } from "node:crypto";
import { asBatchId } from "../../../domain/ingestion/index.js";
import type { BatchIdGenerator } from "../../../application/ingestion/index.js";

export const randomBatchIds: BatchIdGenerator = {
  next: () => asBatchId(`bat_${randomUUID().replaceAll("-", "")}`),
};
