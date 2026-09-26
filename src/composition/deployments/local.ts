// The local deployment: no external service and **nothing that outlives the process**. Ledgers,
// dedup, state and merchants in memory, the levels of the release from its files, the system clock
// and pino to stdout. It is what the test suite builds: the tests of `fast` prove behaviour, and
// behaviour does not change with where a record is kept, so putting them through a store would
// make them slower without proving anything new (feature 030, research R-06).
//
// **`npm run dev` and anything resembling a pilot use `durableDeployment`**, next to this one. The
// ledgers here never prune and never survive a restart, which is exactly what makes them fine for
// a test and useless for traffic.
//
// What both deployments have in common is `sharedModules`; what is written here is this
// deployment's own decision. A module that declares two technologies enters as `.with("memory")`,
// and leaving the call out does not compile: its type is then `ChooseATechnology`, which this list
// does not accept.
import { deployment } from "../graph/index.js";
import { experimentModule } from "../modules/experiment.js";
import { ledgerModule } from "../modules/ledger.js";
import { outcomesModule } from "../modules/outcomes.js";
import { sharedModules } from "./shared-modules.js";
import type { AppConfig } from "../config.js";

export const localDeployment = (config: AppConfig) =>
  deployment([
    ...sharedModules(config),
    experimentModule.with("memory"),
    ledgerModule.with("memory"),
    outcomesModule.with("memory"),
  ]);
