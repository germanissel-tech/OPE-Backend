// Reason of the NO_OP for a batch. Without a decision plane (features 012+), the only things to
// distinguish are the arm and the incomplete context: a CONTROL visitor never gets an
// intervention (constitution III), a merchant without an active experiment assigns nobody, and a
// product page without a resolved product allows no decision (01-arquitectura-mvp.md §3.1.1).
import type { EventBatch } from "./batch.js";
import type { NoOpReason } from "./no-op-reasons.js";
import type { Arm } from "../shared-kernel/index.js";

export function decide(batch: EventBatch): NoOpReason {
  const onProductPage = batch.events.filter((e) => e.page.pageType === "product");
  if (onProductPage.length > 0 && onProductPage.every((e) => e.page.productId === undefined)) {
    return "page-context-incomplete";
  }
  return "decision-plane-unavailable";
}

/** The reason once the arm is known: CONTROL and "no experiment" short-circuit before the batch is read. */
export function decideArm(arm: Arm | undefined, batch: EventBatch): NoOpReason {
  if (arm === undefined) return "no-active-experiment";
  if (arm === "CONTROL") return "control-arm";
  return decide(batch);
}
