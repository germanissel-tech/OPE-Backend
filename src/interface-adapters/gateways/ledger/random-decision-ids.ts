// Backend decision identifiers: UUID v4 without dashes (32 hex) with the `dec_` prefix, within
// the contract pattern (^[A-Za-z0-9_-]{8,64}$).
import { randomUUID } from "node:crypto";
import { asDecisionId } from "../../../domain/ledger/index.js";
import type { DecisionIdGenerator } from "../../../application/ledger/index.js";

export const randomDecisionIds: DecisionIdGenerator = {
  next: () => asDecisionId(`dec_${randomUUID().replaceAll("-", "")}`),
};
