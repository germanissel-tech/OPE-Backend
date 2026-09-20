# Contrato — API de administración (US1, US2, US3) (R-06, R-10)

Consumidor `admin`, esquema `adminToken` (`Authorization: Bearer <token>`), tag `admin`. Toda
ruta con `merchantId` lleva el identificador en el path (constitución V). Toda operación
declara `x-required-capabilities`. Colecciones: parámetros `cursor` y `limit` por `$ref` y un
`<X>Page { items, nextCursor? }`. Errores: Problem Details del catálogo; `403
merchant-out-of-scope` se responde antes de consultar el store y sin distinguir merchant
inexistente de merchant fuera de alcance; `404 merchant-not-found` sólo dentro del alcance.

## Mapa (`contracts/api-map.yaml`, feature 017)

| operationId                    | Método y ruta                                                               | Capacidad             | Estado                    |
| ------------------------------ | --------------------------------------------------------------------------- | --------------------- | ------------------------- |
| `listMerchants`                | `GET /v1/admin/merchants`                                                   | `merchants:read`      | existe (planned)          |
| `createMerchant`               | `POST /v1/admin/merchants`                                                  | `merchants:write`     | existe                    |
| `getMerchant`                  | `GET /v1/admin/merchants/{merchantId}`                                      | `merchants:read`      | nueva                     |
| `deactivateMerchant`           | `POST /v1/admin/merchants/{merchantId}/deactivate`                          | `merchants:write`     | nueva                     |
| `rotateIngestKey`              | `POST /v1/admin/merchants/{merchantId}/ingest-keys`                         | `credentials:rotate`  | existe                    |
| `rotatePlatformKey`            | `POST /v1/admin/merchants/{merchantId}/platform-keys`                       | `credentials:rotate`  | existe                    |
| `rotatePlatformSecret`         | `POST /v1/admin/merchants/{merchantId}/platform-secrets`                    | `credentials:rotate`  | nueva                     |
| `setKillSwitch`                | `PUT /v1/admin/merchants/{merchantId}/kill-switch`                          | `merchants:write`     | existe (capacidad cambia) |
| `publishMerchantConfiguration` | `POST /v1/admin/merchants/{merchantId}/configuration`                       | `configuration:write` | renombra `putFlags`       |
| `getMerchantConfiguration`     | `GET /v1/admin/merchants/{merchantId}/configuration`                        | `configuration:read`  | nueva                     |
| `listConfigurationVersions`    | `GET /v1/admin/merchants/{merchantId}/configuration/versions`               | `configuration:read`  | nueva                     |
| `createExperiment`             | `POST /v1/admin/merchants/{merchantId}/experiments`                         | `experiments:write`   | existe                    |
| `listExperiments`              | `GET /v1/admin/merchants/{merchantId}/experiments`                          | `experiments:read`    | nueva                     |
| `activateExperiment`           | `POST /v1/admin/merchants/{merchantId}/experiments/{experimentId}/activate` | `experiments:write`   | nueva                     |
| `closeExperiment`              | `POST /v1/admin/merchants/{merchantId}/experiments/{experimentId}/close`    | `experiments:write`   | existe                    |
| `getPlatformConfiguration`     | `GET /v1/admin/platform-configuration`                                      | `configuration:read`  | nueva                     |
| `getTreatmentDefaults`         | `GET /v1/admin/treatment-defaults`                                          | `configuration:read`  | nueva                     |
| `listAdminLog`                 | `GET /v1/admin/log`                                                         | `log:read`            | nueva                     |
| `listMerchantAdminLog`         | `GET /v1/admin/merchants/{merchantId}/log`                                  | `log:read`            | nueva                     |
| `listAnchorDiagnostics`        | `GET /v1/admin/merchants/{merchantId}/anchor-diagnostics`                   | `merchants:read`      | nueva (US4)               |

Capacidades del consumidor `admin`: `merchants:read`, `merchants:write`, `credentials:rotate`,
`configuration:read`, `configuration:write`, `experiments:read`, `experiments:write`,
`log:read`, `messages:publish` (020). `flags:write` desaparece. Fuentes: `mvp:01 §14.2`
(interruptor, banderas, configuración estampada), `mvp:01 §14.1` (perfil), `mvp:03 §4.10`
(calibración y congelamiento), ADR-020 (operador), ADR-014 (rotación), spec 017.

## Esquemas (componentes nuevos, `contracts/components/schemas/`)

- `MerchantCreate` (body): `origins: string[]` (1..n, `Origin`), `signature: boolean`
  (si `true`, se acuña también un secreto de firma). `additionalProperties: false`.
- `MerchantCreated` (201): `merchantId`, `status`, `origins`, `createdAt`, `credentials:
{ ingestKey, platformKey, platformSecret? }` — **la única vez que viajan**.
- `Merchant` (lectura): `merchantId`, `status`, `origins`, `createdAt`, `credentials:
CredentialSummary[]` (`kind`, `issuedAt`, `expiresAt?`; nunca el valor), `configuration:
{ version?: number, publishedAt? }`, `experiment?: { experimentId, status }`.
- `MerchantPage`: `items: Merchant[]`, `nextCursor?`.
- `CredentialRotation` (body): `graceSeconds?: integer ≥ 0` (tope de plataforma → 422
  `rotation-grace-too-long`). Respuesta 201 `CredentialIssued`: `kind`, `value` (una vez),
  `issuedAt`, `previousExpiresAt?`.
- `KillSwitch` (body y respuesta 200): `enabled: boolean`.
- `MerchantConfigurationInput` (body de `publish`): `declared: MerchantConfigurationDeclared`
  (todos opcionales: `freshness`, `syncLevel`, `decisionPolicy`, `commercialPolicy`,
  `evidenceProfile`, `surfaces`, `barriers`, `syncStrategy`, `locales`, `anchors`),
  `corrective?: boolean`, `reason?: string` (obligatorio con `corrective`, `x-invariants`).
  Respuesta `201 MerchantConfigurationVersion` (creada) / `200` (idéntica a la vigente:
  `x-idempotency` por contenido); `409 configuration-frozen`; `422` con el slug de la
  invariante violada y `pointer`.
- `MerchantConfiguration` (lectura): `effective: EffectiveConfiguration` (valores
  resueltos, sin secretos), `declared`, `versions: { platform, defaults, merchant? }`.
- `MerchantConfigurationVersion`: `version`, `declared`, `corrective`, `reason?`,
  `publishedAt`, `operatorId`. `MerchantConfigurationVersionPage`.
- `PlatformConfiguration`, `TreatmentDefaults` (lectura): los campos de `data-model.md`
  con su `version`.
- `ExperimentCreate` (body): `treatmentPercent` (0–100, borde), `seed`, `targetSample`,
  `cuts?`. `201 Experiment`: `experimentId`, `status`, `treatmentPercent`, `targetSample`,
  `cuts`, `openedAt`, `activatedAt?`, `windowStartedAt?`, `closedAt?`, `windowRestarts`.
  `409 experiment-already-open`. `activate`/`close`: `200 Experiment`; `409
experiment-not-open`. `ExperimentPage`.
- `AdminEntry`, `AdminEntryPage`; `AnchorDiagnostic`, `AnchorDiagnosticPage`.

Todos los bodies con `additionalProperties: false`; ningún campo de dato personal (la lista
`pii-denylist.json` sigue vigente: `operatorId` es un identificador opaco). Ejemplos con
instantes fijos y la invariante nombrada en cada 422.

## Seguridad

`contracts/components/securitySchemes/adminToken.yaml`: quitar `PROPOSED`; describir el
operador, la emisión fuera de banda (`scripts/mint-admin-token.mjs`), el alcance y el
registro. Entra a la raíz (`securitySchemes` + `security` por operación) con `createMerchant`.
`401 operator-unknown` antes de leer el cuerpo; `403 capability-missing` lo pone la
infraestructura como hoy.

## Reglas del contrato

Ninguna regla nueva de Spectral: `ope-consumer-security` (admin ⇒ `adminToken`),
`ope-no-merchant-id-in-request` (admite path bajo `admin`), `ope-required-capabilities` y
`ope-invariants` ya cubren la superficie. Si `ope-no-merchant-id-in-request` no admite hoy
el path del consumidor `admin`, se ajusta con su fixture (la prueba de reglas falla si falta).
