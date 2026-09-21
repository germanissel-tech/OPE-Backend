// Public API of the ingestion module (domain): events, batch and invariants, NO_OP reasons.
export type {
  AddedToCart,
  Availability,
  Block,
  BlockDwelled,
  CheckoutAdvanced,
  CheckoutStep,
  CtaApproach,
  CtaApproached,
  DeviceClass,
  Event,
  EventType,
  ExitSignal,
  ExitSignaled,
  ListingViewed,
  PageContext,
  PageType,
  PhotoInteracted,
  PhotoInteraction,
  ProductReturnedTo,
  ProductViewed,
  RemovedFromCart,
  SizeSelectorInteracted,
  VariantSelected,
} from "./event.js";
export {
  BLOCKS,
  CHECKOUT_STEPS,
  CTA_APPROACHES,
  EVENT_TYPES,
  EXIT_SIGNALS,
  PHOTO_INTERACTIONS,
  SUBTYPES,
} from "./event.js";
export { EventTimestampOutOfRange, SessionVisitorMismatch } from "./errors.js";
export type { IngestionError } from "./errors.js";
export { EventBatch } from "./event-batch.js";
export type { TimestampTolerance } from "./event-batch.js";
export type { ProductFocus } from "./event-batch.js";
export { asEventId } from "./ids.js";
export type { EventId } from "./ids.js";
