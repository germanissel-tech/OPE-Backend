// The modules every deployment of this repository has in common: the ones served in a single way,
// which therefore have nothing to choose. A deployment is then only its own decision — which
// technology serves the ledger, and whether a store is opened at all — plus this list.
//
// It exists because the two deployments were the same list twice, and the duplication gate was
// right: the day a module is added, adding it in one file and forgetting the other would be a
// deployment that does not compile at best, and one silently missing a module at worst.
//
// The list has no significant order. What is resolved first is decided by dependency; the order
// only fixes the order of creation that the shutdown reverses.
import { accessModule } from "../modules/access.js";
import { barrierModule } from "../modules/barrier.js";
import { decisionModule } from "../modules/decision.js";
import { messagesModule } from "../modules/messages.js";
import { systemModule } from "../modules/system.js";
import { releaseComponents } from "../release.js";
import type { AppConfig } from "../config.js";

export const sharedModules = (config: AppConfig) =>
  [
    releaseComponents(config),
    systemModule,
    accessModule,
    barrierModule,
    messagesModule,
    decisionModule,
  ] as const;
