# Cambios en `contracts/paths/exposures.yaml` (implementación)

- `responses."503"`: `$ref: ../components/responses/ServiceUnavailable.yaml`.
- En la descripción de la operación: "If the ledger cannot record the exposure, the response is
  `503` with `Retry-After`; nothing was recorded and the SDK retries."
- Sin cambios en `ingestEvents`: la degradación es una decisión `NO_OP` con motivo.
