# Cambios en `contracts/openapi.yaml` (implementación)

- `tags`: agregar `ingest` — "Ingesta de señales y confirmaciones desde el SDK del merchant."
- `paths`: `/v1/events: $ref: ./paths/events.yaml`, `/v1/exposures: $ref: ./paths/exposures.yaml`
- Sin `security` global (las operaciones lo declaran; `getHealth` sigue con `security: []`).
- `info.version`: 1.1.0 (cambio compatible: operaciones nuevas).
- `contracts/problem-types.yaml`: ver `problem-types.additions.yaml`.
- `contracts/no-op-reasons.yaml`: nuevo, catálogo de motivos.
