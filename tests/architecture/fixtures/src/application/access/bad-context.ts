// Fixture de tests/architecture: el acceso lee el directorio de merchants y nada más; acá importa
// el ledger, que el mapa de contextos no le permite (feature 020, ADR-034).
import { record } from "../ledger/index.js";
export const bad = { record };
