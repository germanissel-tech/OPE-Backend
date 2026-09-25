// Public API of the messages module (application): the authority that says which families can be
// said and the ports it needs.
export { Messages } from "./services/message.service.js";
export type { MessagesDependencies } from "./services/message.service.js";
export type { MessageCorpus, TextKey } from "./ports/message-corpus.js";
export type { MessageDirectory, MessageSettings } from "./ports/message-directory.js";
