// messages module (feature 027; texts by API since feature 038): the curated texts, in two layers. It
// serves the decision plane —which candidate families can be said and with what text— from an index in
// memory, because it answers on the critical path of a decision; and it owns the store of the texts an
// operator publishes, which is what fills that index. Two technologies since 038: `memory`, which never
// survives, and `sqlite`, which does.
import {
  ImportTextsUseCase,
  Messages,
  type ImportTextsRequest,
  type ImportTextsResponse,
  type MessageCorpus,
  type MessageDirectory,
  type TextStore,
} from "../../application/messages/index.js";
import { memoryTextStore, sqliteTextStore } from "../../interface-adapters/messages/index.js";
import { bind, bindAll, compositionModule, port } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { MessagePlanePort } from "./decision.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

const MessageCorpusPort = port("messages.corpus")<MessageCorpus>();
/** Where the texts are published and their history read; the very instance that answers the corpus. */
const TextStorePort = port("messages.texts")<TextStore>();
/** What a merchant declared about the texts it is served: its languages and its labels (constitution X). */
export const MessageDirectoryPort = port("messages.settings")<MessageDirectory>();
/** The texts of the release become version 1 of each key in the base, audited as the system (feature 038). */
export const ImportTextsPort = port("messages.import")<UseCase<ImportTextsRequest, ImportTextsResponse>>();

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
  ],
});
