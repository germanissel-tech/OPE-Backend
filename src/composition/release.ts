// What the process brings from outside the graph (ADR-033): the contract the server is governed
// by, the three levels of configuration the release declares and — for a deployment that wants it
// — the durable store. This is the part of the composition that is a function of the
// configuration, so the modules stay plain values and a deployment is a list. Nothing here decides
// behaviour: it reads fields and hands them on.
//
// The store is here and not under `modules/` because it is not a module of the domain: it is a
// resource of the process, like the contract read off the disk. It is a **separate** component so
// that a deployment with everything in memory simply leaves it out and opens no file.
import { loadContract } from "../infrastructure/http/load-contract.js";
import { openSqliteStore } from "../infrastructure/sqlite/open-store.js";
import { bind, compositionModule, port } from "./graph/index.js";
import type { AppConfig, ReleaseLevels } from "./config.js";
import type { PlatformConfiguration } from "../domain/configuration/index.js";
import type { Operator } from "../domain/operator/index.js";
import type { ContractDocument } from "../infrastructure/http/build-server.js";
import type { CorpusEntry } from "../interface-adapters/messages/index.js";
import type { SqlStore } from "../interface-adapters/shared-kernel/index.js";

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
/**
 * Where the durable gateways write (feature 030). Only they ask for it; no use case knows it
 * exists. A deployment that does not include `storeComponents` leaves it unbound, and because
 * nothing asks for it, nothing is missing.
 */
export const SqlStorePort = port("release.store")<SqlStore>();

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

/**
 * The durable store of a deployment that wants one. Shutting it down is not written anywhere: a
 * `SqlStore` has `close()`, so the graph closes it in reverse creation order with everything else
 * it built.
 */
export const storeComponents = (config: AppConfig) =>
  compositionModule({
    provides: [bind(SqlStorePort, {}, () => openSqliteStore(config.store))],
  });
