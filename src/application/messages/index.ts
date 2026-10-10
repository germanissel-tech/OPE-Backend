// Public API of the messages module (application): the authority that says which families can be
// said and the ports it needs.
export { Messages } from "./services/message.service.js";
export type { MessagesDependencies } from "./services/message.service.js";
export type { MessageCorpus, TextKey } from "./ports/message-corpus.js";
export type { MessageDirectory, MessageSettings } from "./ports/message-directory.js";
export type { TextLayer, TextStore } from "./ports/text-store.js";
export { ReachedByText } from "./services/reached-by-text.service.js";
export { TextPublications } from "./services/text-publication.service.js";
export type {
  TextPublicationDependencies,
  TextPublicationService,
} from "./services/text-publication.service.js";
export type { ReachedByTextDependencies, ReachedByTextService } from "./services/reached-by-text.service.js";
export { PublishTextUseCase } from "./use-cases/publish-text.use-case.js";
export type { PublishTextRequest, PublishTextResponse } from "./use-cases/publish-text.use-case.js";
export type { PublishedText, TextVersionRead } from "./published-text.js";
export { PublishMerchantTextUseCase } from "./use-cases/publish-merchant-text.use-case.js";
export type {
  PublishMerchantTextRequest,
  PublishMerchantTextResponse,
} from "./use-cases/publish-merchant-text.use-case.js";
export { ImportTextsUseCase } from "./use-cases/import-texts.use-case.js";
export type { ImportTextsRequest, ImportTextsResponse, SeedText } from "./use-cases/import-texts.use-case.js";
export { ListTextVersionsUseCase } from "./use-cases/list-text-versions.use-case.js";
export type { ListTextVersionsRequest } from "./use-cases/list-text-versions.use-case.js";
export { GetTextVersionUseCase } from "./use-cases/get-text-version.use-case.js";
export type { GetTextVersionRequest, GetTextVersionResponse } from "./use-cases/get-text-version.use-case.js";
export { ListMerchantTextVersionsUseCase } from "./use-cases/list-merchant-text-versions.use-case.js";
export type {
  ListMerchantTextVersionsRequest,
  ListMerchantTextVersionsResponse,
} from "./use-cases/list-merchant-text-versions.use-case.js";
export { GetMerchantTextVersionUseCase } from "./use-cases/get-merchant-text-version.use-case.js";
export type {
  GetMerchantTextVersionRequest,
  GetMerchantTextVersionResponse,
} from "./use-cases/get-merchant-text-version.use-case.js";
