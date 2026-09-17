// Identifier generation port: the domain does not call crypto; it receives a generator.
import type { DecisionId } from "../../../domain/shared-kernel/index.js";

export interface IdGenerator {
  decisionId(): DecisionId;
}
