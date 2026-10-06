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
import type { AppConfig } from "./config.js";
import type { EventLogTuning } from "./event-log-config.js";
import type { StateRetention } from "./state-retention-config.js";
import type { PlatformLevelReader } from "../application/configuration/index.js";
import type { Operator } from "../domain/operator/index.js";
import type { ContractDocument } from "../infrastructure/http/build-server.js";
import type { SqlStore } from "../interface-adapters/shared-kernel/index.js";

/** The published contract the server is governed by (version, operations, examples). */
export const ContractPort = port("release.contract")<ContractDocument>();
/**
 * Level 1 in force: the values of the platform no merchant overrides, **read when they are used**
 * (feature 036).
 *
 * **It is declared here and bound by the configuration module**, which is not where it would live if the
 * context map allowed anything else. Eleven components of five modules read level 1, and the configuration
 * module may not be imported by any of them (ADR-013: consumers declare their read port and the
 * configuration binds it) — so the neutral place the map leaves for something every module reads is this
 * file, which is the same place the **value** was handed from before the levels started living in a store.
 * What changed is what travels: a reader instead of a number, so publishing a version counts without a
 * restart.
 */
export const PlatformLevelPort = port("release.platform")<PlatformLevelReader>();
/** The operators of the platform, as the configuration lists them. */
export const OperatorsPort = port("release.operators")<readonly Operator[]>();
/**
 * Where the durable gateways write (feature 030). Only they ask for it; no use case knows it
 * exists. A deployment that does not include `storeComponents` leaves it unbound, and because
 * nothing asks for it, nothing is missing.
 */
export const SqlStorePort = port("release.store")<SqlStore>();
/**
 * How the register's queue is tuned (feature 031). It travels here and not through the three levels
 * of configuration because it is a value of the **environment**, like the location of the store:
 * nothing a merchant or a visitor observes changes with it. `event-log-config.ts` has the argument,
 * including the consequence that settled it.
 */
export const EventLogTuningPort = port("release.event-log-tuning")<EventLogTuning>();
/**
 * How long the plane keeps a session and a visitor in memory (feature 032). Environment for the same
 * reason, and the argument is in `state-retention-config.ts`: it used to be level 1, and splitting it
 * from the duration of a session is what made it stop being something a merchant observes.
 */
export const StateRetentionPort = port("release.state-retention")<StateRetention>();

export const releaseComponents = (config: AppConfig) =>
  compositionModule({
    provides: [
      bind(ContractPort, {}, () => loadContract(config.contractPath)),
      bind(OperatorsPort, {}, () => config.operators),
      bind(EventLogTuningPort, {}, () => config.eventLog),
      bind(StateRetentionPort, {}, () => config.stateRetention),
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
