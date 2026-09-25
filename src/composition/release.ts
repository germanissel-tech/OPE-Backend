// What the process brings from outside the graph (ADR-033): the contract the server is governed
// by and the three levels of configuration the release declares. It is the only part of the
// composition that is a function of the configuration, so the fourteen modules are plain values
// and a deployment is a list. Nothing here decides behaviour: it reads fields and hands them on.
import { loadContract } from "../infrastructure/http/load-contract.js";
import { bind, compositionModule, port } from "./graph/index.js";
import type { AppConfig, ReleaseLevels } from "./config.js";
import type { PlatformConfiguration } from "../domain/configuration/index.js";
import type { Operator } from "../domain/operator/index.js";
import type { ContractDocument } from "../infrastructure/http/build-server.js";
import type { CorpusEntry } from "../interface-adapters/messages/index.js";

/** The published contract the server is governed by (version, operations, examples). */
export const ContractPort = port("release.contract")<ContractDocument>();
/** Level 1 of the configuration: the values of the platform no merchant overrides. */
export const PlatformConfigurationPort = port("release.platform")<PlatformConfiguration>();
/** Levels 1 and 2 as the release declares them. */
export const ReleaseLevelsPort = port("release.levels")<ReleaseLevels>();
/** The curated texts of the release: read once, judged at startup, served from memory. */
export const CorpusPort = port("release.corpus")<readonly CorpusEntry[]>();
/** The operators of the platform, as the configuration lists them. */
export const OperatorsPort = port("release.operators")<readonly Operator[]>();

export const releaseComponents = (config: AppConfig) =>
  compositionModule({
    provides: [
      bind(ContractPort, {}, () => loadContract(config.contractPath)),
      bind(ReleaseLevelsPort, {}, () => config.levels),
      bind(PlatformConfigurationPort, { levels: ReleaseLevelsPort }, ({ levels }) => levels.platform),
      bind(OperatorsPort, {}, () => config.operators),
      bind(CorpusPort, {}, () => config.corpus),
    ],
  });
