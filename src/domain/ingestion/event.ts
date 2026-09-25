// Behavioural event from the SDK (03-alcance-mvp.md §4.1; 01-arquitectura-mvp.md §3.1.1 and §10.2).
// Closed allow-list: exactly these types, these fields. The HTTP contract validates it; here
// lives the shape the domain understands, without depending on the generated types.
import type { EventId } from "./ids.js";
import type { Money, SessionId, VisitorId } from "../shared-kernel/index.js";

/** Replica of the contract's Event discriminator mapping; a test verifies they match. */
export const EVENT_TYPES = [
  "product_viewed",
  "listing_viewed",
  "variant_selector_interacted",
  "variant_selected",
  "photo_interacted",
  "block_dwelled",
  "cta_approached",
  "product_returned_to",
  "added_to_cart",
  "removed_from_cart",
  "checkout_advanced",
  "exit_signaled",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type PageType = "product" | "listing" | "cart" | "checkout" | "other";
export type Availability = "in_stock" | "out_of_stock" | "unknown";
export type DeviceClass = "desktop" | "mobile" | "tablet";

/** What the SDK could resolve about the page. Incomplete ⇒ the backend fails closed (NO_OP). */
export interface PageContext {
  pageType: PageType;
  productId?: string;
  variantId?: string;
  price?: Money;
  availability?: Availability;
  /** Language of the page as the SDK read it (BCP 47, validated by shape at the boundary; 01 §3.1.1). */
  locale?: string;
}

interface EventBase<T extends EventType> {
  type: T;
  eventId: EventId;
  sessionId: SessionId;
  visitorId: VisitorId;
  occurredAt: Date;
  page: PageContext;
  device: DeviceClass;
}

export type ProductViewed = EventBase<"product_viewed">;
export type ListingViewed = EventBase<"listing_viewed">;
export type VariantSelectorInteracted = EventBase<"variant_selector_interacted">;
export interface VariantSelected extends EventBase<"variant_selected"> {
  selectedVariantId: string;
}
export const PHOTO_INTERACTIONS = ["zoom", "navigate"] as const;
export type PhotoInteraction = (typeof PHOTO_INTERACTIONS)[number];
export interface PhotoInteracted extends EventBase<"photo_interacted"> {
  interaction: PhotoInteraction;
}
export const BLOCKS = [
  "description",
  "specifications",
  "reviews",
  "policies",
  "price",
  "gallery",
  "cta",
] as const;
export type Block = (typeof BLOCKS)[number];
export interface BlockDwelled extends EventBase<"block_dwelled"> {
  block: Block;
  dwellMs: number;
}
export const CTA_APPROACHES = ["hover", "near"] as const;
export type CtaApproach = (typeof CTA_APPROACHES)[number];
export interface CtaApproached extends EventBase<"cta_approached"> {
  approach: CtaApproach;
}
export interface ProductReturnedTo extends EventBase<"product_returned_to"> {
  previousProductId: string;
}
export interface AddedToCart extends EventBase<"added_to_cart"> {
  quantity: number;
}
export type RemovedFromCart = EventBase<"removed_from_cart">;
export const CHECKOUT_STEPS = ["cart", "checkout_started", "shipping", "payment", "review"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];
export interface CheckoutAdvanced extends EventBase<"checkout_advanced"> {
  step: CheckoutStep;
}
/** Exactly four exit signals (03 §4.1); adding one is a scope change. */
export const EXIT_SIGNALS = ["inactivity", "tab_hidden", "back_navigation", "exit_intent"] as const;
export type ExitSignal = (typeof EXIT_SIGNALS)[number];
export interface ExitSignaled extends EventBase<"exit_signaled"> {
  signal: ExitSignal;
}

export type Event =
  | ProductViewed
  | ListingViewed
  | VariantSelectorInteracted
  | VariantSelected
  | PhotoInteracted
  | BlockDwelled
  | CtaApproached
  | ProductReturnedTo
  | AddedToCart
  | RemovedFromCart
  | CheckoutAdvanced
  | ExitSignaled;

/**
 * The closed subtype of each event type that has one: the field a barrier rule may refine a
 * count by (`photo_interacted:zoom`, `block_dwelled:policies`). Types absent here have none.
 */
export const SUBTYPES: Readonly<Partial<Record<EventType, readonly string[]>>> = {
  photo_interacted: PHOTO_INTERACTIONS,
  block_dwelled: BLOCKS,
  cta_approached: CTA_APPROACHES,
  checkout_advanced: CHECKOUT_STEPS,
  exit_signaled: EXIT_SIGNALS,
};
