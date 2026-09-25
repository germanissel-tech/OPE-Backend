// messages module (feature 027): the curated corpus. It serves no operation — the decision plane
// asks it which candidate families can be said and with what text — and reads the corpus of the
// release from memory, because it answers on the critical path of a decision. A durable store
// would be one more technology here, with no consumer changing.
import { Messages, type MessageCorpus, type MessageDirectory } from "../../application/messages/index.js";
import { memoryMessageCorpus } from "../../interface-adapters/messages/index.js";
import { bind, compositionModule, port } from "../graph/index.js";
import { CorpusPort } from "../release.js";
import { MessagePlanePort } from "./decision.js";

const MessageCorpusPort = port("messages.corpus")<MessageCorpus>();
/** What a merchant declared about the texts it is served: voice and languages (constitution X). */
export const MessageDirectoryPort = port("messages.settings")<MessageDirectory>();

export const messagesModule = compositionModule({
  provides: [
    bind(MessageCorpusPort, { entries: CorpusPort }, ({ entries }) => memoryMessageCorpus(entries)),
    bind(
      MessagePlanePort,
      { corpus: MessageCorpusPort, directory: MessageDirectoryPort },
      (deps) => new Messages(deps),
    ),
  ],
});
