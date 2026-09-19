# Tasks: Corrección de los hallazgos de la auditoría integral (014)

**Input**: Design documents from `/specs/015-correcciones-auditoria/`

**Prerequisites**: plan.md, spec.md, research.md (R-01..R-14), data-model.md, contracts/, quickstart.md

**Tests**: cada hallazgo entra con la prueba que el informe propone (FR-002); las tareas de
prueba van antes que su implementación dentro de cada historia.

**Organization**: por historia de la spec (US1 decisiones escritas → US2 reglas y seguridad →
US3 gates y conocimiento único → US4 legibilidad → cierre). Cada tarea nombra el `F-NNN` que
cierra; el estado de cierre se escribe en la fase final (R-14), no por tarea.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencia pendiente)
- **[Story]**: US1..US4 según spec.md
- Rutas exactas en cada descripción

## Path Conventions

Proyecto único: `src/`, `tests/`, `contracts/`, `docs/`, `.specify/`, `scripts/` en la raíz.

---

## Phase 1: Setup

**Purpose**: rama, lectura del informe y del método de cierre, y el campo `closure`.

- [x] T001 Confirmar rama `015-correcciones-auditoria` desde `main` con `add07f7` (PR #23) en su historia; `npm ci`; `npm run quality && npm run typecheck && npm test` en verde como línea base; anotar la duración de `npm test` (referencia SC-005) en `specs/015-correcciones-auditoria/quickstart.md` § "Cambios respecto del plan"
- [x] T002 Leer `docs/auditoria/2026-09-19-informe-auditoria-integral.md` §3 y §5, y `docs/auditoria/trabajo/hallazgos/fase-{1..4}.json`; extraer la lista de los 52 hallazgos en alcance con `file:line` y `after` a `specs/015-correcciones-auditoria/hallazgos-en-alcance.md` (una fila por F-NNN: historia, archivo, prueba propuesta)
- [x] T003 [P] Agregar el campo opcional `closure { status: resolved|absorbed-by|rejected, by, feature }` a `.claude/skills/auditing-architecture/scripts/audit-finding.schema.json` y documentarlo en `.claude/skills/auditing-architecture/references/formato-hallazgo.md`; caso en `tests/audit/audit.test.ts` que acepta un hallazgo con `closure` y rechaza un `status` de cierre fuera del catálogo (R-14)

---

## Phase 2: Foundational

**Purpose**: primitivas del shared-kernel y entradas del catálogo de problemas que US1, US2 y US3 comparten.

**⚠️ CRITICAL**: US1 (tasas), US2 (Merchant, 413, 503) y US3 (predicados, tolerancia) importan de aquí.

- [x] T004 [P] Crear `src/domain/shared-kernel/rate.ts` con `isRate` e `isCount` y `src/domain/shared-kernel/compare.ts` con `constantTimeEquals` (sin salida temprana); exportar desde `src/domain/shared-kernel/index.ts`; agregar `shared-kernel/rate.ts` y `shared-kernel/compare.ts` a `DEFAULT_ALLOW` de `scripts/lint/domain-no-loose-functions.mjs` con su fixture en `tests/lint/fixtures/as-src/domain/demo/` (R-06, R-08)
- [x] T005 [P] Pruebas `tests/unit/domain/shared-kernel/rate.test.ts` (tabla: NaN, ±Infinity, −0, 1.0000001, 0, 1) y `tests/unit/domain/shared-kernel/compare.test.ts` (iguales, distinta longitud, mismo prefijo largo, cadena vacía)
- [x] T006 [P] Agregar `CLOCK_SKEW_TOLERANCE_MS = minutes(5)` a `src/domain/shared-kernel/time.ts` con prueba en `tests/unit/domain/shared-kernel/time.test.ts` (F-048)
- [x] T007 [P] Agregar a `contracts/problem-types.yaml` los tipos `invalid-ingest-keys`, `invalid-origins`, `invalid-platform-keys`, `invalid-platform-secrets`, `multiple-active-experiments`, `duplicate-experiment-id` (422) y `payload-too-large` (413) con título; replicar en `src/interface-adapters/http/problem-details.ts`; `npm run contract:check` y `tests/unit/problem-details.test.ts` en verde (contracts/catalog-503.md)

**Checkpoint**: `npm run quality && npm run typecheck && npm test` en verde; nada de comportamiento cambió todavía.

---

## Phase 3: User Story 1 — Las decisiones escritas dicen lo que el sistema hace (Priority: P1) 🎯 MVP

**Goal**: constitución v1.3.0 (VII), feature del puerto planificada y X como deuda declarada, prosa del modo retirado fuera, replay y límite del perfil escritos, política comercial en tasas.

**Independent Test**: quickstart § US1 — cada documento leído junto al código no lo desmiente; `check:api-map`, `check:markers`, `check:adrs` en verde; pruebas de la política comercial en verde con las mismas entradas y veredictos.

### Decisiones y prosa (F-062, F-063, F-014, F-015, F-008, F-016, F-036, F-023, F-058, F-047, F-034, F-017, F-029)

- [x] T008 [US1] Enmendar `.specify/memory/constitution.md` a v1.3.0 según `contracts/constitution-v1.3.0.md` (VII: incentivo aplicado; historial de versiones con fecha y motivo; sin cambio en X) (F-062)
- [x] T009 [P] [US1] `docs/adr/028-cadena-de-evidencia-en-el-ledger.md` §6: citar "constitución VII (v1.3.0)" y anotar que 01 §10.3 lista seis campos y no se enmienda desde el repo (F-062)
- [x] T010 [P] [US1] `contracts/api-map.yaml`: roadmap según `contracts/api-map-roadmap.md` (014 auditoría, 015 correcciones, 016–021 corridos, 021 "Platform port and adapters" con fuente); correr las entradas `feature:` de `operations` dos números; `npm run check:api-map` verde (R-02, F-063)
- [x] T011 [P] [US1] `docs/adr/025-catalogo-y-verdad-de-producto.md` § Consecuencias: el caso base push es el primer escalón; el principio X (puerto de cuatro operaciones, adaptadores genérico y de prueba, prueba de punta a punta) queda como deuda declarada hasta la feature "Platform port and adapters"; y en `CLAUDE.md` § Notas operativas una línea con la misma deuda (F-063)
- [x] T012 [P] [US1] `CLAUDE.md`: quitar "en modo real" (líneas ~126 y ~130, frase duplicada), citar ADR-013/ADR-018 donde dice ADR-006 (~73); `docs/adr/013-anillos-modulos-y-composicion.md`: quitar "en modo real" (~71) y devolver al punto 6 su forma de lista (~90) (F-014, F-015)
- [x] T013 [P] [US1] Comentarios detrás del código: `src/composition/modules/merchant.ts:3` (mock), `src/application/experiment/services/assignment.service.ts:3` (`assignArm` → `Experiment.assign`), `src/application/ledger/ports/decision-id-generator.ts:2` y `src/composition/modules/ledger.ts:23` (el recorder acuña), `src/composition/profiles/local.ts:3` ("(006)" → "la feature de persistencia del mapa"), `tests/unit/domain/ingestion/event-batch.test.ts:2` (sin NO_OP provisional) (F-008, F-016, F-036, F-023, parte de F-014)
- [x] T014 [P] [US1] Features citadas por número → nombre de la feature o de la operación: `src/composition/modules/experiment.ts:3`, `src/application/catalog/policies/freshness.ts:3`, `src/application/decision/ports/policy-directory.ts:3`, `src/domain/shared-kernel/intervention.ts:19`, `src/domain/selection/candidate.ts:5,38`, `contracts/components/schemas/Incentive.yaml:7`, `contracts/components/schemas/Intervention.yaml`, `docs/adr/{021,022,025,026,027,028}-*.md`, `docs/dominio/{perfil-de-datos,frescura,escalera-del-incentivo,candidato}.md` (F-017, F-029; `git grep -n "feature 01[4-8]\|la 01[4-8]\b"` vacío al cerrar, salvo el informe fechado de la 014)
- [x] T015 [P] [US1] `docs/adr/029-firma-de-plataforma.md` §3: replay dentro de la ventana posible por diseño y absorbido por la idempotencia (orden y devolución 200; catálogo 200 o 422 out-of-order); prueba en `tests/integration/platform-signature.test.ts` que reenvía la misma request firmada y no obtiene un segundo registro (F-058)
- [x] T016 [P] [US1] `src/interface-adapters/gateways/ledger/memory-decision-ledger.ts:1-2` y `src/composition/profiles/local.ts:1-4`: los ledgers en memoria no podan y el perfil no es para tráfico (ADR-018 gana la misma frase en Consecuencias) (F-047)
- [x] T017 [P] [US1] `src/application/decision/policies/session-window.ts`: derivar `SESSION_WINDOW` de `DEDUP_WINDOW` (import por `application/ingestion/index.js`, permitido por `CONTEXT_MAP`) y prueba en `tests/unit/domain/decision/session-state.test.ts` (o gobernanza) que afirma la igualdad (F-034)

### Política comercial en tasas (F-031)

- [x] T018 [US1] Pruebas primero: en `tests/unit/domain/commercial/commercial-policy.test.ts` y `verdict.test.ts` conservar las entradas en porcentaje a través de un conversor de prueba (`policyFromPercent`) y agregar el caso "cada entero 1..100 sobrevive porcentaje → tasa → porcentaje"; en `tests/unit/domain/commercial/default-policy.test.ts` afirmar `maxIncentiveShare: 0.1`, `incentiveLadderShare: [0.05, 0.1]`
- [x] T019 [US1] `src/domain/commercial/commercial-policy.ts`: `maxIncentiveShare`, `incentiveLadderShare`, `marginShare` (0–1) con `isRate`; escalera estrictamente creciente en (0, techo]; `#incentiveValue` devuelve `Math.round(share * 100)`; mensajes de `src/domain/commercial/errors.ts` en términos de tasa; `src/domain/commercial/default-commercial-policy.ts` en tasas (data-model.md)
- [x] T020 [US1] `src/composition/commercial-policy-config.ts`: leer `maxIncentivePercent`, `incentiveLadderPercent`, `marginPercent` como enteros 0–100 (forma) y convertir a tasas; `tests/unit/composition/config.test.ts` conserva sus casos; `tests/integration/commercial-policy.test.ts` sin cambios de aserciones; `CLAUDE.md` § Notas operativas (plano de decisión) y § Cómo se escribe una entidad: la política comercial cumple la convención
- [x] T021 [US1] Actualizar `docs/auditoria/trabajo/afirmaciones.md` A-031, A-039, A-070 (evidencia "✓ v1.3.0" / "✓ tasas"); `npm run format:check && npm run quality && npm run typecheck && npm test` en verde; commit `docs(015): decisiones escritas y tasas en la política comercial`

**Checkpoint**: US1 verificable sola con quickstart § US1.

---

## Phase 4: User Story 2 — Las reglas viven en su dueño y la seguridad hace lo que los ADRs deciden (Priority: P1)

**Goal**: F-007, F-051, F-053, F-057, F-044.

**Independent Test**: quickstart § US2; pruebas de integración 004–013 sin cambiar aserciones; `contract:diff` compatible.

### Invariantes en su dueño (F-007)

- [x] T022 [P] [US2] Pruebas primero en `tests/unit/domain/merchant/merchant.test.ts`: `[invariant:invalid-ingest-keys]` (vacío, tres, una vacía), `[invariant:invalid-origins]` (vacío), `[invariant:invalid-platform-keys]` (tres), `[invariant:invalid-platform-secrets]` (tres) con `details.index` donde aplica; `Merchant.rehydrate` no juzga
- [x] T023 [P] [US2] Pruebas primero en `tests/unit/domain/experiment/experiments.test.ts` (nuevo): `Experiments.of` acepta cero, uno activo y varios cerrados; `[invariant:multiple-active-experiments]` con `details.index`; `[invariant:duplicate-experiment-id]`; `active()`; `rehydrate` no juzga
- [x] T024 [US2] `src/domain/merchant/errors.ts`: `InvalidIngestKeys`, `InvalidOrigins`, `InvalidPlatformKeys`, `InvalidPlatformSecrets` (códigos de T007); `src/domain/merchant/merchant.ts`: `Merchant.of` aplica el orden de data-model.md; exportar desde `index.ts`
- [x] T025 [US2] `src/domain/experiment/experiments.ts` (nuevo, clase con `of`/`rehydrate`/`active`/`all`), `src/domain/experiment/errors.ts` (`MultipleActiveExperiments`, `DuplicateExperimentId`), `src/domain/experiment/index.ts`; `src/interface-adapters/gateways/experiment/config-experiment-directory.ts` recibe `Experiments` y responde `active()`; `src/composition/modules/experiment.ts` pasa `m.experiments` como `Experiments`
- [x] T026 [US2] `src/composition/config.ts`: quitar los conteos de claves, orígenes, `platformKeys`, `platformSecrets` y el filtro de activos; parsear forma (arrays de strings, patrón de `experimentId`) y traducir `DomainError` → `ConfigError` con el campo usando `rejected()` de `src/composition/condition-config.ts`; `MerchantConfig.experiments: Experiments`; `tests/unit/composition/config.test.ts` conserva sus mensajes de campo (`merchants[0].ingestKeys`, `merchants[0].experiments`)

### Bordes de seguridad (F-051, F-053, F-057)

- [x] T027 [P] [US2] Prueba primero en `tests/integration/cors.test.ts`: preflight desde origen registrado anunciando `x-ope-platform-key`, `x-ope-timestamp`, `x-ope-signature` → ninguno en `access-control-allow-headers`; `x-ope-ingest-key` sí
- [x] T028 [US2] `src/interface-adapters/http/typed.ts`: `SecurityScheme.consumer: "browser" | "server"`; `src/composition/modules/merchant.ts`: `ingestKey` browser, `platformKey` server; `src/infrastructure/http/build-server.ts`: `credentialHeaders` sólo de los esquemas browser; `tests/unit/http/security-handlers.test.ts` y `tests/unit/composition/*` que construyen `SecurityScheme` ganan el campo (F-051)
- [x] T029 [P] [US2] `src/domain/merchant/merchant.ts` `ownsPlatformKey` y `src/domain/merchant/platform-signature.ts` `matches` usan `constantTimeEquals` (T004); prueba en `tests/unit/domain/merchant/merchant.test.ts` (prefijo largo compartido) y `platform-signature.test.ts` sigue verde (F-053)
- [x] T030 [P] [US2] Prueba primero en `tests/integration/ingest-events.test.ts`: `POST /v1/events` con `Content-Length` de 1 MiB + 1 → 413 `payload-too-large` sin parsear; `tests/integration/catalog-size.test.ts` sigue en 201; `tests/integration/orders.test.ts` una orden de 1 MiB + 1 → 201 o 413 según el límite del consumidor `platform` (32 MiB: pasa)
- [x] T031 [US2] `src/infrastructure/http/build-server.ts`: hook `preParsing` que resuelve la operación con `api.matchOperation`, toma el límite por consumidor de su tag (`platform` 32 MiB, resto 1 MiB, constantes con nombre) y responde `413` Problem Details `payload-too-large` cuando `Content-Length` lo supera; `bodyLimit` global de 32 MiB como techo para cuerpos sin `Content-Length` (comentario que lo dice) (F-057, R-07)

### Catálogo con canal de indisponibilidad (F-044)

- [x] T032 [US2] `contracts/paths/catalog.yaml`: respuesta `503` como en `orders.yaml`; `npm run contract:check` (diff compatible); `npm run contract:types`
- [x] T033 [P] [US2] Pruebas primero: `tests/unit/application/catalog/upsert-catalog-snapshot.use-case.test.ts` con un store cuyo `replace` responde `unavailable` → `{ ok: false, error: { code: "ledger-unavailable" } }` y nada reemplazado; `tests/integration/catalog.test.ts` con el helper de `tests/helpers/unavailable-ledgers.ts` ampliado → 503 con `Retry-After`
- [x] T034 [US2] `src/application/catalog/ports/catalog-store.ts` `replace` → `Promise<Result<void, LedgerUnavailable>>`; `src/application/catalog/use-cases/upsert-catalog-snapshot.use-case.ts` devuelve `fail(written.error)`; `src/interface-adapters/gateways/catalog/memory-catalog-store.ts` `ok(undefined)`; `tests/helpers/unavailable-ledgers.ts` gana el catálogo
- [x] T035 [US2] `npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:contract` en verde; commit `feat(015): reglas en su dueño y bordes de seguridad`

**Checkpoint**: US2 verificable sola con quickstart § US2.

---

## Phase 5: User Story 3 — Los gates miran lo que creen mirar y el conocimiento está escrito una vez (Priority: P2)

**Goal**: F-052, F-013, F-021, F-030, F-033, F-048, F-022, F-038, F-039, F-054, F-055, F-056.

**Independent Test**: quickstart § US3; reporte completo de mutación sin `Ignored` fuera de línea; `Lint exceptions: 0` con `detectObjects`; `test:contract` sin 401 en plataforma; `npm test` más rápido.

### Mutación y lint (F-052, F-013)

- [ ] T036 [P] [US3] Prueba primero en `tests/governance/mutation-diff.test.ts`: dado un reporte de Stryker (fixture con dos mutantes `Ignored`, uno dentro y otro fuera del rango de su comentario), la función `ignoredOutsideDisable(report, sources)` lista el de afuera; comando `npm run check:mutation-report` (o parte de `test:mutation -- --all`) que falla si hay alguno
- [ ] T037 [US3] `src/infrastructure/http/build-server.ts:117-121`, `src/domain/barrier/condition.ts:172-179`, `src/domain/barrier/signals.ts:113-122`, `src/application/decision/services/decision.service.ts:222-225`: excepciones en forma `next-line` o `restore` colocado antes del cierre del `switch` como sentencia propia; `npm run test:mutation -- --all` al cierre de la historia y `check:mutation-report` sin `Ignored` fuera de línea (F-052, SC-006)
- [ ] T038 [P] [US3] `src/interface-adapters/http/status.ts` (nuevo): `HTTP_STATUS` con los códigos que `src/` usa; `src/interface-adapters/http/boundary.ts` lee `CREATED`/`REPEATED` de ahí; controllers `src/interface-adapters/http/controllers/**/*.ts`, `src/interface-adapters/http/problem-details.ts`, `src/composition/commercial-policy-config.ts:33` y `src/infrastructure/http/cors.ts:30` (`maxAge` con nombre) sin números sin nombre; `eslint.config.mjs` `detectObjects: true` con su justificación al lado; fixture `tests/lint/fixtures/as-src/no-magic-numbers-object.ts` y caso en `tests/lint/lint.test.ts` (F-013)

### Conocimiento una vez (F-021, F-030, F-033, F-048, F-022)

- [ ] T039 [P] [US3] `src/interface-adapters/http/controllers/{ingestion/ingest-events,catalog/upsert-catalog-snapshot,ledger/confirm-exposure}.ts`: importar `instantOf` de `../../boundary.js` y borrar las copias; `tests/unit/http/instant-guard.test.ts` sigue verde (F-021)
- [ ] T040 [P] [US3] `src/domain/experiment/experiment.ts`, `src/domain/barrier/barrier-rules.ts`, `src/domain/barrier/condition.ts`, `src/domain/decision/decision-policy.ts` importan `isRate`/`isCount` del shared-kernel y borran las copias; sus pruebas de bordes se reducen a un caso cada una (la tabla vive en T005) (F-030)
- [ ] T041 [P] [US3] Prueba primero `tests/unit/gateways/windowed-map.test.ts` (TTL, tope, orden por último toque, un `Map` por merchant); `src/interface-adapters/gateways/shared-kernel/windowed-map.ts` con `windowedByMerchant`; `memory-event-dedup.ts`, `memory-session-state-store.ts`, `memory-visitor-state-store.ts` lo usan conservando sus pruebas; `.dependency-cruiser.cjs` `gateways-no-cross` exceptúa `gateways/shared-kernel/` con fixture en `tests/architecture/fixtures/src/` y caso en `tests/architecture/architecture.test.ts` (F-033)
- [ ] T042 [P] [US3] `src/domain/ingestion/event-batch.ts`, `src/domain/catalog/catalog-snapshot.ts`, `src/domain/outcomes/order.ts`, `src/application/merchant/policies/signature-window.ts` leen `CLOCK_SKEW_TOLERANCE_MS`; las pruebas que pinnaban cada valor pasan a afirmar contra la constante (F-048)
- [ ] T043 [P] [US3] Mensajes sin números de sus constantes: `src/domain/ingestion/errors.ts` (`EventTimestampOutOfRange(eventId, tolerance)` con `details`), `src/domain/catalog/errors.ts` (`CatalogCapturedInFuture`), `src/domain/outcomes/errors.ts` (`AHEAD_OF_CLOCK`), `src/domain/barrier/errors.ts` (`UnknownBarrier` con `BARRIERS.join`), `src/domain/decision/errors.ts` (`InvalidPolicyPriority`, `InvalidPolicyEvidence`); pruebas afirman `details` (F-022)

### Vocabularios cerrados (F-038, F-039)

- [ ] T044 [US3] `src/domain/selection/candidate.ts`: `Claim` como unión discriminada por `kind` con `{ kind: "product-attribute", key }`; `CANDIDATES` con objetos; retirar `ATTRIBUTE_CLAIM_PREFIX`; `src/domain/selection/quality-gate.ts` agota `kind` sin `default`; `tests/unit/domain/selection/{quality-gate,candidates}.test.ts` y `tests/unit/application/decision/decision.service.test.ts` ajustados; caso "una clase de claim nueva no compila" en `tests/types/claims.test-d.ts` (F-038)
- [ ] T045 [P] [US3] `src/composition/condition-config.ts`: `FACTS … as const satisfies readonly FactCondition["fact"][]`; `tests/types/condition-config.test-d.ts` afirma `Exclude<FactCondition["fact"], Fact>` es `never` (F-039)

### Pruebas (F-054, F-055, F-056)

- [ ] T046 [P] [US3] `scripts/test-contract.mjs`: merchant de contrato con `platformKeys` (sin secretos) y header `X-OPE-Platform-Key` además del de ingesta; encabezado del script explica el aviso de "schema validation mismatch" (invariantes); `npm run test:contract` sin "401 Unauthorized (3 operations)" (F-054)
- [ ] T047 [US3] `vitest.config.ts`: proyectos `fast` y `tools` (`tests/audit`, `tests/governance/quality.test.ts`, `tests/unit/contract-docs.test.ts`); `package.json` `test` → `fast`, `test:tools` → `tools`, `test:all` → ambos; `.github/workflows/ci.yml` corre `test:all`; `tests/hooks/ci.test.ts` lo afirma; `CLAUDE.md` § Comandos (F-055)
- [ ] T048 [US3] `tests/helpers/test-app.ts`: `startTestApp` por archivo con `resetPorts()` (o fábrica que reconstruye sólo los puertos en memoria) y `eventOf`/`batchOf` con `occurredAt: NOW` por defecto (exportar `NOW`); migrar las 22 pruebas de `tests/integration/*.test.ts` a `beforeAll` + `beforeEach(resetPorts)` conservando aserciones; medir `npm test` (SC-005) y anotar en quickstart (F-055, F-056)
- [ ] T049 [US3] `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:mutation -- --all && npm run test:contract` en verde; commit `feat(015): gates que miran y conocimiento escrito una vez`

**Checkpoint**: US3 verificable sola con quickstart § US3.

---

## Phase 6: User Story 4 — El código se lee sin tropezar (Priority: P3)

**Goal**: F-001, F-003, F-004, F-005, F-006, F-009, F-011, F-012, F-018, F-019, F-020, F-024, F-025, F-026, F-027, F-028, F-032, F-035, F-037, F-040; F-041 rechazado.

**Independent Test**: quickstart § US4; rúbrica de la 014 sobre los archivos tocados sin reproducir estos F-NNN.

- [ ] T050 [P] [US4] Prueba primero `tests/governance/test-headers.test.ts`: toda cabecera (primeras 4 líneas) de `tests/**/*.test.ts` que cite `FR-`/`SC-` nombra `Feature NNN`; fixture negativo; completar las ~58 cabeceras faltantes con la feature que las creó (según el `quickstart.md` de cada spec; en duda `git log --follow`) (F-020)
- [ ] T051 [P] [US4] `src/infrastructure/http/build-server.ts` dividido según R-13 en `src/infrastructure/http/raw-bodies.ts`, `src/infrastructure/http/security-boundary.ts`, `src/infrastructure/http/dispatch.ts`; JSDoc duplicado y desplazado corregido (F-011); `tests/integration/{server,security-capabilities,logging-privacy}.test.ts` sin cambios de aserciones; `npm run arch` en 0 (F-012)
- [ ] T052 [P] [US4] `src/domain/catalog/catalog-snapshot.ts`: borrar `variant()`, `#byVariant` y `VariantOfProduct` (la unicidad sigue en `of`); `tests/unit/domain/catalog/catalog-snapshot.test.ts` y `tests/unit/application/catalog/upsert-catalog-snapshot.use-case.test.ts` ajustados (F-026)
- [ ] T053 [P] [US4] `src/application/catalog/services/product-truth.service.ts`: `known`/`known-product` llevan `stockAndPrice` directo (sin `TruthFreshness.catalog`); `src/application/decision/services/decision.service.ts:242` y `tests/unit/application/catalog/product-truth.service.test.ts` ajustados (F-027)
- [ ] T054 [P] [US4] `src/domain/outcomes/order.ts` `correlated(correlation, redemption)`; `src/application/outcomes/use-cases/notify-order.use-case.ts` lo usa y `decisions: Pick<DecisionLedger, "bySession">`; pruebas `tests/unit/domain/outcomes/order.test.ts`, `tests/unit/application/outcomes/notify-order.test.ts` (F-037, F-040)
- [ ] T055 [P] [US4] Nombres y tipos: `src/composition/modules/shared-kernel.ts` `localKernelPorts` (F-004); `src/domain/catalog/errors.ts` `CatalogOutOfOrder(currentCapturedAt, incomingCapturedAt)` (F-028); `src/application/decision/services/decision.service.ts` `triggerOf(inferred: Barrier | undefined, selected: Barrier | undefined)` (F-035); `src/application/shared-kernel/decorators/logged-use-case.ts:19` guarda en vez de `as` (F-003)
- [ ] T056 [P] [US4] Ubicaciones: `src/interface-adapters/http/security/ingest-key.ts` `merchantOf` → `src/interface-adapters/http/security/principal.ts` con imports actualizados (F-009); `tests/unit/health.test.ts` → `tests/unit/application/system/get-service-health.test.ts` (F-006)
- [ ] T057 [P] [US4] Comentarios: `src/domain/shared-kernel/index.ts:1` (F-001); `docs/dominio/intervencion.md` (F-005); `src/interface-adapters/gateways/ingestion/memory-event-dedup.ts:37,44` por qué `expire` dos veces (F-025); `src/domain/commercial/commercial-policy.ts:264` "03 §6 D-B" (F-032); `tests/unit/domain/experiment/assignment-regression.test.ts:13` por qué la copia de `fnv1a32` (F-019)
- [ ] T058 [P] [US4] `tests/integration/assignment.test.ts`: `asMerchantId`/`asExperimentId`/`asVisitorId` en vez de `as never` (líneas 68, 120, 128, 137, 139) y revisar los otros 18 archivos con `as never` sobre valores válidos (F-018); `tests/integration/ingest-events.test.ts:58`: la prueba afirma `decisions.bySession(...)` tras el reenvío (si el reenvío produce una segunda decisión, el título cambia a lo que el sistema hace y el hecho va al anexo de cierre para la feature de persistencia) (F-024)
- [ ] T059 [US4] F-041 rechazado: anotar en `specs/015-correcciones-auditoria/hallazgos-en-alcance.md` el motivo (R-13) para el anexo de cierre; `npm run format:check && npm run quality && npm run typecheck && npm run test:all` en verde; commit `refactor(015): legibilidad, cabeceras y forma`

**Checkpoint**: las cuatro historias verificables por separado.

---

## Phase 7: Cierre de la auditoría (R-14, FR-001..FR-003)

- [ ] T060 Escribir `closure` en cada hallazgo en alcance de `docs/auditoria/trabajo/hallazgos/fase-{1..4}.json` (`resolved` + hash del commit de su historia; F-041 `rejected` + motivo; F-043/F-045/F-046 sin `closure`, anotados como persistencia); `verify-finding.mjs` sobre los cuatro archivos (SC-001)
- [ ] T061 Re-corrida del método (SC-002): `run-gates.mjs --module <m> --json` sobre los 15 alcances y la rúbrica `specs/014-auditoria-integral/contracts/rubrica.md` sobre `git diff --name-only main -- src tests`; salida en `docs/auditoria/trabajo/gates/cierre-015/`; estado global recalculado por la regla fija
- [ ] T062 Escribir `docs/auditoria/2026-09-19-informe-auditoria-integral.md` §8 según `contracts/closure-annex.md` (tabla F-NNN → estado → commit; renumeración del mapa; los tres de persistencia; resultado de la re-corrida; F-041 y su motivo); actualizar `docs/auditoria/trabajo/afirmaciones.md` donde la evidencia cambió (A-005, A-017, A-035/A-036 con la feature planificada, A-042, A-160/A-193 sin cambio)
- [ ] T063 `specs/015-correcciones-auditoria/quickstart.md` § "Cambios respecto del plan" completado (duraciones, decisiones tomadas en el camino); `npm run check:markers` (0 abiertos, 0 placeholders); `npx prettier --check .`; `npm run release-check`
- [ ] T064 Commit `docs(015): cierre de la auditoría 014`; PR `015-correcciones-auditoria` → `main` con el Constitution Check (diez principios, X como deuda declarada) y el resumen de SC-001..SC-006; sin merge hasta que el dueño lo pida

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T007)** → US1 → US2 → US3 → US4 → Cierre.
- US1 antes que US2/US3: fija la forma de la política comercial (T018–T020) que T040 toca, y el roadmap (T010) que T014 cita.
- US2 y US3 pueden intercalarse salvo: `build-server.ts` (T028, T031 antes de T037/T038, y T051 al final), `errors.ts` de merchant/experiment (T024/T025 antes de T043), `test-app.ts` (T048 después de T030/T033 para no migrar dos veces).
- US4 al final: T051 divide `build-server.ts` ya modificado; T050 después de que las demás historias hayan creado sus pruebas nuevas (para que las cabeceras nuevas ya cumplan).
- Cierre requiere las cuatro historias commiteadas (los hashes van en `closure`).

## Parallel Opportunities

- Foundational: T004–T007 en paralelo.
- US1: T009–T017 en paralelo (archivos distintos); T018 → T019 → T020 en serie.
- US2: T022/T023 en paralelo, luego T024/T025 → T026; T027/T029/T030/T033 en paralelo con ellos; T028 → T031 en serie sobre `build-server.ts`.
- US3: T036, T038, T039, T040, T041, T042, T043, T045, T046 en paralelo; T037 después de T036; T044 solo; T047 → T048 en serie.
- US4: T050–T058 en paralelo salvo T051 (último sobre `build-server.ts`).

## Implementation Strategy

- **MVP**: Setup + Foundational + US1 (una sesión): deja las decisiones escritas y la política en tasas, con gates verdes.
- **Incremental**: US2 (una sesión), US3 (una o dos: la migración de integración y la mutación completa), US4 (una), cierre (una).
- Cada historia termina con su commit y todos los gates; al cierre de cada una el dueño puede reordenar o detener, y el anexo de cierre registra el estado exacto.

## Notes

- Un hallazgo se cierra en su JSON en la Phase 7, no por tarea; esta lista dice qué unidad de trabajo se cerró.
- Ninguna tarea agrega excepciones de lint, idioma o mutación; si una regla nueva no admite un caso legítimo, la regla se ajusta con fixture.
- Las respuestas de las siete operaciones no cambian salvo la 503 del catálogo (SC-004): las pruebas de integración de 004–013 son la guarda.
