// The durable deployment (feature 030): the same modules as the local one, with the ledger on a
// store that outlives the process. It is what `npm run dev` and anything resembling a pilot run
// on, because a restart there used to erase the experiment — not only the decisions, but the
// exposures that confirm them, the orders that attribute them and the arm each visitor fell into.
//
// **It is a second deployment and not a flag on the first, and that is the whole reason it exists
// apart**: the test suite builds the local one, and research R-06 decided that the tests of `fast`
// stay in memory. A single deployment with a switch would have made every one of them run through
// a store to prove behaviour that does not depend on storage.
//
// What is **not** durable yet, and each for its own reason:
//
//   - the experiments, the merchants and the configuration, which are rebuilt from the seed at
//     every start — that works today, and losing a published version is the third feature of the
//     milestone;
//   - the session and visitor state, which is the next feature and brings the atomicity of the
//     per-session budget with it.
//
// Leaving `storeComponents` out of this list does not compile: the three modules below ask for the
// store and `deployment()` names the component nobody provides.
import { deployment } from "../graph/index.js";
import { catalogModule } from "../modules/catalog.js";
import { experimentModule } from "../modules/experiment.js";
import { ledgerModule } from "../modules/ledger.js";
import { outcomesModule } from "../modules/outcomes.js";
import { storeComponents } from "../release.js";
import { sharedModules } from "./shared-modules.js";
import type { AppConfig } from "../config.js";

export const durableDeployment = (config: AppConfig) =>
  deployment([
    ...sharedModules(config),
    storeComponents(config),
    catalogModule.with("sqlite"),
    experimentModule.with("sqlite"),
    ledgerModule.with("sqlite"),
    outcomesModule.with("sqlite"),
  ]);
