# Cambio del contrato — `upsertCatalogSnapshot` declara `503` (F-044)

- `contracts/paths/catalog.yaml`: respuesta `"503"` con `application/problem+json`, tipo
  `ledger-unavailable`, header `Retry-After`, igual que `orders.yaml`. Compatible: una 5xx
  nueva es condición del servidor (ADR-021 §5, ADR-003); `contract:diff` no la reporta como
  incompatible; `info.version` no sube.
- `contracts/problem-types.yaml` gana, con status y título, sin `x-invariants` (errores de
  configuración y de borde, ADR-023/024): `invalid-ingest-keys` (422), `invalid-origins` (422),
  `invalid-platform-keys` (422), `invalid-platform-secrets` (422),
  `multiple-active-experiments` (422), `duplicate-experiment-id` (422), `payload-too-large`
  (413). La réplica `problem-details.ts` y `error-codes.test.ts` los verifican.
- `contracts/components/schemas/Incentive.yaml`: la descripción deja de citar "feature 014" y
  nombra la feature del mapa por su nombre ("Configuration, flags, kill switch and
  administration") o la operación (`putFlags`).
- Ninguna operación cambia su request, sus 2xx ni sus 4xx (SC-004).
