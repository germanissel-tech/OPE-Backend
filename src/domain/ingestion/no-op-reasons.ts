// Catálogo de motivos de NO_OP: réplica de contracts/no-op-reasons.yaml (la fuente); una prueba
// verifica que coinciden. Agregar un motivo es compatible (el contrato lo declara como string).
export const NO_OP_REASONS = ["decision-plane-unavailable", "page-context-incomplete"] as const;
export type NoOpReason = (typeof NO_OP_REASONS)[number];
