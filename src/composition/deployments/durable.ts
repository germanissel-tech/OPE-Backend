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
//   - the session and visitor state, which is **still hot and still not the source of truth**
//     (constitution IV). Feature 032 did not make it durable; it made it **recoverable**: a state
//     memory has forgotten is rebuilt from the register and the ledger, so the caps survive a deploy
//     without the hot side ever becoming a second truth. What is still open there is the atomicity
//     of the per-session budget, which needs the transaction of `persistence-and-resilience`.
//
// Leaving `storeComponents` out of this list does not compile: the three modules below ask for the
// store and `deployment()` names the component nobody provides.
import { deployment } from "../graph/index.js";
import { storeComponents } from "../release.js";
import { modulesWith } from "./chosen-modules.js";
import { sharedModules } from "./shared-modules.js";
import type { AppConfig } from "../config.js";

export const durableDeployment = (config: AppConfig) =>
  deployment([...sharedModules(config), storeComponents(config), ...modulesWith("sqlite")]);
