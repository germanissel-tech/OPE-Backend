---
description: "Task list for feature 044 — el puerto de plataforma"
---

# Tasks: El puerto de plataforma

**Input**: `specs/044-el-puerto-de-plataforma/` (spec.md, plan.md, research.md, data-model.md,
contracts/puerto.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.1, sin enmiendas); research.md con los doce
hallazgos; las decisiones del dueño del 2026-10-10 (`subscribe` sólo en órdenes y devoluciones, un modo que nada
ejecuta no se publica, cada refresco cuenta como recepción).

**Tests**: sí, y preceden a la implementación en cada fase.

**Organization**: por **tramo** del plan, cada uno un commit que se puede correr. Una salvedad del orden de
`contrato.md`: `bootstrap.ts` se niega a arrancar si el contrato declara una operación que ningún módulo sirve, así
que **cada operación entra al contrato en el tramo que la sirve**; el mapa las tiene `planned` desde el primero.
Historias: US1 `pull` de catálogo y de stock y precio, US2 órdenes y devoluciones por `pull`, US3 el aviso, US4 el
refresco empujado, US5 el circuito.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 a US5
- Cada tarea nombra su archivo

---

## Phase 1: Los nombres y la configuración (tramo 1 del plan)

**Purpose**: todo lo que se nombra antes de construir, y los valores nuevos de configuración, sin que nada los use.

- [ ] T001 [P] `docs/dominio/`: `aviso.md` (`notice`), `fuente-de-plataforma.md` (`platform source`),
      `regla-de-confirmacion.md` (`order confirmation`), `refresco-de-stock-y-precio.md`
      (`stock and price refresh`), con fuente (`02` §6, la verificación documental) y estado; `_tecnicos.json` si
      corresponde; `estrategia-de-sincronizacion.md` deja de decir que `pull` y `subscribe` no cambian nada y remite
      a ADR-047
- [ ] T002 [P] `docs/adr/047-el-puerto-de-plataforma.md`, **propuesta**: R-01, R-03, R-04, R-05, R-06 (el
      consumidor `notifier`, que agrega una fila a la tabla de ADR-020), R-08, R-12 (el tag `refresh`); enmienda de
      ADR-025 sobre la frescura por variante; `docs/adr/README.md`
- [ ] T003 `contracts/api-map.yaml`: el consumidor `notifier` (`noticeKey`, tags `[notices]`,
      `[notices:write]`); `platform` gana el tag `refresh`; las cuatro operaciones `planned` con
      `roadmap: platform-port`; `src/interface-adapters/http/security/capabilities.ts` replica el consumidor
- [ ] T004 `contracts/problem-types.yaml`: `sync-mode-not-configured` (409), `stock-captured-in-future` (422),
      `stock-and-price-duplicate-variant-id` (422); `contracts/openapi.yaml` declara los tags `refresh` y `notices`
- [ ] T005 Los valores nuevos en el contrato: `TreatmentDefaultsContent` (requeridos) y
      `MerchantConfigurationDeclared` (opcionales) ganan `platform` (enum `generic | test`), `orderConfirmation`
      (`states`: lista de textos ≤ 64, sin duplicados), `pull` (`catalogEveryMs`, `stockAndPriceEveryMs`,
      `stockAndPriceBatchSize`, `ordersEveryMs`, `returnsEveryMs`, enteros positivos) y `notices`
      (`retryAfterMs`, `maxAttempts`); el contenido de plataforma gana `platformSync.tickMs`. `SyncMode` dice qué
      ejecuta cada modo. `info.version` `1.16.0`. `npm run contract:check` (incompatible, aceptado por
      `building`; guardar el reporte de `contract:diff` para el quickstart) y `npm run contract:types`
- [ ] T006 [P] `tests/unit/domain/configuration/`, **antes del código**: los valores nuevos se resuelven
      defaults ← declarado; enteros no positivos y estados duplicados se rechazan con su ruta;
      `OrderConfirmation.confirms(state)`
- [ ] T007 `src/domain/configuration/`: `OrderConfirmation` (clase con reglas), `PullCadence`, `NoticeRetry`, el
      vocabulario `PLATFORMS`; `TreatmentValues` los gana con su juicio; el nivel de plataforma gana
      `platformSync.tickMs`
- [ ] T008 `config/treatment-defaults.json` y `config/platform.json` con los valores de data-model;
      `config/schemas/` y `generated/schemas/` regenerados; los fixtures de pruebas que publican defaults o
      plataforma completos ganan los campos
- [ ] T009 `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm test`, `npm run test:tools`.
      Commit: `feat(044): los nombres del puerto y los valores de configuración que lo gobiernan`

**Checkpoint**: la configuración acepta y estampa los valores; nada los ejecuta todavía.

---

## Phase 2: El refresco y el modo (tramo 2) — US4, base de US1 🎯

**Goal**: el cuarto caso de uso del puerto, la verdad por variante, y que la entrada por un modo que no rige se
rechace.

**Independent Test**: empujar un refresco firmado de dos variantes y comprobar que cambian sólo esas; configurar
el catálogo en `pull` y comprobar que el `PUT /v1/catalog` da `409`.

- [ ] T010 [P] [US4] `tests/unit/domain/catalog/`, **antes del código**: `StockAndPriceRefresh.of` rechaza ids
      duplicados y un instante futuro más allá de la tolerancia; la verdad de una variante es la del dato más nuevo
      entre foto y refresco; igual instante con otro contenido → gana el guardado
- [ ] T011 [P] [US4] `tests/unit/application/catalog/product-truth.service.test.ts`, **antes del código**: la
      frescura de stock y precio es por variante; una variante sin refresco envejece con la foto; la frescura del
      catálogo sigue siendo la de la foto
- [ ] T012 [US4] `src/domain/catalog/`: `StockAndPriceRefresh`, `StockCapturedInFuture`, la regla del dato más
      nuevo (método del dueño, no función suelta)
- [ ] T013 [US4] `migrations/007-platform-port.sql`: `stock_and_price`, `platform_sync`, `platform_notices` (las
      tres de una vez: la migración es una sola versión), con `merchant_id` en cada clave única;
      `migrations/README.md`
- [ ] T014 [US4] `src/application/catalog/ports/catalog-store.ts`: `refreshes(m)`, `refresh(m, items, kept)` que
      devuelve el resultado por ítem, y `replace` que borra los refrescos superados; gateways en memoria y SQLite
      (`src/interface-adapters/catalog/gateways/`); cada refresco aceptado agrega una recepción (R-05)
- [ ] T015 [US4] `src/application/catalog/services/product-truth.service.ts`: stock y precio del dato más nuevo,
      frescura por variante
- [ ] T016 [US4] `src/application/catalog/use-cases/refresh-stock-and-price.use-case.ts`: `RefreshStockAndPriceUseCase`
      (`applied`, `repeated`, `superseded`, `unknown`)
- [ ] T017 [P] `tests/unit/application/platform/mode-gated.use-case.test.ts`, **antes del código**: con el flujo
      en el modo del decorador, llama al interno; con otro, `SyncModeNotConfigured` sin llamarlo
- [ ] T018 `src/application/platform/`: el módulo (`index.ts`), `SyncModeNotConfigured` en
      `src/domain/platform/errors.ts`, el puerto `SyncStrategies` (`modeOf(merchant, flow)`) y
      `ModeGatedUseCase`; `.dependency-cruiser.cjs` gana `platform` en `CONTEXT_MAP`
- [ ] T019 [US4] El contrato de `refreshStockAndPrice` (`paths/stock-and-price.yaml`, `StockAndPriceRefresh*`,
      ejemplos, `x-invariants`), pasado a `built`; `upsertCatalogSnapshot`, `notifyOrder` y `notifyReturn`
      nombran `sync-mode-not-configured` en su `409`; `contract:check`, `contract:types`
- [ ] T020 [US4] `src/interface-adapters/catalog/controllers/refresh-stock-and-price.ts`; `composition/modules/`
      `catalog.ts` y `platform.ts` (nuevo, con su línea en `deployments/local.ts`): las cuatro del `push` envueltas
      en `ModeGatedUseCase(…, "push")`; `SyncStrategies` enlazado a la configuración efectiva
- [ ] T021 [US4] `tests/integration/stock-and-price.test.ts`: los cuatro resultados; `[invariant:…]` de los dos
      invariantes; el nivel sube con refrescos; `tests/integration/sync-mode.test.ts`: los cuatro `push` con su
      flujo en `pull` → `409`
- [ ] T022 [US4] `tests/integration/isolation.test.ts`: el refresco de A no toca variantes de B, ni con el mismo
      `variantId`
- [ ] T023 [P] [US4] `tests/durability/catalog.test.ts`: los refrescos sobreviven un reinicio, y una foto nueva
      borra los superados
- [ ] T024 Romper a propósito una vez: la frescura con la foto en vez de con la variante; un refresco viejo que
      entra; el decorador olvidado en una operación. `npm test`, `npm run test:durability`, `npm run quality`,
      `npm run test:mutation -- --files` sobre lo nuevo. Commit:
      `feat(044): el refresco parcial de stock y precio, y la entrada sólo por el modo que rige`

**Checkpoint**: el puerto tiene sus cuatro operaciones; el `push` es su adaptador genérico.

---

## Phase 3: El planificador y la fuente de prueba (tramo 3) — US1, US2

**Goal**: un merchant en `pull` tiene catálogo, stock y precio, órdenes y devoluciones sin que su plataforma envíe
nada.

**Independent Test**: con la fuente de prueba guionada, configurar un merchant en `pull` en los cuatro flujos y
llamar a `runDue` con el reloj avanzando; comprobar la verdad de producto, las órdenes confirmadas y la devolución.

- [ ] T025 [P] [US1] `src/interface-adapters/platform/source.ts`: `PlatformSource` (R-02) y lo que declara cada
      fuente (modos por flujo); `src/interface-adapters/platform/test-source/`: la fuente de prueba, guionable en
      memoria y, con un archivo, leída en cada consulta
- [ ] T026 [P] [US1] `tests/unit/application/configuration/`, **antes del código**: publicar con `pull` y
      `generic`, `subscribe` en catálogo o en stock y precio, una fuente no instalada, u órdenes en `pull` o
      `subscribe` sin estados → rechazo con la ruta del valor
- [ ] T027 [US1] `src/application/configuration/`: el puerto `PlatformSources` (instaladas y sus modos) y el juicio
      en `ConfigurationService.judge`; enlazado en la composición a las fuentes instaladas
- [ ] T028 [P] [US1] `tests/unit/interface-adapters/platform/scheduler.test.ts`, **antes del código**, con reloj
      y fuente guionada:
  - respeta la cadencia de cada flujo; salta merchants desactivados o con el interruptor apagado;
  - el lote recorre el catálogo en orden y vuelve al principio (SC-002);
  - no superpone corridas del mismo merchant y flujo;
  - un fallo de la fuente deja `failed` con motivo y no avanza el cursor; el cursor avanza sólo después de
    depositar;
  - el instante de un ítem sin instante es el de la observación.
- [ ] T029 [US1] `src/application/platform/ports/`: `SyncStateStore` (`platform_sync`); gateways en memoria y SQLite
      en `src/interface-adapters/platform/gateways/`
- [ ] T030 [US1] `src/interface-adapters/platform/scheduler/`: `runDue(now)` para catálogo y stock y precio, que
      traduce y llama a los casos de uso envueltos en `ModeGatedUseCase(…, "pull")`; el temporizador con `unref()`
      y `close()` que espera la corrida en curso; cableado en `composition/modules/platform.ts` como `Closable`
- [ ] T031 [US2] El planificador gana órdenes y devoluciones: `orderChanges`/`returnChanges` desde el cursor,
      `OrderConfirmation` de la configuración del merchant, `confirmedAt` de la fuente o de la observación, y los
      casos de uso de órdenes y devoluciones
- [ ] T032 [US1] `GetPlatformSyncUseCase` y el contrato de `getMerchantPlatformSync`
      (`paths/admin-platform-sync.yaml`, `PlatformSync*`), pasado a `built`; controller; `contract:check`,
      `contract:types`
- [ ] T033 [US1] `src/composition/deployments/`: la fuente de prueba instalada siempre en `local.ts`, y en
      `durable.ts` sólo con `OPE_TEST_PLATFORM` (en `config-error.ts`); `package.json` `dev` la fija;
      `config/dev-platform.json`
- [ ] T034 [US2] `tests/integration/platform-pull.test.ts`: sólo los estados confirmados entran; una orden vista
      dos veces se registra una; una que llega a confirmada después entra en esa corrida; la devolución se vincula;
      cambiar los estados por una versión cambia la corrida siguiente
- [ ] T035 [US1] `tests/integration/admin-configuration.test.ts` (el juicio, con la ruta) y
      `tests/integration/admin-platform-sync.test.ts` (por flujo; fuera de alcance, `403`)
- [ ] T036 [US1] `tests/integration/decision-plane.test.ts`: con una fuente que nunca responde y una corrida en
      curso, la decisión responde igual y la fuente no recibe ninguna llamada desde ella (FR-013, SC-005)
- [ ] T037 [US1] `tests/integration/isolation.test.ts`: la corrida de A nunca deposita en B
- [ ] T038 [P] [US1] `tests/durability/platform.test.ts`: el cursor sobrevive un reinicio y el ciclo sigue; un
      reinicio en medio de un lote de órdenes no duplica ninguna
- [ ] T039 Romper a propósito una vez: avanzar el cursor antes de depositar; registrar una orden sin mirar la
      regla. `npm test`, `npm run test:durability`, `npm run quality`, mutación acotada. Commit:
      `feat(044): el planificador trae lo que la plataforma no empuja, con la fuente de prueba`

**Checkpoint**: US1 y US2 andan solas con la fuente de prueba.

---

## Phase 4: El aviso (tramo 4) — US3

**Goal**: la plataforma avisa con su credencial, y OPE lee y registra lo leído.

**Independent Test**: un aviso autenticado de una orden confirmada la registra con el detalle leído; sin
credencial, o con datos que contradicen la lectura, no entra nada del aviso.

- [ ] T040 [P] [US3] `tests/unit/domain/merchant/merchant.test.ts`, **antes del código**: la credencial `notice`
      rota como la de plataforma, dos vigentes, y sube la revisión
- [ ] T041 [US3] `src/domain/merchant/`: `kind: "notice"`; `findByNoticeKey` en el directorio;
      `src/interface-adapters/access/security/notice-key.ts` (concede sólo `notices:write`), el esquema
      `components/securitySchemes/noticeKey.yaml` referenciado desde la raíz
- [ ] T042 [US3] El contrato de `rotateNoticeKey` y su controller, auditado, como `rotatePlatformKey`
- [ ] T043 [P] [US3] `tests/unit/interface-adapters/platform/notices.test.ts`, **antes del código**: el aviso se
      encola una vez mientras está pendiente; al procesarlo lee por la fuente y aplica la regla; si la fuente falla
      reintenta a `retryAfterMs`; agotados los intentos se descarta con rastro
- [ ] T044 [US3] `AcceptNoticeUseCase` (`src/application/platform/`) con el puerto `NoticeQueue`; gateways en
      memoria y SQLite; el contrato de `notifyPlatformChange` (`paths/platform-notices.yaml`, `PlatformNotice*`),
      pasado a `built`; controller; el decorador con `"subscribe"`
- [ ] T045 [US3] El planificador procesa los avisos vencidos en su tick, con `order(reference)` y
      `returns(reference)` de la fuente
- [ ] T046 [US3] `tests/integration/platform-notices.test.ts`: `202` y la orden registrada con lo leído; sin clave,
      con la de plataforma o con la de otro merchant, `401`; repetido, uno; el estado del aviso no gana a la
      lectura; flujo fuera de `subscribe`, `409`; fuente caída, reintento y rastro
- [ ] T047 [US3] `tests/integration/admin-merchants.test.ts` (la rotación; la clave de aviso no sirve para el
      `push`) e `isolation.test.ts` (el aviso con la clave de A nunca lee B)
- [ ] T048 [P] [US3] `tests/durability/platform.test.ts`: un aviso pendiente sobrevive un reinicio y se procesa
- [ ] T049 Romper a propósito una vez: registrar el estado del aviso en vez del leído. `npm test`,
      `npm run test:durability`, `npm run quality`, mutación acotada. Commit:
      `feat(044): el aviso de la plataforma, con su credencial, que obliga a leer`

---

## Phase 5: El circuito y el cierre (tramo 5) — US5

- [ ] T050 [US5] `tests/integration/end-to-end.test.ts`: catálogo y stock y precio por `pull`, evento y decisión
      por el SDK, exposición confirmada, orden por `subscribe` con el `sessionId` de la decisión →
      `ATTRIBUTED_ORDER`; y la misma corrida con la foto empujada y la orden consultada da lo mismo
- [ ] T051 `npm run test:contract` con `OPE_STORE=:memory:`; `schemathesis.toml` si las operaciones nuevas lo
      piden
- [ ] T052 El `quickstart.md` a mano contra `npm run dev`; «Lo corrido» fechado, con el reporte de
      `contract:diff`
- [ ] T053 [P] ADR-047 **aceptada**; `docs/dominio/` con `uso` actualizado; `contracts/README.md` (el consumidor y
      los tags); `.claude/rules/contrato.md` (la línea del puerto dice que `pull` y `subscribe` están construidos);
      `docs/adr/025-…` remite a ADR-047
- [ ] T054 [P] `spec.md`: **Status** construida; `tasks.md` con lo hecho y los desvíos
- [ ] T055 La cadena entera: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm run test:all`,
      `npm run contract:check`, `npm run test:mutation`, `npm run release-check`. Commit:
      `docs(044): cierre — el puerto construido`. Push y PR

---

## Dependencies & Execution Order

```text
Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5
```

- Fase 2 depende del vocabulario y de los problemas de la 1; el decorador (T018) antes de todo cableado.
- Fase 3: T025 y T027 antes del planificador; T029 antes de T030; T031 después de T030.
- Fase 4 usa el planificador de la 3 para procesar la cola.
- Las pruebas marcadas «antes del código» fallan primero.

## Parallel Example

```text
Fase 2: T010, T011 y T017 juntas (archivos distintos); después T012 → T014 → T015 → T016.
Fase 3: T025, T026 y T028 juntas.
```

## Implementation Strategy

MVP del hito = fases 1 a 3: con el refresco y el `pull`, un merchant de Magento 2 ya tiene a dónde conectarse
cuando llegue su fuente. La fase 4 reduce la latencia de las órdenes donde la plataforma avisa; la 5 cierra con la
prueba que la constitución pide.
