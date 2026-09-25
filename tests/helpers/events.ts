// Event builders for the decision-plane tests (feature 011): one session, one visitor, product
// page SKU-1 / SKU-1-M by default, instants `n` seconds after `base`.
import { asEventId, type Event, type PageContext } from "../../src/domain/ingestion/index.js";
import { asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";

export const BASE = new Date("2026-09-18T12:00:00.000Z");
const PRODUCT_PAGE: PageContext = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

let sequence = 0;

/** An event `atSeconds` after BASE; `over` overrides any field (the type decides the extra fields). */
function eventAt(atSeconds: number, over: Partial<Event> & { type: Event["type"] }): Event {
  sequence += 1;
  const base = {
    eventId: asEventId(`evt_${String(sequence).padStart(8, "0")}`),
    sessionId: asSessionId("ses_00000001"),
    visitorId: asVisitorId("vis_00000001"),
    occurredAt: new Date(BASE.getTime() + atSeconds * 1000),
    page: PRODUCT_PAGE,
    device: "mobile" as const,
  };
  return { ...base, ...over } as Event;
}

export const variantSelector = (at: number): Event => eventAt(at, { type: "variant_selector_interacted" });
export const dwell = (
  at: number,
  block: "description" | "size_guide" | "reviews" | "policies" | "price" | "gallery" | "cta",
  dwellMs: number,
): Event => eventAt(at, { type: "block_dwelled", block, dwellMs });
export const photo = (at: number, interaction: "zoom" | "navigate" = "zoom"): Event =>
  eventAt(at, { type: "photo_interacted", interaction });
export const addedToCart = (at: number): Event => eventAt(at, { type: "added_to_cart", quantity: 1 });
export const removedFromCart = (at: number): Event => eventAt(at, { type: "removed_from_cart" });
export const checkout = (
  at: number,
  step: "cart" | "checkout_started" | "shipping" | "payment" | "review" = "checkout_started",
): Event => eventAt(at, { type: "checkout_advanced", step });
export const cta = (at: number, approach: "hover" | "near" = "hover"): Event =>
  eventAt(at, { type: "cta_approached", approach });
export const exit = (
  at: number,
  signal: "inactivity" | "tab_hidden" | "back_navigation" | "exit_intent" = "exit_intent",
): Event => eventAt(at, { type: "exit_signaled", signal });
export const returned = (at: number, previousProductId = "SKU-0"): Event =>
  eventAt(at, { type: "product_returned_to", previousProductId });
export const viewed = (at: number, page: PageContext = PRODUCT_PAGE): Event =>
  eventAt(at, { type: "product_viewed", page });
export const variantSelected = (at: number, selectedVariantId = "SKU-1-L"): Event =>
  eventAt(at, { type: "variant_selected", selectedVariantId });
