// messages module (feature 027; texts by API since feature 038): the curated texts, in two layers. It
// serves the decision plane —which candidate families can be said and with what text— from an index in
// memory, because it answers on the critical path of a decision; and it owns the store of the texts an
// operator publishes, which is what fills that index. Two technologies since 038: `memory`, which never
// survives, and `sqlite`, which does.
import { ActiveExperiments, WindowRestarts } from "../../application/experiment/index.js";
import {
  GetMerchantTextVersionUseCase,
  GetTextVersionUseCase,
  ImportTextsUseCase,
  ListMerchantTextVersionsUseCase,
  ListTextVersionsUseCase,
  Messages,
  PublishMerchantTextUseCase,
  PublishTextUseCase,
  ReachedByText,
  TextPublications,
  type ImportTextsRequest,
  type ImportTextsResponse,
  type MessageCorpus,
  type MessageDirectory,
  type ReachedByTextService,
  type TextPublicationService,
  type TextStore,
} from "../../application/messages/index.js";
import {
  makeGetMerchantTextVersion,
  makeGetTextVersion,
  makeListMerchantTextVersions,
  makeListTextVersions,
  makePublishMerchantText,
  makePublishText,
  memoryTextStore,
  sqliteTextStore,
} from "../../interface-adapters/messages/index.js";
import { bind, bindAll, compositionModule, port, served } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { MessagePlanePort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort } from "./experiment.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

const MessageCorpusPort = port("messages.corpus")<MessageCorpus>();
/**
 * Where the texts are published and their history read; the very instance that answers the corpus. Exported
 * because configuration asks it whether a language could be served (feature 038, US4).
 */
export const TextStorePort = port("messages.texts")<TextStore>();
/** What a merchant declared about the texts it is served: its languages and its labels (constitution X). */
export const MessageDirectoryPort = port("messages.settings")<MessageDirectory>();
/** The texts of the release become version 1 of each key in the base, audited as the system (feature 038). */
export const ImportTextsPort = port("messages.import")<UseCase<ImportTextsRequest, ImportTextsResponse>>();
/**
 * Which experiments a text reaches, and their restart: built once and handed to each publication as one
 * dependency, which is what keeps the use cases inside the six of ADR-023 and gives the question a name.
 */
const ReachedByTextPort = port("messages.reached")<ReachedByTextService>();
/** What a publication does once judged, shared by the two layers: repeat, freeze, publish, restart. */
const TextPublicationPort = port("messages.publications")<TextPublicationService>();

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
      // The walk and the restart are the experiment module's; the question of who is reached is this one's.
      ({ merchants, experiments, texts, experimentStore }) =>
        new ReachedByText({
          active: new ActiveExperiments({ merchants, experiments }),
          experiments,
          texts,
          restarts: new WindowRestarts({ experimentStore }),
        }),
    ),
    bind(
      TextPublicationPort,
      { texts: TextStorePort, reached: ReachedByTextPort },
      (deps) => new TextPublications(deps),
    ),
  ],
  serves: {
    handlers: {
      publishText: served(
        { publications: TextPublicationPort, clock: ClockPort },
        { name: "publishText", build: (deps) => new PublishTextUseCase(deps) },
        (useCase) => makePublishText(useCase),
        {
          // What the entry of the log can carry today: whether a window restarted. The version a text got
          // is readable in its history by its key, which is what the entry names in its request.
          result: (r) => (r.ok ? { windowRestarted: r.value.windowsRestarted.length > 0 } : undefined),
          reason: (request) => request.reason,
        },
      ),
      publishMerchantText: served(
        {
          scoped: ScopedMerchantPort,
          texts: TextStorePort,
          publications: TextPublicationPort,
          clock: ClockPort,
        },
        { name: "publishMerchantText", build: (deps) => new PublishMerchantTextUseCase(deps) },
        (useCase) => makePublishMerchantText(useCase),
        {
          result: (r) => (r.ok ? { windowRestarted: r.value.windowsRestarted.length > 0 } : undefined),
          reason: (request) => request.reason,
        },
      ),
      // The history of a key (US5): the base with the capability, the merchant's within the scope over it.
      listTextVersions: served(
        { texts: TextStorePort, reached: ReachedByTextPort },
        { name: "listTextVersions", build: (deps) => new ListTextVersionsUseCase(deps) },
        (useCase) => makeListTextVersions(useCase),
      ),
      getTextVersion: served(
        { texts: TextStorePort, reached: ReachedByTextPort },
        { name: "getTextVersion", build: (deps) => new GetTextVersionUseCase(deps) },
        (useCase) => makeGetTextVersion(useCase),
      ),
      listMerchantTextVersions: served(
        { scoped: ScopedMerchantPort, texts: TextStorePort, reached: ReachedByTextPort },
        { name: "listMerchantTextVersions", build: (deps) => new ListMerchantTextVersionsUseCase(deps) },
        (useCase) => makeListMerchantTextVersions(useCase),
      ),
      getMerchantTextVersion: served(
        { scoped: ScopedMerchantPort, texts: TextStorePort, reached: ReachedByTextPort },
        { name: "getMerchantTextVersion", build: (deps) => new GetMerchantTextVersionUseCase(deps) },
        (useCase) => makeGetMerchantTextVersion(useCase),
      ),
    },
  },
});
