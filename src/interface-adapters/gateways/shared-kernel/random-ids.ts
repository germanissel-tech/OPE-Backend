// Backend identifier generator: UUID v4 without dashes (32 hex) with a prefix per type, within
// the contract pattern (^[A-Za-z0-9_-]{8,64}$).
import { randomUUID } from "node:crypto";
import { asDecisionId } from "../../../domain/shared-kernel/index.js";
import type { IdGenerator } from "../../../application/shared-kernel/index.js";

export const randomIds: IdGenerator = {
  decisionId: () => asDecisionId(`dec_${randomUUID().replaceAll("-", "")}`),
};
