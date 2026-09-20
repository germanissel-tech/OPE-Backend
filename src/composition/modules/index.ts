// The modules of the system, in wiring order. Adding a module = adding its file and one entry
// here (and its entry in CONTEXT_MAP). This is the only list the composition root keeps.
import { adminModule } from "./admin.js";
import { barrierModule } from "./barrier.js";
import { catalogModule } from "./catalog.js";
import { decisionModule } from "./decision.js";
import { experimentModule } from "./experiment.js";
import { ingestionModule } from "./ingestion.js";
import { ledgerModule } from "./ledger.js";
import { merchantModule } from "./merchant.js";
import { outcomesModule } from "./outcomes.js";
import { systemModule } from "./system.js";
import type { Ports } from "../ports.js";
import type { Module } from "../wiring.js";

export const MODULES: readonly Module<Ports>[] = [
  systemModule,
  merchantModule,
  experimentModule,
  catalogModule,
  barrierModule,
  decisionModule,
  ingestionModule,
  ledgerModule,
  outcomesModule,
  adminModule,
];
