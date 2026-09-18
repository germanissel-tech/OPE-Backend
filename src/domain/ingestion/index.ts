// Public API of the ingestion module (domain): events, batch and invariants, NO_OP reasons.
export type {
  AddedToCart,
  Availability,
  Block,
  BlockDwelled,
  CheckoutAdvanced,
  CheckoutStep,
  CtaApproached,
  DeviceClass,
  Event,
  EventType,
  ExitSignal,
  ExitSignaled,
  ListingViewed,
  Money,
  PageContext,
  PageType,
  PhotoInteracted,
  ProductReturnedTo,
  ProductViewed,
  RemovedFromCart,
  SizeSelectorInteracted,
  VariantSelected,
} from "./event.js";
export { EventTimestampOutOfRange, SessionVisitorMismatch } from "./errors.js";
export type { IngestionError } from "./errors.js";
export { EventBatch, TIMESTAMP_TOLERANCE } from "./event-batch.js";
export { asEventId } from "./ids.js";
export type { EventId } from "./ids.js";
// The NO_OP reason catalogue is shared vocabulary (ledger, ingestion, decision): it lives in the
// shared kernel and is re-exported here for the consumers of the ingestion module.
export { NO_OP_REASONS } from "../shared-kernel/index.js";
export type { NoOpReason } from "../shared-kernel/index.js";
