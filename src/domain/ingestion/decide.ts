// NO_OP reason for a batch. Without a decision plane (it arrives in later features), the only
// thing that can be told apart is an incomplete context: a product page without a resolved
// product allows no decision at all (01-arquitectura-mvp.md §3.1.1, fail-closed).
import type { EventBatch } from "./batch.js";
import type { NoOpReason } from "./no-op-reasons.js";

export function decide(batch: EventBatch): NoOpReason {
  const onProductPage = batch.events.filter((e) => e.page.pageType === "product");
  if (onProductPage.length > 0 && onProductPage.every((e) => e.page.productId === undefined)) {
    return "page-context-incomplete";
  }
  return "decision-plane-unavailable";
}
