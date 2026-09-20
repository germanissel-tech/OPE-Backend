# Tasks: Alineación con los documentos base del MVP (016)

**Input**: Design documents from `/specs/016-alineacion-docs-base/`

**Prerequisites**: plan.md, spec.md, research.md (R-01..R-08), data-model.md, contracts/, quickstart.md

**Tests**: la spec exige pruebas para las tres piezas de código (FR-011, FR-012, FR-013) y gates en verde por historia (FR-030); las tareas de prueba preceden a las de implementación en la historia 2.

**Organization**: por historia (US1 gobernanza del repo, US2 contrato v2 + `locale` + gate, US3 base) y una fase de cierre.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencia con tareas incompletas)
- **[Story]**: US1, US2, US3

## Path Conventions

Repo en la raíz (`src/`, `tests/`, `contracts/`, `docs/`, `scripts/`); documentos base en `../` (fuera del repo).

---

## Phase 1: Setup

- [ ] T001 Confirmar el estado inicial: `git merge-base origin/main HEAD` = `c9a333d`; `npm run contract:check`, `npm test` y `npm run check:identifiers` (aún inexistente: falla por script ausente, esperado) — anotar la línea base en `specs/016-alineacion-docs-base/quickstart.md` § "Cambios respecto del plan"
- [ ] T002 [P] Leer entera `docs/auditoria/2026-09-20-evaluacion-docs-base-vs-repo.md` §2, §2.2, §5; tenerla como fuente de cada tarea (cada edición cita su decisión)

---

## Phase 2: Foundational

Ninguna: las tres historias son independientes entre sí; US3 depende de los textos de US1/US2 sólo como referencia, no como código.

---

## Phase 3: User Story 1 — Gobernanza del repo alineada (Priority: P1) 🎯 MVP

**Goal**: constitución 1.4.0, ADR-025 revisado, ADR de decisiones de producto, ADR-010 corregido, roadmap 016–022 reordenado con descripciones, glosario (evaluación decisiones 1, 2, 4, 5, 6, 8, 11, 12).

**Independent Test**: quickstart § US1; `contract:check` en verde.

- [ ] T010 [US1] `.specify/memory/constitution.md`: Sync Impact Report 1.3.0 → 1.4.0 (MINOR por XI; PATCH acumulado de barreras; nota de VII condicionada a US3); `### XI. Ninguna política vive en el código` con el texto íntegro de la evaluación §2.2 tras X; "Contrato de datos e identidad" → barreras `fit` (talle y calce), `price` (precio y valor), `returns` (cambios y devoluciones); pie `**Version**: 1.4.0 | … | **Last Amended**: 2026-09-20` (R-01, `contracts/governance-docs.md`)
- [ ] T011 [P] [US1] `docs/adr/025-catalogo-y-verdad-de-producto.md`: sección "Consecuencias" y "Deuda declarada frente a la constitución X" reescritas — push es un modo de la estrategia de sincronización por merchant y por flujo (push / pull / subscribe), negociada; adaptadores en OPE; puerto único para los cuatro flujos; el modo es configuración congelada; lo construido sigue vigente; cita la evaluación y la feature del puerto por nombre (R-02)
- [ ] T012 [P] [US1] `docs/adr/030-decisiones-de-producto-confirmadas.md` (nuevo; frontmatter `numero: 30`, `estado: aceptada`, `fecha: 2026-09-20`, `fuente: ../04-hoja-de-decisiones.md`): tabla D-B, D-C, D-E, D-F, D-G con propuesta, consecuencia en el repo y "confirmada por el dueño el 2026-09-20"; `docs/adr/README.md` si lista los ADR (R-02)
- [ ] T013 [P] [US1] `docs/adr/010-decisiones-abiertas-del-mvp.md`: "cada una se cierra en `01 §13` de los documentos del MVP"; párrafo con las decisiones de producto confirmadas citando ADR-030; estado sigue `abierta` (R-02)
- [ ] T014 [US1] `contracts/api-map.yaml`: `features:` con `"016": Alignment with the MVP base documents` y las reservadas renumeradas y reordenadas — `"017"` Configuration, flags, kill switch and administration (tres niveles de configuración, idiomas del merchant, congelamiento y versión estampada); `"018"` Persistence and resilience (registro desacoplado de la latencia del ledger; lecturas con canal de fallo; separación del plano; atomicidad del presupuesto por sesión); `"019"` Platform port, per-flow sync strategy and adapters (push/pull/subscribe por flujo, refresco parcial de stock/precio, planificador y consumidor fuera del camino de decisión, adaptador Magento 2 y de prueba; verificación documental de Magento 2 y VTEX antes); `"020"` Message catalogue (por idioma, `message-unavailable`); `"021"` ITT analysis and merchant portal (`NOT_AVAILABLE`); `"022"` Observability and end-to-end; `operations.*.feature` 016→017, 017→020, 018→021 (16 operaciones); `npm run check:api-map` verde (R-03, data-model § Roadmap)
- [ ] T015 [P] [US1] Glosario: `docs/dominio/estrategia-de-sincronizacion.md` (fuente `mvp:02-integracion-ecommerce.md#6`; tres modos por flujo, negociada, adaptadores en OPE) y `docs/dominio/locale.md` (fuente `mvp:01-arquitectura-mvp.md#3.1.1`; idioma de la página, BCP 47, contexto no personal); actualizar `orden-verificada.md`, `orden-atribuida.md`, `correlacion-pendiente.md` a los dos ejes `status`/`correlation` (data-model § Cadena); `README.md` del glosario si indexa; `npm run check:glossary` verde (R-04, R-05)
- [ ] T016 [US1] `CLAUDE.md`: § Notas operativas "Puerto de plataforma" pasa de deuda declarada a "estrategia por flujo con tres modos; push construido; feature del puerto"; § Convenciones cita XI en una línea; `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run release-check` en verde; commit `docs(016): gobernanza alineada — constitución 1.4.0, ADR-025, ADR-030, roadmap y glosario`

**Checkpoint**: la gobernanza del repo dice lo decidido; `contract:check` verde.

---

## Phase 4: User Story 2 — Contrato v2, `locale` y gate de identificadores (Priority: P2)

**Goal**: `status` + `correlation` según `01 §5` con versión mayor `/v2/`; `locale` en `PageContext` hasta el registro de la decisión; `check:identifiers` en `contract:check` (decisiones 7, 9, 12).

**Independent Test**: quickstart § US2.

### Contrato (antes que el código, constitución VI)

- [ ] T020 [US2] `contracts/components/schemas/OrderStatus.yaml` → enum `[VERIFIED_ORDER, ATTRIBUTED_ORDER, RETURNED]` con la descripción de `contracts/contract-v2.md`; `contracts/components/schemas/Correlation.yaml` (nuevo, `[PENDING_CORRELATION, ATTRIBUTED]`); `OrderResult.yaml` y `ReturnResult.yaml` con `correlation` requerido y sin `orderStatus`; ejemplos de `contracts/paths/orders.yaml` y `contracts/paths/returns.yaml` con el vocabulario nuevo (R-04)
- [ ] T021 [P] [US2] `contracts/components/schemas/PageContext.yaml`: `locale` opcional, patrón `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`, `maxLength: 35`, descripción de `contracts/contract-v2.md` (R-05)
- [ ] T022 [US2] Versión mayor: `contracts/openapi.yaml` `info.version: 2.0.0`; todas las rutas `/v1/` → `/v2/` en `contracts/openapi.yaml`, `contracts/paths/*.yaml`, `contracts/components/responses/*.yaml` (ejemplos `instance`), `contracts/api-map.yaml`; `npm run contract:lint && npm run contract:bundle && npm run contract:diff` → "Expected incompatible change: major version 1 → 2"; `npm run contract:types` regenera `src/interface-adapters/http/generated/api.d.ts` (ADR-003; R-04)

### Pruebas primero

- [ ] T023 [P] [US2] `tests/unit/domain/outcomes/order.test.ts`: `status()` devuelve `VERIFIED_ORDER` sin correlación, `ATTRIBUTED_ORDER` con ella, `RETURNED` tras `withReturn` (conservando la correlación); `correlationStatus()` `PENDING_CORRELATION` / `ATTRIBUTED`; `tests/unit/application/outcomes/notify-order.test.ts` y `notify-return.test.ts` si afirman el status
- [ ] T024 [P] [US2] `tests/integration/orders.test.ts`, `order-corroborations.test.ts`, `returns.test.ts`, `isolation.test.ts`, `platform-signature.test.ts`: respuestas con `status` + `correlation` (sin `orderStatus`); una orden repetida ya devuelta → `RETURNED`; rutas `/v2/`
- [ ] T025 [P] [US2] `tests/integration/ingest-events.test.ts`: lote con `page.locale: "es-AR"` → 202 y la decisión registrada lleva `locale: "es-AR"` (`app.ports.decisions.find`); `locale: "not a tag!"` → 400 `validation-failed` con `pointer` al campo; sin `locale` → como hoy; `tests/unit/domain/ingestion/event-batch.test.ts`: `focus()` expone `locale` del producto en foco
- [ ] T026 [P] [US2] `tests/governance/identifiers.test.ts` + fixtures `tests/governance/fixtures/identifiers/{ok,unknown,allowlist-without-reason}/` (docs mínimos, contrato mínimo, `src` mínimo, allowlist): pasa en `ok`; falla en `unknown` nombrando `archivo:línea: identificador`; falla en `allowlist-without-reason` con su mensaje; los spans no-identificador (`/ruta`, `npm run x`, `a.b`, `--flag`) se ignoran (`contracts/check-identifiers.md`)
- [ ] T027 [P] [US2] Rutas `/v2/` en el resto de las pruebas y scripts que las escriben: `tests/integration/{bootstrap,catalog,confirm-exposure,cors,ingest-key,ingest-latency,ledger-unavailable,logging-privacy,outcomes-latency,server}.test.ts`, `tests/unit/{application/system/get-service-health,composition/wiring,contract-insomnia,http/instant-guard,http/to-problem,infrastructure/load-contract,infrastructure/pino-logger,problem-details}.test.ts`, `tests/types/{client,result}.test-d.ts`, `scripts/{load-test,server-lib}.mjs`; los fixtures de `tests/contract-rules` y `tests/contract-diff` **no** cambian (R-04)

### Implementación

- [ ] T028 [US2] `src/domain/outcomes/order.ts`: `OrderStatus = "VERIFIED_ORDER" | "ATTRIBUTED_ORDER" | "RETURNED"`, `CorrelationStatus = "PENDING_CORRELATION" | "ATTRIBUTED"`, `status()` (devuelta ⇒ `RETURNED`), `correlationStatus()`; `src/domain/outcomes/index.ts` exporta; comentarios de cabecera con la cadena
- [ ] T029 [US2] `src/interface-adapters/http/controllers/outcomes/{notify-order,notify-return}.ts`: DTO con `status` + `correlation`; `notify-return` sin `orderStatus`
- [ ] T030 [P] [US2] `src/domain/ingestion/event.ts` `PageContext.locale?: string`; `src/domain/ingestion/event-batch.ts` `ProductFocus.locale?`; `src/domain/ledger/decision.ts` `DecisionRecord.locale?` (y `DecisionBase`); `src/application/decision/services/decision.service.ts` copia el `locale` del foco al registro; `src/interface-adapters/http/controllers/ingestion/ingest-events.ts` traduce el DTO (R-05)
- [ ] T031 [P] [US2] `scripts/check-identifiers.mjs` (JSDoc, `checkJs`; `parseArgs`, `walkFiles` de `governance-lib`) + `scripts/identifiers-allowlist.json` con las exclusiones necesarias y su `reason` (marcadores `DECIDIDO`/`PROPUESTO`/`ABIERTO`, estados `BUILT`/`CONNECTED`/`ACTIVE`/`TESTED`, nombres de la versión reemplazada en ADR reemplazados); `package.json` `"check:identifiers"` y en `contract:check` tras `check:glossary`; `CLAUDE.md` § Comandos fila nueva y "Los cinco `check:*`" → seis (R-06)
- [ ] T032 [US2] Correr `npm run check:identifiers` sobre el repo; corregir los documentos que citen identificadores inexistentes (documento, no allowlist, salvo los casos con motivo); `Identifiers: N cited, 0 unknown`
- [ ] T033 [US2] `CLAUDE.md`, `docs/dominio/*.md`, `docs/adr/{014,025}-*.md`, `scripts/sign-platform-request.mjs` y `README.md` del repo si citan `/v1/`: `/v2/`; `docs/api/` regenerado (`contract:docs`, `contract:insomnia`) si está versionado
- [ ] T034 [US2] `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check` en verde; `test:mutation -- --files` para iterar; commit `feat(016): contrato v2 — cadena de evidencia, locale y check:identifiers`

**Checkpoint**: el contrato publica la cadena de `01 §5`; `locale` se registra; el gate vigila los documentos.

---

## Phase 5: User Story 3 — Los documentos base al día (Priority: P3)

**Goal**: `README`, `01`, `02`, `03`, `04` y los diagramas dicen lo decidido (decisiones 3, 10, 11 y el reflejo de 1, 2, 4, 6, 8, 9).

**Independent Test**: quickstart § US3.

- [ ] T040 [US3] Pedir la autorización de la carpeta `../` (o `--add-dir ..`); si se niega, anotar la historia como pendiente en el quickstart y saltar a la Phase 6 (R-07)
- [ ] T041 [P] [US3] `../README.md`: estado con fecha 2026-09-20 (D1/D2 cerradas en la constitución; features construidas y planificadas → mapa del contrato del repo, sin cifras); V1–V6 con estado (V2/V5/V6 pendientes; V1/V4 parcialmente cubiertos por la verificación documental previa a la feature del puerto; V3 por merchant); "Lo próximo" actualizado
- [ ] T042 [P] [US3] `../01-arquitectura-mvp.md`: §3.1.1 `PageContext` gana `locale`; §3.2/§9 nota `DECIDIDO 2026-09-20`: memoria durante la construcción, garantías de durabilidad con la feature de persistencia; §4.4 "curados, versionados y por idioma"; §10.3 siete campos con la frase del incentivo (cierra la nota de VII en la constitución: actualizar el Sync Impact de T010); §14.1 nivel 3 "alcanzable con suscripción, sin valor adicional para los claims del MVP"; §14.2 flag "idiomas del merchant"; sin renumerar secciones
- [ ] T043 [P] [US3] `../02-integracion-ecommerce.md`: §4 y §6 estrategia por merchant y por flujo con tres modos (tabla de la evaluación §2.1), push como el genérico ya construido (§6.2), subscribe sólo reduce fricción si la plataforma publica eventos; §6.3 sin cambio (la huella inevitable)
- [ ] T044 [P] [US3] `../03-alcance-mvp.md`: §4.13 adaptador de prueba y verificación documental "Entra — con la feature del puerto"; §6 las cinco decisiones "confirmadas el 2026-09-20"; `../04-hoja-de-decisiones.md`: casillas "☒ Confirmo" con fecha en D-E, D-F, D-B, D-C, D-G
- [ ] T045 [P] [US3] `../diagramas/ope-mvp.architecture.json`, `ope-mvp-zonas.architecture.json`, `ope-mvp-secuencia.sequence.json`: adaptadores con tres modos, "clave de ingesta" / "clave de plataforma + firma" en vez de "token", persistencia marcada como feature, `locale` en el contexto de página; compilar con `archify` (`npx archify …` o la ruta del `README` de la base) y regenerar los HTML, o anotar en el quickstart que queda pendiente
- [ ] T046 [US3] `npm run check:glossary` (las fuentes `mvp:` siguen resolviendo) y `npm run release-check` en verde; commit `docs(016): documentos base del MVP al día` (los archivos de `../` no entran al commit del repo: anotar en el quickstart qué se editó y su fecha)

**Checkpoint**: las tres historias verificables por separado.

---

## Phase 6: Cierre

- [ ] T050 `specs/016-alineacion-docs-base/quickstart.md` § "Cambios respecto del plan" completo (decisiones tomadas en el camino, ruido del gate de identificadores y cómo se resolvió, estado de la base y los diagramas)
- [ ] T051 SC-002: releer la evaluación §2 contra los documentos editados de los dos lados; anotar el resultado en el quickstart; `docs/auditoria/2026-09-20-evaluacion-docs-base-vs-repo.md` gana una línea de estado al pie ("aplicada por la feature 016, commits …")
- [ ] T052 `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation && npm run test:contract && npm run release-check`; commit `docs(016): cierre`; PR `016-alineacion-docs-base` → `main` con el Constitution Check (once principios) y SC-001..SC-006; sin merge hasta que el dueño lo pida

---

## Dependencies & Execution Order

- US1, US2 y US3 son independientes; el orden P1 → P2 → P3 es el de commits.
- Dentro de US1: T010 antes que T016 (CLAUDE.md cita XI); T014 antes de que cualquier prosa nombre features.
- Dentro de US2: T020–T022 (contrato) antes de T023–T027 (pruebas) y de T028–T033 (código); T031 antes de T032; T034 al final.
- US3: T040 primero; T042 cierra la nota de VII de T010 (mismo Sync Impact).

## Parallel Opportunities

- US1: T011, T012, T013, T015 en paralelo tras T010.
- US2: T021 con T020; T023–T027 en paralelo; T030 y T031 en paralelo con T028–T029.
- US3: T041–T045 en paralelo tras T040.

## Implementation Strategy

MVP = US1 (la gobernanza dice lo decidido). US2 agrega el contrato y el gate; US3 la base. Cada historia deja los gates en verde y un commit.
