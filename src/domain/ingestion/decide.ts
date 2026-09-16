// Motivo del NO_OP para un lote. Sin plano de decisión (llega en features posteriores), lo único
// que se distingue es el contexto incompleto: una ficha de producto sin producto resuelto no
// permite decidir nada (01-arquitectura-mvp.md §3.1.1, fail-closed).
import type { EventBatch } from "./batch.js";
import type { NoOpReason } from "./no-op-reasons.js";

export function decide(batch: EventBatch): NoOpReason {
  const onProductPage = batch.events.filter((e) => e.page.pageType === "product");
  if (onProductPage.length > 0 && onProductPage.every((e) => e.page.productId === undefined)) {
    return "page-context-incomplete";
  }
  return "decision-plane-unavailable";
}
