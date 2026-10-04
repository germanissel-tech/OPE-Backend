// messages module (feature 027; texts by API since feature 038): the curated texts, in two layers. It
// serves the decision plane —which candidate families can be said and with what text— from an index in
// memory, because it answers on the critical path of a decision; and it owns the store of the texts an
// operator publishes, which is what fills that index. Two technologies since 038: `memory`, which never
// survives, and `sqlite`, which does.
import { WindowRestarts } from "../../application/experiment/index.js";
import {
  ImportTextsUseCase,
  Messages,
  PublishTextUseCase,
  ReachedByText,
  type ImportTextsRequest,
  type ImportTextsResponse,
  type MessageCorpus,
  type MessageDirectory,
  type ReachedByTextService,
  type TextStore,
} from "../../application/messages/index.js";
import {
  makePublishText,
  memoryTextStore,
  sqliteTextStore,
} from "../../interface-adapters/messages/index.js";
import { bind, bindAll, compositionModule, port, served } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { MessagePlanePort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort } from "./experiment.js";
import { MerchantStorePort } from "./merchant.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

const MessageCorpusPort = port("messages.corpus")<MessageCorpus>();
/** Where the texts are published and their history read; the very instance that answers the corpus. */
const TextStorePort = port("messages.texts")<TextStore>();
/** What a merchant declared about the texts it is served: its languages and its labels (constitution X). */
export const MessageDirectoryPort = port("messages.settings")<MessageDirectory>();
/** The texts of the release become version 1 of each key in the base, audited as the system (feature 038). */
export const ImportTextsPort = port("messages.import")<UseCase<ImportTextsRequest, ImportTextsResponse>>();
/**
 * Which experiments a text reaches, and their restart: built once and handed to each publication as one
 * dependency, which is what keeps the use cases inside the six of ADR-023 and gives the question a name.
 */
const ReachedByTextPort = port("messages.reached")<ReachedByTextService>();

export const messagesModule = compositionModule({
  provides: {
    // One instance, two views: what the administration writes and what the decision plane reads. The durable
    // one answers the reads from an index in memory that its own writes maintain (ADR-041).
    memory: [bindAll([TextStorePort, MessageCorpusPort], {}, () => memoryTextStore())],
    sqlite: [
      bindAll([TextStorePort, MessageCorpusPort], { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteTextStore(deps),
      ),
    ],
  },
  assembles: [
    bind(
      MessagePlanePort,
      { corpus: MessageCorpusPort, directory: MessageDirectoryPort },
      (deps) => new Messages(deps),
    ),
    bind(
      ImportTextsPort,
      { audit: AuditPort, texts: TextStorePort, clock: ClockPort },
      ({ audit, ...deps }) => audit("importTexts", new ImportTextsUseCase(deps)),
    ),
    bind(
      ReachedByTextPort,
      {
        merchants: MerchantStorePort,
        experiments: ExperimentDirectoryPort,
        texts: TextStorePort,
        experimentStore: ExperimentStorePort,
      },
      // The restart is the experiment module's (feature 038); the question of who is reached is this one's.
      ({ experimentStore, ...rest }) =>
        new ReachedByText({ ...rest, restarts: new WindowRestarts({ experimentStore }) }),
    ),
  ],
  serves: {
    handlers: {
      publishText: served(
        { texts: TextStorePort, reached: ReachedByTextPort, clock: ClockPort },
        { name: "publishText", build: (deps) => new PublishTextUseCase(deps) },
        (useCase) => makePublishText(useCase),
        {
          // What the entry of the log can carry today: whether a window restarted. The version a text got
          // is readable in its history by its key, which is what the entry names in its request.
          result: (r) => (r.ok ? { windowRestarted: r.value.windowsRestarted.length > 0 } : undefined),
          reason: (request) => request.reason,
        },
      ),
    },
  },
});
