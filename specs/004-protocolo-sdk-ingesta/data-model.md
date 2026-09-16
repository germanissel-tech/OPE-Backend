# Data model — Feature 004

Sin persistencia real: todo vive en memoria detrás de puertos. El contrato ([contracts/](contracts/))
es la fuente de las formas de cable; acá van las entidades del dominio, sus reglas y los puertos.
Los identificadores son **tipos marcados** (`MerchantId`, `SessionId`, `VisitorId`, `EventId`,
`DecisionId`: `string & { readonly __brand }`) para que el compilador impida cruzarlos.

## Merchant (módulo `merchant`)

| Campo        | Tipo                 | Regla                                                                                      |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| `merchantId` | `MerchantId`         | interno; **nunca** viaja en el request (constitución V)                                    |
| `ingestKeys` | `IngestKey[]` (1..2) | públicas, rotables; dos activas durante una rotación (FR-017); distintas de las del portal |
| `origins`    | `Origin[]` (≥ 1)     | `scheme://host[:port]`, comparación exacta y case-insensitive en host; sin path            |

Fuente en esta feature: configuración (`OPE_MERCHANTS` JSON o `OPE_MERCHANTS_FILE`; con
`OPE_MOCK=1`, un merchant de prueba por defecto). `originAllowed(merchant, origin)` es función
pura del dominio.

## Evento (módulo `ingestion`)

Unión discriminada por `type` con exactamente los 12 tipos de 03 §4.1 (ver
[contracts/components/schemas/Event.yaml](contracts/components/schemas/Event.yaml)). Comunes:

| Campo        | Tipo                 | Regla                                                                                           |
| ------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `type`       | literal por rama     | discriminador; valor de cable en `snake_case`                                                   |
| `eventId`    | `EventId`            | `^[A-Za-z0-9_-]{8,64}$`; lo genera el SDK; único por merchant (deduplicación)                   |
| `sessionId`  | `SessionId`          | mismo patrón; todos los eventos de un lote comparten uno                                        |
| `visitorId`  | `VisitorId`          | mismo patrón; seudónimo; todos los eventos de un lote comparten uno                             |
| `occurredAt` | `Instant` (ms epoch) | `now - 24h ≤ occurredAt ≤ now + 5min` (invariante `event-timestamp-out-of-range`)               |
| `page`       | `PageContext`        | `pageType` obligatorio ∈ product, listing, cart, checkout, other; resto opcional (lista blanca) |
| `device`     | `DeviceClass`        | ∈ desktop, mobile, tablet                                                                       |

Atributos propios por tipo (todos obligatorios en su rama): `size_selector_interacted.size`
(≤ 32), `variant_selected.selectedVariantId` (≤ 128), `photo_interacted.interaction` ∈ zoom,
navigate; `block_dwelled.block` ∈ description, size_guide, reviews, policies, price, gallery,
cta y `dwellMs` 0..3 600 000; `cta_approached.approach` ∈ hover, near;
`product_returned_to.previousProductId` (≤ 128); `added_to_cart.quantity` 1..999;
`checkout_advanced.step` ∈ cart, checkout_started, shipping, payment, review;
`exit_signaled.signal` ∈ inactivity, tab_hidden, back_navigation, exit_intent.
`product_viewed`, `listing_viewed`, `removed_from_cart` no tienen atributos propios.

`PageContext.price` es `Money = { amount: string ^\d+(\.\d{1,2})?$, currency: ^[A-Z]{3}$ }`.
`availability` ∈ in_stock, out_of_stock, unknown.

## Lote (`EventBatch`)

`events: Event[1..50]`. Reglas (`checkBatch`, dominio puro, devuelve la primera invariante
violada o `ok`):

1. `session-visitor-mismatch` (422): todos los `sessionId` iguales y todos los `visitorId` iguales.
2. `event-timestamp-out-of-range` (422): cada `occurredAt` dentro de la tolerancia respecto de `now`.

Un lote rechazado no produce decisión ni registra nada. El orden lo da `occurredAt`.

## Deduplicación (puerto `EventDedup`)

`claim(merchantId, eventIds[]) → Set<EventId>` con los que **entraron** (los demás eran
duplicados). Clave: `(merchantId, eventId)`; el mismo `eventId` en dos merchants son eventos
distintos (FR-013, FR-050). Ventana del perfil en memoria: 24 h **o** 100 000 `eventId` por
merchant, lo que ocurra antes (declarada en el contrato). No es una invariante: el duplicado se
reporta (`EventResult.status = duplicate`) y se prueba como idempotencia.

## Decisión (módulo `ledger`)

| Campo          | Tipo                       | Regla                                                                   |
| -------------- | -------------------------- | ----------------------------------------------------------------------- |
| `decisionId`   | `DecisionId`               | lo genera el backend (`IdGenerator`), mismo patrón que los ids del SDK  |
| `merchantId`   | `MerchantId`               | del security handler; no viaja en la respuesta                          |
| `sessionId`    | `SessionId`                | del lote                                                                |
| `visitorId`    | `VisitorId`                | del lote                                                                |
| `decidedAt`    | `Instant`                  | `clock.now()`                                                           |
| `outcome`      | `"NO_OP"` \| `"INTERVENE"` | en esta feature siempre `NO_OP`; `INTERVENE` sólo se inyecta en pruebas |
| `reason`       | `NoOpReason` (slug)        | del catálogo `contracts/no-op-reasons.yaml`; string con patrón, no enum |
| `intervention` | `Intervention?`            | `{ messageVersionId, anchor }`; PROPUESTO; ausente cuando `NO_OP`       |

Motivos iniciales: `decision-plane-unavailable` (por defecto) y `page-context-incomplete`
(ningún evento del lote en `pageType = product` trae `productId`). Estado de la cadena de
evidencia al registrarse: `DECIDED` (implícito: existe en el ledger).

Puerto `DecisionLedger`: `record(decision)`, `find(merchantId, decisionId) → Decision | undefined`
(una decisión de otro merchant es `undefined`: no se revela).

## Exposición (módulo `ledger`)

| Campo        | Tipo         | Regla                                           |
| ------------ | ------------ | ----------------------------------------------- |
| `decisionId` | `DecisionId` | debe existir para el merchant y ser `INTERVENE` |
| `sessionId`  | `SessionId`  | del request; debe coincidir con la decisión     |
| `visitorId`  | `VisitorId`  | del request; debe coincidir con la decisión     |
| `exposedAt`  | `Instant`    | del navegador                                   |
| `anchor`     | `Anchor`     | ∈ size_selector, price, cta, policies           |
| `merchantId` | `MerchantId` | del security handler                            |

Reglas (`confirmExposure`): `exposure-decision-unknown` (422) si `find` no devuelve o si
sesión/visitante no coinciden (misma respuesta: no revela); `exposure-of-no-op` (422) si
`outcome !== INTERVENE`. Puerto `ExposureLedger`: `record(exposure) → "recorded" | "already-recorded"`
(clave `(merchantId, decisionId)`; repetida no duplica). Estado resultante: `EXPOSED`.

## Puertos (contenedor `Ports`, módulo `composition`)

| Puerto       | Módulo          | Perfil memoria                                                |
| ------------ | --------------- | ------------------------------------------------------------- |
| `clock`      | `shared-kernel` | `SystemClock` (`Date.now`)                                    |
| `ids`        | `shared-kernel` | `RandomIds` (`crypto.randomUUID` sin guiones, prefijo `dec_`) |
| `merchants`  | `merchant`      | `ConfigMerchantDirectory` (de `AppConfig.merchants`)          |
| `eventDedup` | `ingestion`     | `MemoryEventDedup` (ventana 24 h / 100 000)                   |
| `decisions`  | `ledger`        | `MemoryDecisionLedger`                                        |
| `exposures`  | `ledger`        | `MemoryExposureLedger`                                        |

Cada gateway puede exponer `close(): Promise<void> | void`; `bootstrap().close()` los llama en
orden inverso al arranque después de cerrar Fastify.

## Mapa de contextos (`.dependency-cruiser.cjs`)

| Módulo          | Depende de                   |
| --------------- | ---------------------------- |
| `shared-kernel` | —                            |
| `system`        | `shared-kernel`              |
| `merchant`      | `shared-kernel`              |
| `ingestion`     | `shared-kernel`, `merchant`  |
| `ledger`        | `shared-kernel`, `ingestion` |

Regla adicional: un módulo importa de otro **sólo** por `<otro>/index.ts`. Los anillos:
`domain` ← `application` ← `interface-adapters` ← `infrastructure` ← `composition` ← `main.ts`.
