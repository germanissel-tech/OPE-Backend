// Puerto de generación de identificadores: el dominio no llama a crypto; recibe un generador.
import type { DecisionId } from "../../../domain/shared-kernel/index.js";

export interface IdGenerator {
  decisionId(): DecisionId;
}
