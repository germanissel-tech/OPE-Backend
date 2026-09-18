# Tasks: Catálogo y stock

**Input**: Design documents from `specs/010-catalogo-y-stock/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: la spec exige pruebas `[invariant:<slug>]` (SC-002), réplica de capacidades,
aislamiento (SC-005) y tamaño informativo (SC-004); las tareas de prueba están incluidas.

**Organization**: por historia; la fase fundacional trae lo que no depende del contrato nuevo
(`Money`, `platformKey`, capacidades, headers desde el cableado) y deja la suite verde.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable · **[Story]**: US1 snapshot por la plataforma · US2 verdad de producto ·
  US3 nivel observado · US4 credencial de plataforma y capacidades

## Path Conventions

Proyecto único: `src/`, `tests/`, `contracts/`, `docs/`. Módulo nuevo `catalog` en
`src/domain/catalog/`, `src/application/catalog/`, `src/interface-adapters/gateways/catalog/`,
`src/interface-adapters/http/controllers/catalog/`, `src/composition/modules/catalog.ts`.

---

## Phase 1: Setup

- [x] T001 Verificar el punto de partida (`npm run contract:check && npm run quality && npm test`
      en verde) y anotar la cantidad de pruebas en la sección histórica de
      `specs/010-catalogo-y-stock/quickstart.md`

---

## Phase 2: Foundational — Money, credencial de plataforma, capacidades, headers (US4)

- [x] T002 [P] Crear `src/domain/shared-kernel/money.ts`: `class Money` con `private
constructor`, `static of(amount, currency): Result<Money, InvalidMoney>` (`^\d+(\.\d{1,2})?$`,
      `^[A-Z]{3}$`), `static rehydrate({ amount, currency })`, `amount`, `currency`,
      `equals`; `src/domain/shared-kernel/errors.ts` gana `InvalidMoney` (`invalid-money`,
      `module = "shared-kernel"`, `details: { field }`) — como `errors.ts` del kernel exporta la
      raíz, la regla `ope/domain-error-shape` debe admitir clases concretas allí con
      `module = "shared-kernel"`; exportar desde el índice; añadir `invalid-money` (500) a
      `contracts/problem-types.yaml` y a `PROBLEM_TYPES`
- [x] T003 [P] `src/domain/ingestion/event.ts`: `PageContext.price: Money` (clase) y
      `export type { Money }` desde el índice de ingesta; el controller de ingesta construye con
      `Money.rehydrate(dto.price)`; adaptar `tests/unit/domain/**` y `tests/integration/**` sólo
      en la construcción de eventos con precio (si alguno lo usa)
- [x] T004 [US4] `src/domain/merchant/merchant.ts`: `platformKeys: readonly string[]` (0..2) en
      `MerchantInput`/`MerchantRecord`, `ownsPlatformKey(key)`; `of` rechaza una clave de
      plataforma vacía o igual a una de ingesta con `PlatformKeyCollision`
      (`platform-key-collision`, 500, `details: { index }`) en `src/domain/merchant/errors.ts`;
      catálogo de problemas + `PROBLEM_TYPES`; `tests/unit/domain/merchant/merchant.test.ts`
- [x] T005 [US4] `src/composition/config.ts`: `platformKeys` opcional (array de strings, 0..2)
      en `OPE_MERCHANTS`; `ConfigError` con campo `merchants[i].platformKeys[k]` ante colisión;
      `config/dev-merchants.json` gana `"platformKeys": ["ope_dev_platform_key"]`;
      `tests/unit/composition/config.test.ts`; `tests/helpers/test-app.ts`: `MerchantSpec.platformKeys?`
      y merchant A con `["platform-a-1"]`, B con `["platform-b-1"]`
- [x] T006 [US4] `src/application/merchant/ports/merchant-directory.ts`: `findByPlatformKey(key):
Promise<Merchant | undefined>`; gateway de configuración; nuevo
      `src/application/merchant/services/platform-key.service.ts` (`PlatformKeyResolver { resolve(key):
Promise<Result<Merchant, Unauthorized>> }`, `DefaultPlatformKeyResolver`); índice;
      `tests/unit/application/merchant/platform-key.service.test.ts`
- [x] T007 [US4] Capacidades: `src/interface-adapters/http/security/capabilities.ts` con
      `CONSUMER_CAPABILITIES = { sdk: [...], platform: [...] } as const` (réplica de
      `consumers.<x>.capabilities` de `contracts/api-map.yaml`) y `tests/unit/http/capabilities.test.ts`
      que la compara con el mapa; `SecurityOutcome` gana `capabilities: readonly string[]`
      (`src/interface-adapters/http/typed.ts`); el handler de ingesta declara
      `CONSUMER_CAPABILITIES.sdk`
- [x] T008 [US4] `src/interface-adapters/http/security/platform-key.ts`: `PLATFORM_KEY_HEADER =
"x-ope-platform-key"`, `PLATFORM_KEY_SCHEME = "platformKey"`, `makePlatformKeySecurity(resolver)`
      (401 `unauthorized` sin clave o desconocida; principal `{ merchant }`; `capabilities:
CONSUMER_CAPABILITIES.platform`; log `merchantId`); `merchantOf(req)` debe leer el principal
      de cualquiera de los dos esquemas (`security[INGEST_KEY_SCHEME] ?? security[PLATFORM_KEY_SCHEME]`)
- [x] T009 [US4] Verificación genérica de capacidades en `src/infrastructure/http/build-server.ts`
      (`registerSecurity`): leer `c.operation["x-required-capabilities"]` como `unknown` →
      `string[]`, ejecutar el handler y, si alguna falta en `outcome.capabilities`, lanzar
      `SecurityError("capability-missing")`; `capability-missing` (403) en
      `contracts/problem-types.yaml` y `PROBLEM_TYPES`; prueba en
      `tests/integration/server.test.ts` con un contrato de fixture (`tests/integration/fixtures/`)
      cuya operación exige una capacidad que el handler de prueba no otorga → 403 con el tipo
- [x] T010 [US4] Headers desde el cableado: `SecurityScheme { handler; header }` en
      `src/interface-adapters/http/typed.ts`; `ModuleWiring.security: Record<string, SecurityScheme>`
      y `Wired.credentialHeaders: readonly string[]` en `src/composition/wiring.ts`;
      `src/composition/modules/merchant.ts` registra `ingestKey` **y** `platformKey` con sus
      headers; `buildServer({ …, credentialHeaders })`; `registerCors(app, policy, allowedHeaders)`
      en `src/infrastructure/http/cors.ts` (sin import del handler); `privateLogger(base,
credentialHeaders)` aplicado en `createApp` de `build-server.ts` y **quitado** de
      `src/infrastructure/logging/pino-logger.ts` (que conserva serializers); `request-logging.ts`
      sin import del handler; adaptar `tests/unit/composition/wiring.test.ts`,
      `tests/integration/server.test.ts`, `tests/integration/cors.test.ts` sólo en la
      construcción (aserciones intactas); prueba de que un request con `X-OPE-Platform-Key`
      queda redactado en el log
- [x] T011 [US4] `tests/integration/security-capabilities.test.ts`: clave de ingesta de A en
      `X-OPE-Platform-Key` → 401; clave de plataforma de A en `X-OPE-Ingest-Key` contra
      `/v1/events` → 401; merchant sin `platformKeys` arranca; logs sin la clave. (El 403 por
      capacidad se prueba en T009; en el contrato real las reglas del mapa impiden el desajuste.)
      Hasta T020 no hay operación con `platformKey`: esta prueba se completa en la fase 3 con
      `/v1/catalog`
- [x] T012 [US4] ADR-020: precisión "platformKey DECIDIDO (2026-09-18, feature 010)" y cierre
      del PROPUESTO de headers (borrar el marcador); `npm run quality && npm test` en verde;
      commit `feat(security): credencial de plataforma, capacidades por consumidor y headers de
credencial desde el cableado (ADR-025)`

**Checkpoint**: dos esquemas cableados, capacidades verificadas, suite verde, sin operación
nueva todavía.

---

## Phase 3: US1 + US4 — Contrato y módulo `catalog` (Priority: P1) 🎯 MVP

**Goal**: `PUT /v1/catalog` construido de punta a punta con el aggregate `CatalogSnapshot`.

**Independent Test**: `tests/integration/catalog.test.ts` verde; `contract:check` con el mapa
en 4 built; Schemathesis verde.

- [x] T013 [P] [US1] Glosario en `docs/dominio/`: `catalogo.md` (snapshot), `disponibilidad.md`,
      `precio.md`, `frescura.md`, `perfil-de-datos.md` con fuente (`mvp:01-arquitectura-mvp.md#4.3`,
      `#8`, `#14.1`; `mvp:02-integracion-ecommerce.md#4`), `uso: disponible`; `producto.md` y
      `variante.md` ganan su uso en catálogo; `_tecnicos.json` si `CatalogSummary`/`CatalogSnapshot`
      lo requieren; `npm run check:glossary` en verde
- [x] T014 [US1] Contrato: copiar `specs/010-catalogo-y-stock/contracts/paths/catalog.yaml` a
      `contracts/paths/catalog.yaml`, los cuatro schemas a `contracts/components/schemas/`,
      crear `contracts/components/responses/CatalogUnprocessable.yaml` (422 con ejemplos que
      nombran las cuatro invariantes) y `contracts/examples/catalog-snapshot.yaml` +
      `catalog-summary.yaml`; `contracts/openapi.yaml` gana `/v1/catalog`, el tag `outcomes`
      y `platformKey` en `components.securitySchemes`; `contracts/problem-types.yaml` gana los
      cuatro tipos de invariante; `contracts/api-map.yaml`: `upsertCatalogSnapshot` → `built`;
      `npm run contract:check` en verde (lint, bundle, diff compatible, mapa) y `npm run
contract:types`
- [x] T015 [P] [US1] Dominio `src/domain/catalog/`: `ids.ts` (`ProductId`, `VariantId`,
      `asProductId`, `asVariantId`), `errors.ts` (`CatalogDuplicateProductId`,
      `CatalogDuplicateVariantId`, `CatalogCapturedInFuture`, `CatalogOutOfOrder`; `module =
"catalog"`; unión `CatalogError`), `catalog-snapshot.ts` (`Product`, `Variant`, `Attribute`,
      `CatalogSnapshotRecord`, `class CatalogSnapshot { of; rehydrate; product; variant; counts;
ageAt; merchantId; capturedAt; receivedAt }` con `CAPTURE_TOLERANCE_MS = minutes(5)`
      exportado), `index.ts`; `CONTEXT_MAP.catalog = ["shared-kernel"]` en `.dependency-cruiser.cjs`;
      `tests/unit/domain/catalog/catalog-snapshot.test.ts` con `[invariant:catalog-duplicate-product-id]`,
      `[invariant:catalog-duplicate-variant-id]`, `[invariant:catalog-captured-in-future]`,
      `rehydrate`, `product`/`variant`/`counts`/`ageAt` (edad 0 si `capturedAt` > `now`)
- [x] T016 [P] [US1] Aplicación `src/application/catalog/`: `ports/catalog-store.ts`
      (`CatalogStore { current; replace; receipts }`, todo `Promise`), `policies/freshness.ts`
      (`FRESHNESS_BUDGET`), `policies/sync-level.ts` (`observedSyncLevel(receipts, now)` con
      `RECEIPTS_KEPT = 8`), `use-cases/upsert-catalog-snapshot.use-case.ts`
      (`UpsertCatalogSnapshotUseCase`; deps `{ clock, store, logger }`; request `{ merchantId,
capturedAt, products: CatalogProductInput[] }` con precios ya como `Money`; response
      `Result<CatalogSummary, CatalogError>`; `[invariant:catalog-out-of-order]` cuando
      `capturedAt` < vigente; idempotente si igual), `index.ts`;
      `tests/unit/application/catalog/{sync-level,upsert-catalog-snapshot.use-case}.test.ts`
- [x] T017 [P] [US1] Gateway `src/interface-adapters/gateways/catalog/memory-catalog-store.ts`
      (`Map<MerchantId, { snapshot; receipts: Date[] }>`, conserva las últimas 8 recepciones);
      `tests/unit/gateways/memory-catalog-store.test.ts` (aislamiento por merchant, recepciones
      acotadas)
- [x] T018 [US1] Controller `src/interface-adapters/http/controllers/catalog/upsert-catalog-snapshot.ts`
      tipado `OperationHandler<"upsertCatalogSnapshot">`: `merchantOf(req)`, `instantOf(capturedAt)`,
      DTO → `CatalogProductInput[]` (`Money.rehydrate` por precio, `asProductId`/`asVariantId`),
      `toProblem` en fallo, `200` con `CatalogSummary`
- [x] T019 [US1] Composición: `src/composition/modules/catalog.ts` (`CatalogPorts { clock;
logger; catalog: CatalogStore }`, `memoryCatalogPorts`, `catalogModule` con el caso de uso
      envuelto en `LoggedUseCase("upsertCatalogSnapshot")` y el handler), `modules/index.ts`
      (`MODULES`), `ports.ts`, `profiles/local.ts`; `bodyLimit: 32 MiB` en `createApp`
      (`build-server.ts`) con constante nombrada; `bootstrap` arranca con las 4 operaciones
      servidas
- [x] T020 [US1] `tests/integration/catalog.test.ts`: 200 con resumen exacto; verdad consultable
      tras el upsert (vía `app.ports.catalog`); reemplazo completo (segundo snapshot con menos
      productos); idempotencia (mismo snapshot dos veces → mismo estado, resumen igual salvo
      `receivedAt`); snapshot vacío aceptado; 422 por cada invariante con `type` correcto y
      vigente intacto; 401 sin credencial y con clave de ingesta; 403 sólo por fixture (T009);
      completar `tests/integration/security-capabilities.test.ts` con `/v1/catalog`
- [x] T021 [US1] `npm run contract:check && npm run quality && npm test && npm run
test:contract` en verde; commit `feat(catalog): snapshot del catálogo por la plataforma con
invariantes por construcción (ADR-025)`

---

## Phase 4: US2 — Verdad de producto (Priority: P1)

- [x] T022 [US2] `src/application/catalog/services/product-truth.service.ts`:
      `ProductTruth` (unión `known`/`unknown`), `ProductTruthService { lookup(merchantId,
productId, variantId); syncLevel(merchantId) }`, `DefaultProductTruthService` (deps `{ clock,
store }`) con frescura por clase (`FRESHNESS_BUDGET`); exportar por el índice; bind en
      `modules/catalog.ts` como servicio (`productTruthOf(ports)`), aún sin consumidor en `src/`
      (lo consume la 011): `knip` lo verá usado por las pruebas y la composición
- [x] T023 [US2] `tests/unit/application/catalog/product-truth.service.test.ts`: `known` fresco
      a los 5 min; stock/precio `stale` a las 2 h con catálogo fresco; `unknown/stale` a los 3
      días; `absent`; `unknown-product`; `unknown-variant`; `available: false` intacto;
      `syncLevel` delegando a `observedSyncLevel`
- [x] T024 [US2] `npm run quality && npm test` en verde; commit `feat(catalog): verdad de
producto con frescura por clase para el plano de decisión (ADR-025)`

---

## Phase 5: US3 — Nivel observado (Priority: P2)

- [x] T025 [US3] `tests/unit/application/catalog/sync-level.test.ts` (si no quedó completo en
      T016): sin recepciones → 0; cada 5 min durante 1 h → 2; diario tres días → 1; nivel 2 y 6
      h sin snapshot → 1; 48 h → 0; nunca 3; mediana con recepciones irregulares
- [x] T026 [US3] `tests/integration/catalog.test.ts`: `observedSyncLevel` en el resumen: 1 en el
      primer upsert; 2 tras tres upserts a 5 min con reloj controlado

---

## Phase 6: Aislamiento, tamaño y cierre

- [x] T027 [P] `tests/integration/isolation.test.ts`: snapshot de A invisible para B (`unknown/absent`
      desde `ProductTruthService` de B y `current` del store); mismo `productId` en A y B
      con precios distintos → cada uno ve el suyo; la clave de plataforma de B no reemplaza el
      catálogo de A
- [x] T028 [P] `tests/integration/catalog-size.test.ts`: 5 000 productos × 10 variantes en
      una operación; reporta el tiempo por `console.info`; falla si > 2 s (SC-004, informativo)
- [x] T029 `npm run test:mutation`; matar supervivientes con aserciones
- [x] T030 [P] `docs/adr/025-catalogo-y-verdad-de-producto.md` → `aceptada`; CLAUDE.md:
      módulo `catalog` en la lista de módulos, "Verdad de producto (ADR-025)" en notas
      operativas, esquema `platformKey` y capacidades en runtime en la sección de contrato, el
      `bodyLimit`; README si describe `OPE_MERCHANTS` (añadir `platformKeys`)
- [x] T031 `specs/010-catalogo-y-stock/quickstart.md`: "Estado al cierre" con fecha y cifras
- [ ] T032 Commit `chore(010): ADR-025 aceptada, guía de agentes y cierre de la feature`;
      `npm run release-check` en verde; PR a `main`; esperar **los dos** runs de CI (`push` y
      `pull_request`); merge

---

## Dependencies & Execution Order

- Phase 2: T002–T003 en paralelo → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 →
  T012 (un commit).
- Phase 3: T013 en paralelo con T015–T017; T014 antes de T018 (tipos generados); T018 → T019 →
  T020 → T021.
- Phase 4 y 5 después de Phase 3; Phase 6 al final.

## Implementation Strategy

1. **MVP = Phase 2 + Phase 3**: credencial de plataforma y `PUT /v1/catalog` de punta a punta.
2. Phase 4 entrega lo que la 011 consume; Phase 5 completa la medición del perfil.
3. Un commit por fase, siempre con `quality` y `test` en verde; `contract:check` verde antes
   de cualquier código que dependa de los tipos generados.

## Notes

- Todo `code` nuevo entra en `contracts/problem-types.yaml` (réplica de la 008).
- Las notas de glosario van **antes** del contrato (ADR-008): `check:glossary` corre dentro
  de `contract:check`.
- El controller de ingesta sólo cambia en cómo construye `price` (T003).
