// Public API of the platform module (application; ADR-047): the ports it reads a merchant's platform with and
// the read of where each flow stands. The reading itself is an adapter (the scheduler), not a use case: it
// deposits through the four use cases the `push` already enters by (research R-01, R-03).
export type { PlatformPolicies, PlatformPolicy } from "./ports/platform-policies.js";
export type { SyncStateStore } from "./ports/sync-state-store.js";
export { GetPlatformSyncUseCase } from "./use-cases/get-platform-sync.use-case.js";
export type {
  FlowSync,
  GetPlatformSyncDependencies,
  GetPlatformSyncRequest,
  GetPlatformSyncResponse,
  PlatformSyncView,
} from "./use-cases/get-platform-sync.use-case.js";
export type { NoticeQueue } from "./ports/notice-queue.js";
export { AcceptNoticeUseCase } from "./use-cases/accept-notice.use-case.js";
export type {
  AcceptNoticeDependencies,
  AcceptNoticeRequest,
  AcceptNoticeResponse,
  NoticeAccepted,
} from "./use-cases/accept-notice.use-case.js";
