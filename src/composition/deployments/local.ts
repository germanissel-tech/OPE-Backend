// The local deployment: no external service. Ledgers, dedup, state and merchants in memory, the
// levels of the release from its files, the system clock and pino to stdout. Tests, `npm run dev`
// and every feature until the persistence feature of the map arrives. Not a deployment for
// traffic: the ledgers in memory never prune (they stand in for the durable ledger of 01 §9).
//
// The list has no significant order: what is resolved first is decided by dependency, and the
// order only fixes the order of creation that the shutdown reverses. Adding a module is one line
// here; forgetting it does not compile.
//
// A module names its technology only when it declares more than one: with a single way of serving
// it there is nothing to decide, and the compiler asks the question the day it exists.
import { deployment } from "../graph/index.js";
import { accessModule } from "../modules/access.js";
import { adminModule } from "../modules/admin.js";
import { barrierModule } from "../modules/barrier.js";
import { catalogModule } from "../modules/catalog.js";
import { configurationModule } from "../modules/configuration.js";
import { decisionModule } from "../modules/decision.js";
import { experimentModule } from "../modules/experiment.js";
import { ingestionModule } from "../modules/ingestion.js";
import { ledgerModule } from "../modules/ledger.js";
import { merchantModule } from "../modules/merchant.js";
import { outcomesModule } from "../modules/outcomes.js";
import { kernelModule } from "../modules/shared-kernel.js";
import { systemModule } from "../modules/system.js";
import { releaseComponents } from "../release.js";
import type { AppConfig } from "../config.js";

export const localDeployment = (config: AppConfig) =>
  deployment([
    releaseComponents(config),
    kernelModule,
    systemModule,
    merchantModule,
    accessModule,
    experimentModule,
    ledgerModule,
    catalogModule,
    barrierModule,
    decisionModule,
    ingestionModule,
    outcomesModule,
    configurationModule,
    adminModule,
  ]);
