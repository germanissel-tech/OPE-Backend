// Fixture de tests/architecture: violación deliberada o módulo auxiliar.
import type { Decision } from "../../domain/ledger/index.js";
export const record = (d: Decision): Decision => d;
