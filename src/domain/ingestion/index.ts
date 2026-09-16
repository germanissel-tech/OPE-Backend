// Public API of the ingestion module (domain): events, batch and invariants, NO_OP reasons.
export { EVENT_TYPES } from "./event.js";
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
export { checkBatch, TIMESTAMP_TOLERANCE } from "./batch.js";
export type { BatchCheck, BatchInvariant, EventBatch } from "./batch.js";
export { decide } from "./decide.js";
export { NO_OP_REASONS } from "./no-op-reasons.js";
export type { NoOpReason } from "./no-op-reasons.js";
