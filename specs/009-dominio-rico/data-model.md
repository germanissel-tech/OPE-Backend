# Data model — Feature 009

Los datos no cambian; cambia **quién garantiza las reglas**. Cada aggregate: `private
constructor`, `static of(...)` → `Result`, `static rehydrate(...)` → instancia (sin reglas de
creación), campos `readonly`.

## EventBatch (`domain/ingestion/event-batch.ts`)

| Miembro                  | Tipo / regla                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `of(events, now)`        | `Result<EventBatch, IngestionError>`; ≥ 1 evento (si no, `throw`: error de programación); todos con la misma `sessionId` y `visitorId` (`SessionVisitorMismatch(eventId)`); `occurredAt ∈ [now − 24 h, now + 5 min]` (`EventTimestampOutOfRange(eventId)`); orden de comprobación: coherencia, luego tolerancia |
| `events`                 | `readonly Event[]`                                                                                                                                                                                                                                                                                              |
| `sessionId`, `visitorId` | los del primer evento (iguales en todos)                                                                                                                                                                                                                                                                        |
| `eventIds()`             | `EventId[]` en orden                                                                                                                                                                                                                                                                                            |
| `noOpReason()`           | `"page-context-incomplete"` si toda página de producto carece de `productId`; si no `"decision-plane-unavailable"`. PROPUESTO → módulo `decision` (feature 011)                                                                                                                                                 |

No se persiste: sin `rehydrate`.

## Decision (`domain/ledger/decision.ts`)

`type Decision = NoOpDecision | InterveneDecision`; discriminante `outcome`.

| Miembro (base)                                                    | Tipo / regla                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decisionId`, `merchantId`, `sessionId`, `visitorId`, `decidedAt` | como hoy                                                                                                                                                           |
| `experiment?`                                                     | `{ experimentId, arm }`                                                                                                                                            |
| `belongsTo(sessionId, visitorId)`                                 | igualdad de ambos                                                                                                                                                  |
| `isIntervention()`                                                | `this is InterveneDecision`                                                                                                                                        |
| `DecisionBase.rehydrate(record)`                                  | `DecisionRecord` (campos planos + `outcome` + `reason?` + `intervention?`) → la subclase según `outcome`; `INTERVENE` sin `intervention` ⇒ `throw` (dato corrupto) |

| Subclase            | Campo propio                 | Fábrica                                         |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| `NoOpDecision`      | `reason: NoOpReason`         | `NoOpDecision.of({ base…, reason })`            |
| `InterveneDecision` | `intervention: Intervention` | `InterveneDecision.of({ base…, intervention })` |

`NoOpReason` se importa del módulo `ingestion`? No: el mapa de contextos no lo permite
(`ledger → shared-kernel`). El catálogo `NO_OP_REASONS` y `NoOpReason` **se mueven al
`shared-kernel` del dominio** (es vocabulario compartido entre ingesta, ledger y, mañana,
decisión); `domain/ingestion/index.ts` lo reexporta para no tocar consumidores.

## Experiment (`domain/experiment/experiment.ts`)

| Miembro                                                                     | Tipo / regla                                                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `of({ experimentId, merchantId, treatmentShare, seed, status, startedAt })` | `Result<Experiment, ExperimentError>`; `0 ≤ treatmentShare ≤ 1` y finito (`InvalidTreatmentShare`); `seed` no vacío (`InvalidSeed`) |
| `rehydrate(record)`                                                         | mismos campos, sin reglas                                                                                                           |
| `treatmentShare`                                                            | número 0–1 (convención de tasas); el porcentaje vive sólo en `OPE_MERCHANTS`                                                        |
| `assign(visitorId)`                                                         | `Arm`: `fnv1a32(merchantId ␟ experimentId ␟ seed ␟ visitorId) % 100 < treatmentShare × 100` — idéntico a la 007                     |
| `isActive()`                                                                | `status === "active"`                                                                                                               |

`activeExperiment(list)` desaparece: el gateway de configuración usa `experiments.find((e) =>
e.isActive())`.

## Merchant (`domain/merchant/merchant.ts`) y Origin (`origin.ts`)

| Miembro                                            | Tipo / regla                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Merchant.of({ merchantId, ingestKeys, origins })` | `Result<Merchant, MerchantError>`; cada origen pasa por `Origin.parse`; inválido ⇒ `InvalidOrigin(index)`; claves como hoy (strings públicos) |
| `Merchant.rehydrate(record)`                       | sin reglas; los orígenes ya normalizados                                                                                                      |
| `owns(key)`                                        | `key !== "" && ingestKeys.includes(key)`                                                                                                      |
| `allowsOrigin(text)`                               | `text === undefined` ⇒ `true`; no parseable ⇒ `false`; si no, algún `Origin` igual                                                            |
| `origins`                                          | `readonly Origin[]`                                                                                                                           |
| `Origin.parse(text)`                               | `scheme://host[:port]`, sin path; minúsculas; `undefined` si no cumple                                                                        |
| `Origin.value`, `equals(other)`                    | valor canónico; igualdad por valor                                                                                                            |

## Errores nuevos

| Módulo       | Clase                   | `code`                    | Status catálogo | Uso                        |
| ------------ | ----------------------- | ------------------------- | --------------- | -------------------------- |
| `experiment` | `InvalidTreatmentShare` | `invalid-treatment-share` | 500             | configuración (nunca HTTP) |
| `experiment` | `InvalidSeed`           | `invalid-seed`            | 500             | configuración              |
| `merchant`   | `InvalidOrigin`         | `invalid-origin`          | 500             | configuración              |

`ConfigError(campo, mensaje)` en `composition/config.ts` se construye a partir del `code`:
`invalid-treatment-share` → `merchants[i].experiments[j].treatmentPercent`, `invalid-seed` →
`…seed`, `invalid-origin` → `merchants[i].origins[k]` (el `details.index` del error da `k`).

## Política de deduplicación (`application/ingestion/policies/dedup-window.ts`)

`DEDUP_WINDOW = { ttlMs: hours(24), maxIds: 100_000 }` (publicado en la descripción de
`ingestEvents`). `memoryEventDedup(clock, window)` la recibe; el módulo de composición la pasa.

## Puertos (todos `Promise`)

| Puerto                                                 | Métodos                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `MerchantDirectory`                                    | `findByIngestKey(key): Promise<Merchant \| undefined>`, `isRegisteredOrigin(origin): Promise<boolean>` |
| `ExperimentDirectory`                                  | `activeFor(merchantId): Promise<Experiment \| undefined>`                                              |
| `EventDedup`                                           | `claim(merchantId, ids): Promise<ReadonlySet<EventId>>`                                                |
| `DecisionLedger`, `ExposureLedger`, `AssignmentLedger` | `record(...)`, `find(...)`: `Promise`                                                                  |
| `CorsPolicy` (infra)                                   | `isRegisteredOrigin(origin): Promise<boolean>`                                                         |
