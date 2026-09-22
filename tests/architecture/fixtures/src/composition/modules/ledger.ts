// Fixture de tests/architecture: el mapa de contextos rige también entre módulos de composición
// (feature 020, ADR-033): ledger sólo puede ver al kernel, y acá importa el módulo de merchants.
import { ok } from "../../interface-adapters/ledger/index.js";
import { merchantModule } from "./merchant.js";
export const ledgerModule = { ok, merchantModule };
