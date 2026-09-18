// Behavioural event from the SDK (03-alcance-mvp.md §4.1; 01-arquitectura-mvp.md §3.1.1 and §10.2).
// Closed allow-list: exactly these types, these fields. The HTTP contract validates it; here
// lives the shape the domain understands, without depending on the generated types.
import type { EventId } from "./ids.js";
import type { Money, SessionId, VisitorId } from "../shared-kernel/index.js";

export type EventType =
  | "product_viewed"
  | "listing_viewed"
  | "size_selector_interacted"
  | "variant_selected"
  | "photo_interacted"
  | "block_dwelled"
  | "cta_approached"
  | "product_returned_to"
  | "added_to_cart"
  | "removed_from_cart"
  | "checkout_advanced"
  | "exit_signaled";

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
export interface SizeSelectorInteracted extends EventBase<"size_selector_interacted"> {
  size: string;
}
export interface VariantSelected extends EventBase<"variant_selected"> {
  selectedVariantId: string;
}
export interface PhotoInteracted extends EventBase<"photo_interacted"> {
  interaction: "zoom" | "navigate";
}
export type Block = "description" | "size_guide" | "reviews" | "policies" | "price" | "gallery" | "cta";
export interface BlockDwelled extends EventBase<"block_dwelled"> {
  block: Block;
  dwellMs: number;
}
export interface CtaApproached extends EventBase<"cta_approached"> {
  approach: "hover" | "near";
}
export interface ProductReturnedTo extends EventBase<"product_returned_to"> {
  previousProductId: string;
}
export interface AddedToCart extends EventBase<"added_to_cart"> {
  quantity: number;
}
export type RemovedFromCart = EventBase<"removed_from_cart">;
export type CheckoutStep = "cart" | "checkout_started" | "shipping" | "payment" | "review";
export interface CheckoutAdvanced extends EventBase<"checkout_advanced"> {
  step: CheckoutStep;
}
/** Exactly four exit signals (03 §4.1); adding one is a scope change. */
export type ExitSignal = "inactivity" | "tab_hidden" | "back_navigation" | "exit_intent";
export interface ExitSignaled extends EventBase<"exit_signaled"> {
  signal: ExitSignal;
}

export type Event =
  | ProductViewed
  | ListingViewed
  | SizeSelectorInteracted
  | VariantSelected
  | PhotoInteracted
  | BlockDwelled
  | CtaApproached
  | ProductReturnedTo
  | AddedToCart
  | RemovedFromCart
  | CheckoutAdvanced
  | ExitSignaled;
