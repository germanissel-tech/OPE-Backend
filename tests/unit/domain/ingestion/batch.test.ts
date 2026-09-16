// US2 (FR-015, FR-052): invariantes del lote. Se completa en la historia 2.
import { describe, it } from "vitest";

describe("checkBatch", () => {
  it.todo("[invariant:session-visitor-mismatch] dos visitantes en el mismo lote → rechazado");
  it.todo("[invariant:event-timestamp-out-of-range] instante fuera de tolerancia → rechazado");
});
