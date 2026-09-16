# Tasks: Protocolo del SDK e ingesta de eventos

**Input**: Design documents from `specs/004-protocolo-sdk-ingesta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: exigidas por la spec (FR-004, FR-050, FR-052, FR-053, SC-001..SC-005). Las pruebas de
cada historia se escriben antes del código que las hace pasar; las de invariante llevan
`[invariant:<slug>]` en el título (ADR-007).

**Organization**: por historia, respetando el orden de commits del plan: (1) contrato +
catálogos + glosario + ADRs; (2) reorganización + composición + arquitectura; (3) merchant +
seguridad + CORS; (4) ingesta + decisión; (5) exposición; (6) aislamiento, latencia, privacidad,
guía. Cada commit con `contract:check`, `typecheck`, `arch`, `test` en verde.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Árbol objetivo de `src/` en plan.md ("Source Code"). Rutas de
módulo: `src/<anillo>/<módulo>/…`; API pública de cada módulo en `index.ts`.

---

## Phase 1: Setup — contrato, catálogos, glosario, ADRs (commit 1)

- [x] T001 Copiar el diseño a `contracts/`: `specs/004-protocolo-sdk-ingesta/contracts/paths/{events,exposures}.yaml` → `contracts/paths/`; `components/schemas/*.yaml` (29 archivos) → `contracts/components/schemas/`; `components/responses/{Forbidden,EventBatchUnprocessable,ExposureUnprocessable}.yaml` → `contracts/components/responses/`; `components/securitySchemes/ingestKey.yaml` → `contracts/components/securitySchemes/`; `examples/{event-batch,ingest-result,exposure-confirmation,exposure-recorded}.yaml` → `contracts/examples/`; `no-op-reasons.yaml` → `contracts/no-op-reasons.yaml`.
- [x] T002 Editar `contracts/openapi.yaml` según `specs/004-protocolo-sdk-ingesta/contracts/openapi.additions.md`: `info.version: 1.1.0`; tag `ingest` ("Ingesta de señales y confirmaciones desde el SDK del merchant."); paths `/v1/events` y `/v1/exposures` con `$ref`; `components.securitySchemes.ingestKey: { $ref: ./components/securitySchemes/ingestKey.yaml }` (única excepción a "sin components en la raíz", ADR-014 §7) y actualizar el comentario de la raíz.
- [x] T003 [P] Agregar a `contracts/problem-types.yaml` los cinco tipos de `specs/004-protocolo-sdk-ingesta/contracts/problem-types.additions.yaml` (`origin-not-allowed` 403, `session-visitor-mismatch` 422, `event-timestamp-out-of-range` 422, `exposure-decision-unknown` 422, `exposure-of-no-op` 422) y replicarlos en `src/adapters/http/problem-details.ts` (`PROBLEM_TYPES`) para que `tests/unit/problem-details.test.ts` siga verificando la réplica.
- [x] T004 [P] Extender `scripts/check-glossary.mjs` (`resolveCompound`): probar además la unión con `_` (`words.join("_")`) para que `ProductViewed` resuelva a una nota `en: product_viewed`; caso en `tests/governance/check-glossary.test.ts` (fixture con schema `FooBar` y nota `en: foo_bar` resuelve; sin la nota, huérfano).
- [x] T005 [P] Glosario (research R-09; fuente 01 §3.1/§5/§6/§10.2, 03 §4.1): notas nuevas en `docs/dominio/`: `exposicion.md` (`exposure`), `ingesta.md` (`ingest`), `ledger.md` (`ledger`), `no-op.md` (`no-op`), `anclaje.md` (`anchor`), `intervencion.md` (`intervention`), `pagina.md` (`page`), `producto.md` (`product`), `variante.md` (`variant`), `listado.md` (`listing`), `carrito.md` (`cart`), `checkout.md` (`checkout`), `dispositivo.md` (`device`), `importe.md` (`money`), `origen.md` (`origin`), `credencial-de-ingesta.md` (`ingest-key`, `uso: disponible`); quitar `uso: pendiente` de `evento.md`, `sesion.md`, `visitante.md`, `decision.md`.
- [x] T006 [P] Glosario de señales: una nota por tipo de evento en `docs/dominio/eventos/` con `en` igual al valor de cable (`product_viewed`, `listing_viewed`, `size_selector_interacted`, `variant_selected`, `photo_interacted`, `block_dwelled`, `cta_approached`, `product_returned_to`, `added_to_cart`, `removed_from_cart`, `checkout_advanced`, `exit_signaled`), `contexto: ingesta`, `fuente: mvp:03-alcance-mvp.md#4.1`, cita textual de la señal; agregar a `docs/dominio/_tecnicos.json`: `id`, `result`, `batch`, `context`, `class`, `confirmation`, `to`, `from`; actualizar `docs/dominio/README.md` (subcarpeta `eventos/`).
- [x] T007 [P] ADRs: `docs/adr/013-anillos-modulos-y-composicion.md` y `docs/adr/014-protocolo-del-sdk.md` a `estado: aceptada`; `docs/adr/006-capas-y-direccion-de-dependencias.md` a `estado: reemplazada` (por ADR-013).
- [x] T008 Declarar las pruebas de invariante pendientes como `it.todo("[invariant:<slug>] …")` en los archivos que las implementarán (`tests/integration/cors.test.ts`: `origin-not-allowed`; `tests/unit/domain/ingestion/batch.test.ts`: `session-visitor-mismatch`, `event-timestamp-out-of-range`; `tests/unit/application/ledger/confirm-exposure.test.ts`: `exposure-decision-unknown`, `exposure-of-no-op`) para que `check:invariant-tests` pase sin pruebas decorativas (vitest las reporta como `todo`); cada historia reemplaza su `todo` por la prueba real.
- [x] T009 `npm run contract:types` (regenera `src/generated/api.d.ts`; todavía en la ruta vieja) y verificar `npm run contract:check` completo en verde (lint, bundle, `contract:diff` sin cambios incompatibles, tipos al día, los cuatro `check:*`) y `npm test` en verde; el servidor responde `501 not-implemented` en `POST /v1/events` y `/v1/exposures` (prueba temporal en `tests/integration/server.test.ts`, se reemplaza en US2/US4). Commit `feat(contrato): operaciones de ingesta y exposición, catálogos y glosario`.

**Checkpoint**: contrato 1.1.0 publicado en `contracts/`; `contract:docs` muestra las tres operaciones.

---

## Phase 2: Foundational — reglas de arquitectura y helper de pruebas

- [x] T010 Reescribir `.dependency-cruiser.cjs` según research R-01 y `node_modules/.cache/dc-probe/.dependency-cruiser.cjs` (verificado): `SRC = "(?:^|/)src/"`, `MOD = SRC + "(domain|application)/"`, `CONTEXT_MAP` (`shared-kernel: []`, `system: [shared-kernel]`, `merchant: [shared-kernel]`, `ingestion: [shared-kernel, merchant]`, `ledger: [shared-kernel, ingestion]`); reglas `domain-is-pure` (sin npm/Node/tipos y sin `application|interface-adapters|infrastructure|composition|main`), `application-inward`, `adapters-inward`, `infrastructure-inward`, `nobody-imports-main`, `nobody-imports-composition` (salvo `main.ts`), `modules-only-via-index` (`pathNot: [MOD + "$2/", MOD + "[^/]+/index\\.ts$"]`), `context-map:<módulo>` generadas, `gateways-no-cross` (`interface-adapters/gateways/<x>/` no importa `gateways/<y>/`), `controllers-no-gateways`, `no-circular`; `options.tsPreCompilationDeps: "specify"`, `doNotFollow: node_modules`.
- [x] T011 Reemplazar `tests/architecture/fixtures/src/` por un árbol con la forma nueva y **un fixture por regla**: `domain/ingestion/bad-npm.ts`, `domain/ingestion/bad-application.ts`, `application/ledger/bad-adapter.ts`, `interface-adapters/http/controllers/x/bad-infra.ts`, `infrastructure/http/bad-composition.ts`, `some/bad-main.ts`, `some/bad-composition.ts`, `application/ledger/bad-internal-import.ts` (importa `../merchant/ports/x.ts`), `domain/ledger/bad-context.ts` (importa `../system/index.ts`), `domain/shared-kernel/bad-context.ts` (importa `../merchant/index.ts`), `interface-adapters/gateways/a/bad-cross.ts`, `interface-adapters/http/controllers/x/bad-gateway.ts`, más módulos legítimos (`ledger` importa `../ingestion/index.ts`); reescribir `tests/architecture/architecture.test.ts` afirmando cada regla por nombre y que los legítimos no disparan (SC-002).
- [x] T012 [P] Crear `tests/helpers/test-app.ts`: `testMerchants` (A: `merchantId: "m_a"`, claves `key-a-1`, `key-a-2`, orígenes `https://a.example`; B: `key-b-1`, `https://b.example`), `startTestApp(overrides?)` que llama a `bootstrap(testConfig, overrides)` (se implementa en US1) y devuelve `{ app, ports, close }`, helpers `postEvents(app, key, batch, origin?)`, `postExposure(app, key, body, origin?)`, `batchOf(n, over?)` (eventos válidos con ids únicos y `occurredAt = now`), y `fixedClock(at)`. Actualizar `.prettierignore` y `eslint.config.mjs` (`src/generated/**` → `src/interface-adapters/http/generated/**`).

**Checkpoint**: `npm run arch` corre con la configuración nueva (rojo hasta US1); fixtures listos.

---

## Phase 3: User Story 1 — Composición y anillos (Priority: P1) (commit 2)

**Goal**: `src/` = `main.ts` + `composition/` + cuatro anillos con módulos; `bootstrap` tipado con perfil de memoria; `getHealth` idéntico; suite anterior verde sin tocar aserciones.

**Independent Test**: `npm run arch` en 0; `tests/architecture` verde; `tests/integration/bootstrap.test.ts` obtiene la app con `{ ports: { clock: fixedClock } }` y `GET /v1/health` devuelve ese instante; `tests/unit/main.test.ts` verifica que `src/main.ts` no importa nada fuera de `composition/`.

### Tests

- [x] T013 [P] [US1] Crear `tests/integration/bootstrap.test.ts`: (a) `bootstrap(config)` devuelve `{ app, ports, close }` y `GET /v1/health` responde 200 con la forma de siempre; (b) con `{ ports: { clock: fixedClock("2026-01-01T00:00:00Z") } }` la respuesta trae ese `timestamp`; (c) `close()` cierra la app (segundo `inject` falla) y llama a `close()` de un gateway falso inyectado; (d) en modo `mock` responde los ejemplos del contrato.
- [x] T014 [P] [US1] Crear `tests/unit/main.test.ts`: lee `src/main.ts` y afirma que sus imports son sólo de `./composition/` y de módulos de Node (`node:*`); sin `new`, sin `Fastify`, sin `OpenAPIBackend` (escenario 5 de US1). Crear `tests/typecheck/fixtures/ports-incomplete.ts` (perfil que omite un puerto de `Ports`) y agregar el caso a `tests/typecheck/typecheck.test.ts` (TS2741, escenario 6).

### Implementation

- [x] T015 [US1] Mover con `git mv` (historia intacta): `src/domain/health.ts` → `src/domain/system/health.ts` (+ `src/domain/system/index.ts`); `src/ports/clock.ts` → `src/application/shared-kernel/ports/clock.ts` (+ `index.ts`); `src/adapters/clock/system-clock.ts` → `src/interface-adapters/gateways/shared-kernel/system-clock.ts`; `src/adapters/http/build-server.ts` → `src/infrastructure/http/build-server.ts`; `src/adapters/http/problem-details.ts` y `src/handlers/typed.ts` → `src/interface-adapters/http/`; `src/handlers/health.ts` → `src/interface-adapters/http/controllers/system/get-health.ts`; `src/generated/api.d.ts` → `src/interface-adapters/http/generated/api.d.ts`; `src/client/index.ts` → `src/interface-adapters/http/client.ts`; corregir imports relativos; borrar `src/handlers/`, `src/ports/`, `src/adapters/`, `src/generated/`, `src/client/`.
- [x] T016 [US1] Crear `src/domain/shared-kernel/{index,ids,instant}.ts`: tipos marcados `MerchantId`, `SessionId`, `VisitorId`, `EventId`, `DecisionId` (`string & { readonly __brand: "…" }`) con constructores `asMerchantId(s)` etc. que validan `^[A-Za-z0-9_-]{8,64}$` (salvo `MerchantId`, libre) y `Instant` (ms epoch, `instantFrom(iso)`, `isoOf(instant)`); `src/application/shared-kernel/ports/id-generator.ts` (`IdGenerator { decisionId(): DecisionId }`) exportado por el `index.ts` del módulo; `src/application/system/get-service-health.ts` (caso de uso que envuelve `serviceHealth` con `Clock`) + `index.ts`.
- [x] T017 [US1] Crear `src/composition/ports.ts` (`interface Ports { clock: Clock; ids: IdGenerator; merchants: MerchantDirectory; eventDedup: EventDedup; decisions: DecisionLedger; exposures: ExposureLedger }` — los puertos que aún no existen se agregan en su historia; en este commit `Ports = { clock, ids }`), `src/composition/config.ts` (`AppConfig { port, host, mode, contractPath, merchants: MerchantConfig[], handlersModule? }` + `readConfig(env)` con `OPE_MERCHANTS` JSON / `OPE_MERCHANTS_FILE` / merchant de prueba por defecto si `OPE_MOCK=1`), `src/composition/profiles/memory.ts` (`memoryPorts(config): Ports`), `src/composition/use-cases.ts` (`buildUseCases(ports)`), `src/composition/bootstrap.ts` (`bootstrap(config, overrides?: { ports?: Partial<Ports>; handlers?: Handlers }) → Promise<{ app, ports, close }>`: carga el contrato, arma puertos → casos de uso → controllers → `buildServer`; `close()` = `app.close()` y luego `close()` de cada gateway que lo exponga, en orden inverso).
- [x] T018 [US1] Reescribir `src/main.ts`: `readConfig(process.env)` → `bootstrap(config)` → señales `SIGINT`/`SIGTERM` → `close()` → `listen`. Mantener `OPE_HANDLERS_MODULE` (lo carga `config`/`bootstrap` como `overrides.handlers`, usado por `tests/contract/fixtures/health-203.ts`).
- [x] T019 [US1] Actualizar rutas: `scripts/contract-types.mjs`, `scripts/contract-types-check.mjs`, `scripts/contract-types-lib.mjs` (salida `src/interface-adapters/http/generated/api.d.ts`); `package.json` `exports["./client"].types` → `./dist/interface-adapters/http/client.d.ts`; imports en `tests/integration/server.test.ts`, `mock.test.ts`, `tests/unit/*.test.ts`, `tests/types/*.test-d.ts`, `tests/contract/fixtures/health-203.ts`, `tests/unit/contract-types-check.test.ts`; `tests/integration/{server,mock}.test.ts` pasan a usar `startTestApp` (sin cambiar aserciones, SC-001).
- [x] T020 [US1] `npm run arch && npm run typecheck && npm test && npm run test:contract` en verde; `git diff --stat` sin cambios en aserciones de pruebas anteriores. Commit `refactor(arquitectura): anillos, módulos y composición tipada (ADR-013)`.

**Checkpoint**: US1 completa e independiente.

---

## Phase 4: User Story 5 — Orígenes por merchant y credencial (Priority: P2, va antes porque US2 y US4 dependen del security handler) (commit 3)

**Goal**: la credencial identifica al merchant (401 si falta o es desconocida), el preflight acepta sólo orígenes registrados, el request real exige el par credencial/origen (403).

**Independent Test**: `tests/integration/cors.test.ts` y `tests/integration/ingest-key.test.ts` en verde (sobre `POST /v1/events`, que aún responde 501 tras pasar seguridad: la prueba afirma sólo los códigos 401/403/preflight).

### Tests

- [x] T021 [P] [US5] Crear `tests/unit/domain/merchant/merchant.test.ts`: `originAllowed(merchant, origin)` exacto en scheme+host+port, host case-insensitive, sin path, `undefined` → permitido; `findByIngestKey` resuelve cualquiera de las dos claves activas (FR-017) y ninguna otra.
- [x] T022 [P] [US5] Crear `tests/integration/ingest-key.test.ts`: sin header → `401 unauthorized` (Problem Details, antes que la validación del body); clave desconocida → 401; clave válida con body inválido → 400 (la seguridad va primero); la clave y el `merchantId` no aparecen en la respuesta.
- [x] T023 [P] [US5] Crear `tests/integration/cors.test.ts`: `OPTIONS /v1/events` con `Origin: https://a.example` + `Access-Control-Request-Method: POST` → 204 con `Access-Control-Allow-Origin: https://a.example` y `Access-Control-Allow-Headers` incluyendo `X-OPE-Ingest-Key`; origen no registrado por nadie → sin `Access-Control-Allow-Origin`; `POST` con `key-a-1` + `Origin: https://b.example` → `403 origin-not-allowed` `[invariant:origin-not-allowed]`; `POST` con `key-a-1` + `Origin: https://a.example` → pasa seguridad; sin `Origin` → pasa (FR-040); `OPTIONS` no cae en la ruta comodín (no 405).

### Implementation

- [x] T024 [US5] Crear `src/domain/merchant/{index,merchant}.ts`: `Merchant { merchantId: MerchantId; ingestKeys: readonly string[] (1..2); origins: readonly string[] }`, `originAllowed(merchant, origin: string | undefined): boolean`, `normalizeOrigin`.
- [x] T025 [US5] Crear `src/application/merchant/ports/merchant-directory.ts` (`MerchantDirectory { findByIngestKey(key): Merchant | undefined; isRegisteredOrigin(origin): boolean }`), `src/application/merchant/resolve-ingest-key.ts` (caso de uso: `{ key, origin }` → `{ ok: true, merchant } | { ok: false, reason: "unauthorized" | "origin-not-allowed" }`) + `index.ts`; `src/interface-adapters/gateways/merchant/config-merchant-directory.ts` (de `AppConfig.merchants`); agregar `merchants` a `Ports` y al perfil de memoria.
- [x] T026 [US5] Crear `src/interface-adapters/http/security/ingest-key.ts`: security handler `ingestKey` para openapi-backend (research R-03): lee `X-OPE-Ingest-Key` y `Origin`, llama a `resolveIngestKey`, devuelve `{ merchant }` o lanza `SecurityError(401 | 403)` que `build-server` traduce a Problem Details; exponer `merchantOf(context)` para los controllers. En `src/infrastructure/http/build-server.ts`: `registerSecurityHandler`, `unauthorizedHandler` → 401/403 según el error, y `security: {}` en modo mock igual que en real (SC-006: el SDK aprende a mandar la clave).
- [x] T027 [US5] Crear `src/infrastructure/http/cors.ts`: registra `@fastify/cors` con `origin: (origin, cb) => cb(null, origin === undefined || merchants.isRegisteredOrigin(origin))`, `methods: ["POST"]`, `allowedHeaders: ["content-type", "x-ope-ingest-key"]`, `credentials: false`, `maxAge: 600`; en `build-server.ts` excluir `OPTIONS` de la ruta comodín (research R-04) y cablearlo desde `bootstrap`.
- [x] T028 [US5] `npm run contract:check` (`check:invariant-tests` ahora encuentra `origin-not-allowed`), `npm test`, `npm run arch` en verde. Commit `feat(merchant): credencial de ingesta, directorio de merchants y CORS por origen registrado (ADR-014)`.

---

## Phase 5: User Story 2 — Ingesta deduplicada, validada y aislada (Priority: P1) (commit 4, junto con US3)

**Goal**: `POST /v1/events` acepta lotes válidos (202 con resultado por evento y decisión), rechaza el lote entero ante cualquier violación (400 con punteros), aplica las dos invariantes (422), deduplica por `eventId` por merchant y no loguea IP ni clave.

**Independent Test**: `tests/integration/ingest-events.test.ts`, `tests/unit/domain/ingestion/*.test.ts`, `tests/integration/logging-privacy.test.ts` en verde.

### Tests

- [x] T029 [P] [US2] Crear `tests/unit/domain/ingestion/batch.test.ts`: `checkBatch(batch, now)` → `ok` con lote válido; `session-visitor-mismatch` con dos `visitorId` o dos `sessionId` `[invariant:session-visitor-mismatch]`; `event-timestamp-out-of-range` con `occurredAt = now + 6 min` y con `now - 25 h` `[invariant:event-timestamp-out-of-range]`; los bordes (`+5 min`, `-24 h`) pasan; lote de 1 evento pasa.
- [x] T030 [P] [US2] Crear `tests/unit/gateways/memory-event-dedup.test.ts`: `claim("m_a", [e1, e2])` → ambos entran; segunda llamada → ninguno; `claim("m_b", [e1])` → entra (aislamiento); ventana: tras 100 000 ids por merchant los más viejos se olvidan; tras 24 h (reloj inyectado) también.
- [x] T031 [P] [US2] Crear `tests/integration/ingest-events.test.ts`: lote de 20 eventos válidos (uno por tipo al menos) → `202`, `accepted: 20`, `duplicates: 0`, `results` en orden, `decision.outcome = "NO_OP"`, `decision.reason` con patrón `^[a-z][a-z0-9-]*$`; reenviar el mismo lote → `accepted: 0`, `duplicates: 20`, cada `status: "duplicate"` (idempotencia, prueba nombrada "evento duplicado"); mismo lote con `key-b-1` → `accepted: 20` (aislamiento FR-050); campo extra en un evento (`page.email`, `foo`) → `400 validation-failed` con `errors[].pointer` exacto y nada registrado (reenviar el lote válido → todo `accepted`); tipo desconocido → 400 con `value of tag "type" must be in oneOf`; campo propio faltante (`block_dwelled` sin `dwellMs`) → 400; 51 eventos → 400; 0 eventos → 400; `session-visitor-mismatch` → 422 con `type` correcto `[invariant:session-visitor-mismatch]`; `occurredAt` fuera de tolerancia → 422 `[invariant:event-timestamp-out-of-range]`; sin `Origin` → 202; `merchantId` nunca en la respuesta.
- [x] T032 [P] [US2] Crear `tests/integration/logging-privacy.test.ts`: arranca `bootstrap` con un logger de Fastify sobre un stream capturado (`pino` destination en memoria), envía un lote con `remoteAddress` simulado (`inject` con `remoteAddress: "203.0.113.9"`) y la clave; afirma que el log **no** contiene `203.0.113.9`, `remoteAddress`, `key-a-1` ni ningún campo del body, y **sí** contiene `merchantId`, `method`, `url`, `reqId` (FR-016).

### Implementation

- [x] T033 [US2] Crear `src/domain/ingestion/event.ts`: tipos del dominio (`Event` unión discriminada por `type` con los 12 tipos y sus atributos propios exactamente como data-model.md: `size` ≤ 32, `selectedVariantId` ≤ 128, `interaction` ∈ zoom|navigate, `block` ∈ description|size_guide|reviews|policies|price|gallery|cta, `dwellMs` 0..3600000, `approach` ∈ hover|near, `previousProductId` ≤ 128, `quantity` 1..999, `step` ∈ cart|checkout_started|shipping|payment|review, `signal` ∈ inactivity|tab_hidden|back_navigation|exit_intent), `PageContext { pageType; productId?; variantId?; price?: Money; availability? }`, `Money { amount: string; currency: string }`, `DeviceClass`, `EVENT_TYPES` (lista const de 12); `src/domain/ingestion/batch.ts`: `EventBatch`, `TOLERANCE = { past: 24h, future: 5min }`, `checkBatch(batch, now): { ok: true } | { ok: false, invariant: "session-visitor-mismatch" | "event-timestamp-out-of-range", detail }`; `src/domain/ingestion/index.ts`.
- [x] T034 [US2] Crear `src/application/ingestion/ports/event-dedup.ts` (`EventDedup { claim(merchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>> | ReadonlySet<EventId> }`), `src/application/ingestion/ingest-batch.ts` (caso de uso `ingestBatch({ merchantId, batch, now })`: `checkBatch` → dedup → `decide` (US3) → `decisions.record` → `IngestOutcome { accepted, duplicates, results, decision }` | `{ ok: false, invariant }`) + `index.ts`; `src/interface-adapters/gateways/ingestion/memory-event-dedup.ts` (por merchant: `Map<EventId, Instant>` + cola FIFO; límite 100 000 y 24 h con `Clock`); agregar `eventDedup` a `Ports` y al perfil.
- [x] T035 [US2] Crear `src/interface-adapters/http/controllers/ingestion/ingest-events.ts` (`OperationHandler<"ingestEvents">`): `merchantOf(context)` → DTO generado → dominio (`instantFrom(occurredAt)`, ids marcados; el `switch` sobre `type` es exhaustivo) → `ingestBatch` → `202 IngestResult` (`isoOf` en la decisión) o `422` con `problem(invariant)`; registrarlo en `src/composition/bootstrap.ts`.
- [x] T036 [US2] Crear `src/infrastructure/http/strip-discriminator-mappings.ts` (research R-05: recorre el documento y borra `discriminator.mapping`; prueba `tests/unit/infrastructure/strip-discriminator-mappings.test.ts`: el bundle real tiene ≥ 1 `mapping` antes y 0 después; `init()` de openapi-backend con `discriminator: true` falla con el documento sin transformar y arranca con el transformado); en `build-server.ts`: aplicar antes de `new OpenAPIBackend`, `ajvOpts: { discriminator: true }`, y `toValidationErrors` sin cambios (punteros exactos).
- [x] T037 [US2] Crear `src/infrastructure/http/request-logging.ts` (research R-07): `serializers.req` → `{ method, url, reqId, merchantId? }` (sin `remoteAddress`, `headers`, `hostname`), `serializers.res` → `{ statusCode }`; `build-server.ts` lo aplica siempre (también cuando `logger: true`) y `redact` de `req.headers["x-ope-ingest-key"]` como segunda barrera.

**Checkpoint**: ingesta completa salvo el motivo `page-context-incomplete` (US3).

---

## Phase 6: User Story 3 — Siempre una decisión (Priority: P1) (commit 4)

**Goal**: toda ingesta aceptada devuelve `decision` con `decisionId` único, `outcome: NO_OP`, `reason` del catálogo; la decisión queda registrada en el ledger con merchant, sesión, visitante, motivo e instante.

**Independent Test**: `tests/unit/domain/ledger/decision.test.ts`, `tests/unit/no-op-reasons.test.ts`, escenarios de decisión en `tests/integration/ingest-events.test.ts` en verde.

### Tests

- [x] T038 [P] [US3] Crear `tests/unit/no-op-reasons.test.ts`: los slugs de `src/domain/ingestion/no-op-reasons.ts` (`NO_OP_REASONS`) son exactamente los `reasons[].slug` de `contracts/no-op-reasons.yaml` (réplica verificada, como `problem-details`); cada slug cumple el patrón del contrato.
- [x] T039 [P] [US3] Crear `tests/unit/domain/ledger/decision.test.ts`: `noOp({ merchantId, sessionId, visitorId, decidedAt, reason }, decisionId)` produce `outcome: "NO_OP"` sin `intervention`; `decide(batch)` devuelve `page-context-incomplete` cuando ningún evento con `pageType: product` trae `productId`, y `decision-plane-unavailable` en cualquier otro caso (incluido un lote sólo de `listing_viewed`).
- [x] T040 [P] [US3] Agregar a `tests/integration/ingest-events.test.ts`: dos lotes → dos `decisionId` distintos con el patrón `^[A-Za-z0-9_-]{8,64}$`; `decision.sessionId` = el del lote; lote de ficha sin `productId` → `reason: "page-context-incomplete"`; lote normal → `"decision-plane-unavailable"`; `ports.decisions.find("m_a", decisionId)` devuelve la decisión con `merchantId`, `visitorId`, `decidedAt` = reloj fijo; `find("m_b", decisionId)` → `undefined` (aislamiento); un lote rechazado (422) no registra decisión; en modo mock la respuesta trae la `decision` del ejemplo.

### Implementation

- [x] T041 [US3] Crear `src/domain/ingestion/no-op-reasons.ts` (`NO_OP_REASONS = ["decision-plane-unavailable", "page-context-incomplete"] as const`, `NoOpReason`) exportado por el `index.ts` de `ingestion`; `src/domain/ledger/decision.ts` (`Decision { decisionId; merchantId; sessionId; visitorId; decidedAt; outcome: "NO_OP" | "INTERVENE"; reason; intervention?: { messageVersionId; anchor } }`, `Anchor`, `noOp(...)`, `decide(batch): NoOpReason`) + `src/domain/ledger/index.ts`.
- [x] T042 [US3] Crear `src/application/ledger/ports/decision-ledger.ts` (`DecisionLedger { record(decision): Promise<void> | void; find(merchantId, decisionId): Decision | undefined | Promise<…> }`) + `index.ts` de `application/ledger`; `src/interface-adapters/gateways/ledger/memory-decision-ledger.ts` (clave `merchantId + "/" + decisionId`); `src/interface-adapters/gateways/shared-kernel/random-ids.ts` (`decisionId()` = `"dec_" + randomUUID sin guiones`); agregar `decisions` a `Ports` y al perfil; completar `ingestBatch` (US2) con `decide` + `decisions.record`; el controller traduce `Decision` → DTO (`decidedAt` no viaja; `reason` string).
- [x] T043 [US3] `npm run contract:check`, `npm test`, `npm run arch`, `npm run test:contract` en verde (Schemathesis ahora ejercita `ingestEvents` con la clave del merchant de prueba: pasar `X-OPE-Ingest-Key` en `scripts/test-contract.mjs` vía `-H`). Commit `feat(ingesta): lotes de eventos deduplicados con decisión NO_OP inline (ADR-014)`.

---

## Phase 7: User Story 4 — Confirmación de exposición (Priority: P2) (commit 5)

**Goal**: `POST /v1/exposures` registra `EXPOSED` sólo para una decisión propia del merchant que fue intervención; repetida → `200 already-recorded`.

**Independent Test**: `tests/integration/confirm-exposure.test.ts` y `tests/unit/application/ledger/confirm-exposure.test.ts` en verde.

### Tests

- [x] T044 [P] [US4] Crear `tests/unit/application/ledger/confirm-exposure.test.ts` con ledgers falsos: decisión inexistente → `exposure-decision-unknown` `[invariant:exposure-decision-unknown]`; decisión de otro merchant → mismo resultado; sesión o visitante distintos de la decisión → mismo resultado; decisión `NO_OP` → `exposure-of-no-op` `[invariant:exposure-of-no-op]`; decisión `INTERVENE` → `recorded` y segunda vez `already-recorded` sin segundo registro.
- [x] T045 [P] [US4] Crear `tests/integration/confirm-exposure.test.ts`: `decisionId` inventado → `422 urn:ope:problem:exposure-decision-unknown`; decisión emitida por un lote de `m_b` confirmada con `key-a-1` → misma respuesta (aislamiento FR-050); decisión `NO_OP` real (de un lote) → `422 exposure-of-no-op`; decisión `INTERVENE` inyectada con `ports.decisions.record(...)` → `201 { status: "recorded" }`, repetida → `200 { status: "already-recorded" }`; body con campo extra → 400; sin clave → 401; `Origin` de otro merchant → 403; `ports.exposures` contiene una sola exposición con `anchor` y `exposedAt`.

### Implementation

- [x] T046 [US4] Crear `src/domain/ledger/exposure.ts` (`Exposure { merchantId; decisionId; sessionId; visitorId; exposedAt; anchor }`, `EXPOSED`) y exportarlo; `src/application/ledger/ports/exposure-ledger.ts` (`ExposureLedger { record(exposure): "recorded" | "already-recorded" | Promise<…> }`); `src/application/ledger/confirm-exposure.ts` (caso de uso: `find` → coincidencia de sesión/visitante → `outcome === "INTERVENE"` → `record`); `src/interface-adapters/gateways/ledger/memory-exposure-ledger.ts` (clave `merchantId/decisionId`); agregar `exposures` a `Ports` y al perfil.
- [x] T047 [US4] Crear `src/interface-adapters/http/controllers/ledger/confirm-exposure.ts` (`OperationHandler<"confirmExposure">`): `recorded` → 201, `already-recorded` → 200, invariante → 422 con `type` del catálogo; registrarlo en `bootstrap`; quitar la prueba temporal de 501.
- [x] T048 [US4] `contract:check` (todos los slugs con prueba), `test`, `arch`, `test:contract` en verde. Commit `feat(ledger): confirmación de exposición y ledger en memoria`.

---

## Phase 8: Polish — aislamiento, latencia, guía y cierre (commit 6)

- [x] T049 [P] Crear `tests/integration/isolation.test.ts` (FR-050, SC-005) como suite única y legible: mismo `eventId` en A y B → ambos `accepted`; decisión de A no visible para B (`find` y `POST /v1/exposures`); exposición de A no visible en `ports.exposures` bajo B; clave de A + origen de B → 403; clave de B no ve nada de A. Cada caso nombra los dos merchants.
- [x] T050 [P] Crear `tests/integration/ingest-latency.test.ts` (FR-053, SC-003): 200 lotes de 20 eventos con ids únicos vía `inject`, `performance.now()` por lote, calcula p50/p95, los imprime (`console.info`) y afirma `p95 < 50`; comentario con la política del plan (si CI es ruidoso, relajar la aserción y conservar el reporte).
- [x] T051 [P] Actualizar `CLAUDE.md`: paso 4 del flujo (controller en `src/interface-adapters/http/controllers/<módulo>/<operacion>.ts`, caso de uso en `application/<módulo>/`, reglas en `domain/<módulo>/`, registro en `composition/bootstrap.ts`); tabla "Capas" → "Anillos y módulos (ADR-013)" con el mapa de contextos y la regla del `index.ts`; nota sobre `components.securitySchemes` en la raíz y `discriminator.mapping` (ADR-014); `contract:types` con la ruta nueva; variables `OPE_MERCHANTS`/`OPE_MERCHANTS_FILE`; sección "Composición" (perfiles, overrides, `Ports`).
- [x] T052 [P] Actualizar `README.md` (cómo levantar con un merchant de prueba y probar `POST /v1/events` con `curl`), `tests/contract/README.md` (clave de ingesta para Schemathesis) y `specs/004-protocolo-sdk-ingesta/quickstart.md` (tabla de estado fechada con BUILT / TESTED por historia y los p50/p95 medidos).
- [x] T053 Verificación final: `npm run contract:check && npm run format:check && npm run lint && npm run typecheck && npm run arch && npm test && npm run test:contract && npm run release-check && npm run contract:docs`; `Excepciones de lint: 0`; `check:markers` sólo con `PROPUESTO` (intervención y protocolo de decisión). Marcar `[x]` todas las tareas. Commit `chore(004): aislamiento, latencia, guía de agentes y cierre de la feature`.

---

## Dependencies

- Phase 1 → Phase 2 → US1 (Phase 3) → US5 (Phase 4) → US2 (Phase 5) + US3 (Phase 6, mismo commit) → US4 (Phase 7) → Polish.
- US5 va antes que US2/US4 porque ambas operaciones pasan por el security handler; sus pruebas se ejercitan sobre el 501 provisional.
- US2 y US3 comparten commit: `IngestResult.decision` es obligatorio en el contrato.

## Parallel Execution Examples

- Phase 1: T003, T004, T005, T006, T007 en paralelo tras T001/T002; T008 antes de T009.
- US1: T013 y T014 en paralelo; T015 antes de T016–T019.
- US5: T021–T023 en paralelo; luego T024 → T025 → T026 → T027.
- US2: T029–T032 en paralelo; T033 → T034 → T035; T036 y T037 en paralelo con T034.
- Polish: T049–T052 en paralelo.

## Implementation Strategy

MVP = Phase 1 + US1 (el repo vuelve a verde con la forma definitiva). Después US5 (seguridad y
CORS, pequeña), US2+US3 (el grueso), US4 (corta), Polish. Cada commit deja `contract:check`,
`typecheck`, `arch`, `test` en verde; las invariantes sin implementación figuran como `it.todo`
hasta su historia (ninguna queda en `todo` después del commit 5).
