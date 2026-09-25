// The local deployment: no external service. Ledgers, dedup, state and merchants in memory, the
// levels of the release from its files, the system clock and pino to stdout. Tests, `npm run dev`
// and every feature until the persistence feature of the map arrives. Not a deployment for
// traffic: the ledgers in memory never prune (they stand in for the durable ledger of 01 §9).
//
// The list has no significant order: what is resolved first is decided by dependency, and the
// order only fixes the order of creation that the shutdown reverses. Adding a module is one line
// here; forgetting it does not compile.
//
// Every module below enters bare because each is served in one way. One that declared two would
// enter as `ledgerModule.with("postgres")`, and leaving the call out would not compile: its type
// is then `ChooseATechnology`, which this list does not accept.
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
import { messagesModule } from "../modules/messages.js";
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
    messagesModule,
    decisionModule,
    ingestionModule,
    outcomesModule,
    configurationModule,
    adminModule,
  ]);
