# Data model — Merchants, configuración en tres niveles y administración (017)

Entidades por módulo (ADR-024: clase si hay reglas, tipo si no). Todo identificador en inglés;
los campos que el contrato publica se citan con su nombre de esquema.

## Módulo `merchant`

### `Merchant` (clase; existe)

| Campo         | Tipo                                 | Regla                                                                                   |
| ------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `merchantId`  | `MerchantId`                         | Lo acuña OPE (`mrc_` + 12 base32); inmutable; nunca se reutiliza                        |
| `status`      | `"active" \| "off" \| "deactivated"` | `off` = kill switch; `deactivated` es terminal                                          |
| `origins`     | `Origin[]`                           | Como hoy; un origen pertenece a un solo merchant (`OriginAlreadyRegistered`)            |
| `credentials` | `Credential[]`                       | Hasta dos vigentes por clase; reemplaza `ingestKeys`, `platformKeys`, `platformSecrets` |
| `createdAt`   | `Date`                               |                                                                                         |

Reglas (métodos): `allowsOrigin` (existe), `requiresSignature` (existe: hay secreto vigente),
`isOn()`, `credentialsOf(kind, now)` (vigentes), `rotated(kind, credential, graceMs, now)`
→ `Result<Merchant, RotationGraceTooLong>` (la anterior gana `expiresAt = now + grace`; si ya
había dos, la más vieja expira), `switched(on)`, `deactivated()`. `of` conserva las reglas de
hoy (ids, orígenes, colisiones); `rehydrate` no rejuzga.

### `Credential` (tipo)

| Campo         | Tipo                                  | Regla                                                                                 |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `kind`        | `"ingest" \| "platform" \| "signing"` |                                                                                       |
| `fingerprint` | `string`                              | SHA-256 hex de la clave (`ingest`, `platform`); para `signing`, la huella del secreto |
| `secret?`     | `string`                              | Sólo `signing`: el valor, necesario para el HMAC; nunca sale por el contrato          |
| `issuedAt`    | `Date`                                |                                                                                       |
| `expiresAt?`  | `Date`                                | Sólo tras una rotación                                                                |

### `MerchantSeed` (tipo, composición)

Lo que `OPE_MERCHANTS` describe hoy (claves en claro, orígenes, experimentos, políticas,
perfil). Se importa por los casos de uso de la API a nombre de `system` sólo con el store vacío.

### Puertos

- `MerchantStore`: `create(merchant)`, `get(merchantId)`, `list(cursor?, limit)`,
  `update(merchant)` (rotación, interruptor, desactivación: la entidad ya decidió),
  todos `Promise<Result<…, StoreUnavailable>>`.
- `MerchantDirectory` (existe): `findByIngestKey`, `findByPlatformKey`, `isRegisteredOrigin` —
  ahora por huella; un merchant `deactivated` nunca se devuelve.
- `CredentialMinter`: `mint(kind)` → `{ value, fingerprint }`; `fingerprintOf(value)`.

## Módulo `configuration` (nuevo)

### `PlatformConfiguration` (clase; nivel 1; archivo `config/platform.json`)

| Campo                                | Contenido           | Invariante |
| ------------------------------------ | ------------------- | ---------- |
| `version`                            | `string`            | no vacía   |
| `dedupWindow`                        | `{ ttlMs, maxIds }` | > 0        |
| `clockSkewToleranceMs`               | `number`            | ≥ 0        |
| `sessionWindowMs`, `visitorWindowMs` | `number`            | > 0        |
| `signatureWindowMs`                  | `number`            | > 0        |
| `rotationGraceMaxMs`                 | `number`            | ≥ 0        |
| `anchorDiagnosticsKept`              | `number`            | ≥ 1        |

### `TreatmentDefaults` (clase; nivel 2; archivo `config/treatment-defaults.json`)

| Campo              | Contenido                                                                                                      | Invariante                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `version`          | `string`                                                                                                       | no vacía                                                                    |
| `freshness`        | `{ catalogMs, stockAndPriceMs }`                                                                               | > 0                                                                         |
| `syncLevel`        | `{ receiptsKept, noDataAfterMs, minutesLevelMaxAgeMs, minutesLevelMedianIntervalMs, minutesLevelMinReceipts }` | > 0                                                                         |
| `decisionPolicy`   | `DecisionPolicy` (fábrica existente)                                                                           | las suyas                                                                   |
| `commercialPolicy` | `CommercialPolicy` (fábrica existente)                                                                         | las suyas                                                                   |
| `evidenceProfile`  | `MerchantProfile`                                                                                              | las suyas                                                                   |
| `surfaces`         | `("product" \| "cart")[]`                                                                                      | no vacío                                                                    |
| `barriers`         | `Barrier[]`                                                                                                    | subconjunto de `BARRIERS`, no vacío                                         |
| `syncStrategy`     | `{ catalog, stockAndPrice, orders, returns }`                                                                  | cada uno un `SyncMode`                                                      |
| `locales`          | `{ supported: string[], fallback?: string }`                                                                   | etiquetas BCP 47 por forma; `fallback ∈ supported`; vacío = sin restricción |

`SyncMode = "push" | "pull" | "subscribe"` (vocabulario cerrado; hoy sólo `push` construido:
declarar otro se acepta, se estampa y no cambia el comportamiento hasta la 019).

### `MerchantConfigurationVersion` (clase; nivel 3)

| Campo         | Tipo                                                         | Regla                                                                              |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `merchantId`  | `MerchantId`                                                 |                                                                                    |
| `version`     | `number`                                                     | secuencial por merchant, lo asigna el store                                        |
| `declared`    | `Partial<TreatmentDefaultsRecord> & { anchors?: AnchorMap }` | sólo lo que el merchant sobrescribe; cada valor validado con la fábrica de su tipo |
| `corrective`  | `boolean`                                                    |                                                                                    |
| `reason?`     | `string`                                                     | obligatorio si `corrective`                                                        |
| `publishedAt` | `Date`                                                       |                                                                                    |
| `operatorId`  | `OperatorId`                                                 |                                                                                    |

`AnchorMap = Record<Anchor, { selectors: string[] }>` con `Anchor ∈ ANCHORS` y selectores no vacíos.

Regla de igualdad: `sameContentAs(other)` (publicar lo idéntico repite la versión vigente,
no crea una).

### `EffectiveConfiguration` (tipo; calculado)

Resolución valor por valor `merchant → defaults`, más `platform` encima, con
`versions: { platform: string; defaults: string; merchant?: number }`. Se recalcula al
publicar y al importar; se sirve desde memoria.

### Puertos

- `ConfigurationStore`: `publishVersion(version sin número)` → `Result<number, …>`,
  `versionsOf(merchantId, cursor?, limit)`, `latestOf(merchantId)`.
- `ConfigurationLevels` (lectura de plataforma y defaults del release).
- Puertos **de los consumidores**, implementados por el servicio de configuración y enlazados
  en la composición: `PolicyDirectory` (decision; existe: `policiesFor` gana `surfaces`,
  `barriers`, `enabled`), `CatalogPolicies` (catalog: `freshnessFor`, `syncLevelRulesFor`),
  `IngestionPolicies` (ingestion: `dedupWindow`), `DecisionWindows` (decision: sesión y
  visitante), `SignatureWindow` (merchant), `SdkConfigurationView` (para `getSdkConfig`).

## Módulo `experiment`

### `Experiment` (clase; existe, se amplía)

| Campo                                                       | Tipo                                     | Regla                                                   |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `status`                                                    | `"calibrating" \| "active" \| "closed"`  | `calibrating → active → closed`, `calibrating → closed` |
| `targetSample`, `cuts?`                                     | `number`, `number[]`                     | ≥ 1; cortes crecientes (D-F)                            |
| `openedAt`, `activatedAt?`, `windowStartedAt?`, `closedAt?` | `Date`                                   | `windowStartedAt` = activación o último reinicio        |
| `windowRestarts`                                            | `{ at, reason, configurationVersion }[]` | cada versión correctiva                                 |

`assign` no cambia. Reglas: `activated(now)`, `closed(now)`, `windowRestarted(now, reason,
version)`, `isOpen()` (calibrating o active), `phaseOf(now)` → `"calibration" | "accumulation"`.
`startedAt` de hoy pasa a `openedAt` (la semilla lo trae; la API lo acuña).

### Puertos

- `ExperimentStore`: `open`, `update` (activar, cerrar, reiniciar ventana: la entidad ya
  decidió), `get`, `listOf(merchantId)`.
- `ExperimentDirectory` (existe): `activeFor` devuelve el abierto (`calibrating` o `active`).

## Módulo `ledger`

### `DecisionFacts` (se amplía)

| Campo           | Tipo                                                        |
| --------------- | ----------------------------------------------------------- |
| `configuration` | `{ platform: string; defaults: string; merchant?: number }` |
| `phase?`        | `"calibration"` (ausente en acumulación o sin experimento)  |

## Módulo `admin` (nuevo)

### `Operator` (clase)

| Campo               | Tipo                               | Regla                           |
| ------------------- | ---------------------------------- | ------------------------------- |
| `operatorId`        | `OperatorId` (`ids.ts` del módulo) | identificador, no dato personal |
| `tokenFingerprints` | `string[]`                         | hasta dos (rotación)            |
| `scope`             | `"*" \| MerchantId[]`              |                                 |

Regla: `scopeFor(merchantId)` → `Result<MerchantId, MerchantOutOfScope>`.

### `AdminEntry` (tipo)

| Campo         | Tipo                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| `at`          | `Date`                                                                                      |
| `operatorId`  | `OperatorId` (o `system`)                                                                   |
| `operation`   | `string` (operationId)                                                                      |
| `merchantId?` | `MerchantId`                                                                                |
| `outcome`     | `"accepted" \| "rejected" \| "denied"`                                                      |
| `code?`       | slug del error cuando `rejected`/`denied`                                                   |
| `result?`     | `{ configurationVersion?: number; experimentId?: ExperimentId; windowRestarted?: boolean }` |
| `reason?`     | motivo declarado (versión correctiva)                                                       |

### `AnchorDiagnostic` (tipo)

| Campo                                                       | Tipo                       |
| ----------------------------------------------------------- | -------------------------- |
| `merchantId`, `anchor`, `pageType`, `configurationVersion?` | claves                     |
| `lastSeenAt`, `count`                                       | último instante y contador |

### Puertos

- `OperatorDirectory`: `findByTokenFingerprint`.
- `AdminLog`: `record(entry)`, `list(cursor?, limit)`, `listOf(merchantId, cursor?, limit)`.
- `AnchorDiagnosticsStore`: `upsert(diagnostic)`, `listOf(merchantId)` (tope de plataforma).

## Catálogos del contrato que cambian

- `contracts/no-op-reasons.yaml`: `merchant-off`.
- `contracts/problem-types.yaml`: `merchant-out-of-scope` (403), `merchant-not-found` (404),
  `merchant-deactivated` (409), `origin-already-registered` (422), `configuration-frozen`
  (409), `experiment-already-open` (409), `experiment-not-open` (409),
  `rotation-grace-too-long` (422), `operator-unknown` (401). Los slugs de invariantes de
  política que ya existen (`invalid-treatment-share`, `invalid-seed`, `invalid-origin`,
  `invalid-commercial-version`, …) pasan a emitirse como 422 con `pointer` al campo.
- `contracts/api-map.yaml`: ver R-10.

## Transiciones

```
Merchant:     active ⇄ off ; active|off → deactivated (terminal)
Experiment:   (open) calibrating → active → closed ; calibrating → closed
Configuration: v1 → v2 → … (nunca se edita); con experimento active: sólo corrective
```
