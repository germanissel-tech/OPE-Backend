// Generador de identificadores del backend: UUID v4 sin guiones (32 hex) con prefijo por tipo,
// dentro del patrón del contrato (^[A-Za-z0-9_-]{8,64}$).
import { randomUUID } from "node:crypto";
import { asDecisionId } from "../../../domain/shared-kernel/index.js";
import type { IdGenerator } from "../../../application/shared-kernel/index.js";

export const randomIds: IdGenerator = {
  decisionId: () => asDecisionId(`dec_${randomUUID().replaceAll("-", "")}`),
};
