# Tasks: Mapa del contrato y convenciones transversales

**Input**: Design documents from `specs/006-mapa-del-contrato/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: exigidas por la spec (FR-003, FR-050, SC-002, SC-003): un caso de falla por regla
del chequeo del mapa y un fixture por regla nueva del ruleset, escritos antes del código que
los hace pasar. Todo lo nuevo en inglés salvo docs y ADRs (ADR-015).

**Organization**: por historia, respetando el orden de commits del plan: (1) decisiones
(ADRs, enmienda) + mapa + componentes + `check:api-map`; (2) reglas del ruleset; (3)
documentación publicada, guía y cierre. Sin código de servidor.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Contrato en `contracts/`, gobernanza en `scripts/` y
`tests/governance/`, reglas en `contracts/rules/functions/` con fixtures generados por
`tests/contract-rules/gen-fixtures.mjs`.

---

## Phase 1: Setup — decisiones y catálogos (commit 1, parte a)

- [x] T001 Enmienda de la constitución (aprobada por el usuario el 2026-09-17): en `.specify/memory/constitution.md`, principio V, primer punto → "`merchantId` MUST derivarse siempre de la credencial autenticada. MUST NOT tomarse del body, la query ni el path, **salvo en las operaciones del consumidor `admin` (ADR-020): su credencial es de un operador de OPE, no de un merchant, y el merchant administrado es un recurso de la ruta**"; en "Reglas que fallan el build" de `CLAUDE.md` la misma salvedad; bump a **1.2.0** con nota de versión (MINOR: excepción acotada a un principio, verificada por lint) y fuente `specs/006-mapa-del-contrato`.
- [x] T002 [P] ADRs a `estado: aceptada`: `docs/adr/019-mapa-del-contrato-y-ciclo-de-vida.md`, `docs/adr/020-consumidores-autenticacion-idempotencia-paginacion.md`.
- [x] T003 [P] Agregar a `contracts/problem-types.yaml` el tipo `idempotency-conflict` (409, "Same identity, different content") de `specs/006-mapa-del-contrato/contracts/problem-types.additions.yaml` y replicarlo en `src/interface-adapters/http/problem-details.ts` (`PROBLEM_TYPES`) para que `tests/unit/problem-details.test.ts` siga verificando la réplica (único toque a `src/`: una constante).
- [x] T004 [P] Copiar los componentes propuestos del diseño a `contracts/`: `components/securitySchemes/{platformKey,portalSession,adminToken}.yaml`, `components/parameters/{cursor,limit,from,to}.yaml`, `components/schemas/Page.yaml`. **Sin referenciarlos desde `contracts/openapi.yaml`** (research R-02). Verificar que `npm run contract:lint` sigue en verde (no entran al bundle).
- [x] T005 Copiar `specs/006-mapa-del-contrato/contracts/api-map.yaml` a `contracts/api-map.yaml`; revisar que las tres `built` coincidan campo por campo con el contrato (método, ruta, tag, seguridad, capacidades) y que toda `source` cite un encabezado existente (`mvp:01-arquitectura-mvp.md#3.1`, `#5`, `#3.1.1`, `#4.1`, `#5.3`, `#5.7`, `#14.1`, `#14.2`; `mvp:02-integracion-ecommerce.md#3`, `#4`, `#5.1`, `#5.2`, `#5.4`; `mvp:03-alcance-mvp.md#4.4`; `docs/adr/014-…#Decisión`, `docs/adr/020-…#Decisión`; `specs/001-api-contract-toolchain/spec.md#User Story`).

---

## Phase 2: Foundational — verificación de fuentes compartida

- [x] T006 Extraer de `scripts/check-glossary.mjs` la verificación de `fuente` (`constitucion#X` | `mvp:archivo#X` | ruta del repo, con `headingExists`, `mvpDocsAvailable` y el aviso cuando los documentos no están) a `scripts/governance-lib.mjs` como `verifySource({ ref, section }, { repoRoot, constitution, mvpDocs })` → `{ problem?: string; warning?: string }`, con JSDoc; `check-glossary.mjs` la usa sin cambiar comportamiento (`tests/governance/glossary.test.ts` en verde, incluidos `mvp-ausente` y `mvp-vacio`).

**Checkpoint**: `npm run contract:check` y `npm test` en verde; nada nuevo verificado aún.

---

## Phase 3: User Story 1 — El mapa es la única puerta (Priority: P1) (commit 1, parte b)

**Goal**: `check:api-map` compara mapa y contrato en los dos sentidos, valida consumidores, features y fuentes, corre en `contract:check` e informa el conteo por estado.

**Independent Test**: `tests/governance/api-map.test.ts` en verde con un fixture por caso de falla; `npm run check:api-map` sobre el repo pasa e imprime `Map: 3 built, 20 planned, 0 deprecated, 0 retired`.

### Tests

- [x] T007 [P] [US1] Crear `tests/governance/fixtures/api-map/` con un directorio por caso, cada uno con `api-map.yaml`, `bundle.yaml` (OpenAPI mínimo bundleado), `constitucion.md`, `mvp/` y, cuando haga falta, `specs/`: `ok` (una `built`, una `planned`, una `deprecated` con `deprecated: true`, una `retired` con `retiredIn`); `contract-without-entry` (operación del bundle sin entrada); `built-without-operation`; `built-field-mismatch` (tag distinto); `built-security-mismatch` (esquema distinto al del consumidor); `built-capability-mismatch`; `tag-outside-consumer`; `capability-outside-vocabulary`; `scheme-file-missing`; `scheme-file-malformed` (sin `type`); `feature-unknown` (sin `specs/NNN-*` ni entrada en `features`); `source-broken` (encabezado inexistente); `duplicate-operation-id`; `duplicate-method-path`; `status-unknown`; `deprecated-without-flag` (mapa `deprecated`, contrato sin `deprecated: true`); `flag-without-deprecated` (al revés); `retired-present` (retirada aún en el contrato); `retired-without-version`; `merchant-id-outside-admin` (ruta con `{merchantId}` bajo `portal`); `public-with-security`.
- [x] T008 [P] [US1] Crear `tests/governance/api-map.test.ts` (patrón de `glossary.test.ts` con `runScript("check-api-map.mjs", ["--map", …, "--bundle", …, "--constitution", …, "--mvp-docs", …, "--specs", …])`): `ok` → exit 0 y salida `Map: 1 built, 1 planned, 1 deprecated, 1 retired`; cada caso de falla → exit 1 y salida que nombra el `operationId` o el campo; `mvp` ausente → aviso, exit 0.

### Implementation

- [x] T009 [US1] Crear `scripts/check-api-map.mjs` (JSDoc, `checkJs`): argumentos `--map` (default `contracts/api-map.yaml`), `--bundle` (default `bundlePath`), `--constitution`, `--mvp-docs`, `--specs` (default `specs/`), `--schemes` (default `contracts/components/securitySchemes`); carga con `readYaml`; valida la forma del mapa (secciones `consumers`, `features`, `operations`; campos y tipos según data-model.md); indexa las operaciones del bundle por `operationId` con método, ruta, tags, `security`, `x-required-capabilities`, `deprecated`; aplica todas las reglas de data-model.md ("Coherencia con el bundle" y "Mapa del contrato"), incluida `{merchantId}` en ruta sólo bajo `admin` y `public` ⇒ `security: []` sin capacidades; verifica cada esquema de seguridad de `consumers` como archivo con forma mínima; verifica `feature` contra `specs/<NNN>-*` o `features`; verifica `source` con `verifySource`; imprime `Map: N built, M planned, D deprecated, R retired` y `report(problems, …)`.
- [x] T010 [US1] `package.json`: script `check:api-map` (`node scripts/check-api-map.mjs`) y agregarlo al final de `contract:check`; `.github/workflows/ci.yml` no cambia (corre `contract:check`). Verificar `npm run contract:check` en verde con el mapa real y commit `feat(contrato): mapa del contrato con check:api-map, esquemas y componentes propuestos, ADR-019/020 y enmienda V`.

---

## Phase 4: User Story 2 — Consumidores, esquemas y capacidades (Priority: P1) (commit 2, parte a)

**Goal**: el tag fija el consumidor y el consumidor fija el esquema y el vocabulario de capacidades; `merchantId` en ruta sólo bajo `admin`.

**Independent Test**: `tests/contract-rules` en verde con los fixtures nuevos; `npm run contract:lint` en verde sobre el contrato real.

### Tests

- [x] T011 [P] [US2] En `tests/contract-rules/gen-fixtures.mjs` agregar mutadores: `ope-consumer-security.yaml` (operación `ingest` con `security: [{ platformKey: [] }]` y el esquema declarado en la raíz del fixture), `ope-consumer-security.public.yaml` (`getHealth` con `security: [{ ingestKey: [] }]`), `ope-consumer-security.two-requirements.yaml` (`ingest` con `ingestKey` y `platformKey` como alternativas), `ope-required-capabilities.foreign.yaml` (`portal` GET de un recurso con `orders:write`), `ope-no-merchant-id-in-request.admin-body.yaml` (`admin` con `merchantId` en body → falla), `valid-admin-path.yaml` (`admin` con `{merchantId}` en ruta → pasa; agregar a `VALID` en `rules.test.ts`). Los fixtures declaran el mapa que usan: el generador copia `contracts/api-map.yaml` junto a cada fixture como `api-map.yaml` (el ruleset lo referencia por ruta relativa).
- [x] T012 [P] [US2] En `tests/contract-rules/rules.test.ts`: los fixtures `valid-*` nuevos en `VALID`; la prueba "hay un fixture por cada regla propia" sigue cubriendo las reglas nuevas; caso explícito: `ope-no-merchant-id-in-request` sigue fallando en `path` para todo consumidor que no sea `admin` (fixture `ope-no-merchant-id-in-request.path.yaml` existente).

### Implementation

- [x] T013 [US2] Crear `contracts/rules/functions/_apiMap.js`: carga y memoiza `api-map.yaml` relativo a `context.rule.owner.source` (patrón de `_catalog.js`), expone `consumerOfTag(map, tag)`, `schemeOfConsumer(map, consumer)`, `capabilitiesOfConsumer(map, consumer)` con JSDoc y `@typedef ApiMap`.
- [x] T014 [US2] Crear `contracts/rules/functions/consumerSecurity.js` (`ope-consumer-security`, `given: $.paths[*][get,…]`, `functionOptions.map: ./api-map.yaml`): consumidor por tag (tag desconocido → error); `public` ⇒ `security` debe ser `[]`; otro ⇒ `security` debe ser exactamente `[{ <scheme>: [] }]` (un requisito, un esquema, sin scopes); mensajes en inglés con el consumidor y el esquema esperados. Registrar en `contracts/.spectral.yaml` (estilo bloque).
- [x] T015 [US2] Modificar `contracts/rules/functions/requiredCapabilities.js`: `functionOptions.map`; además de lo actual, cada capacidad debe pertenecer a `capabilitiesOfConsumer(consumerOfTag(tag))`; mensaje que nombra la capacidad y el consumidor. Actualizar la entrada del ruleset.
- [x] T016 [US2] Modificar `contracts/rules/functions/noMerchantIdInRequest.js`: recibe `functionOptions.map`; un parámetro `in: path` llamado `merchantId` se permite sólo si el consumidor del tag de la operación es `admin`; query, header, cookie y body siguen prohibidos para todos; comentario de cabecera citando ADR-020 y la enmienda. Actualizar la entrada del ruleset.
- [x] T017 [US2] `node tests/contract-rules/gen-fixtures.mjs`, `npx vitest run tests/contract-rules`, `npm run contract:lint` en verde.

---

## Phase 5: User Story 3 — Idempotencia de notificaciones (Priority: P2) (commit 2, parte b)

**Goal**: toda operación `outcomes` declara `x-idempotency` válida y `409`.

**Independent Test**: fixtures `ope-outcomes-idempotency.*` fallan por la regla; `valid-outcomes.yaml` pasa.

### Tests

- [x] T018 [P] [US3] Mutadores en `gen-fixtures.mjs`: `valid-outcomes.yaml` (operación `notifyOrder` completa según `specs/006-mapa-del-contrato/contracts/examples/x-idempotency.yaml`: `platformKey` en la raíz del fixture, body con `orderId` requerido, `201`, `200`, `400`, `401`, `409` con ejemplo `idempotency-conflict`, `422`, `500`); `ope-outcomes-idempotency.yaml` (sin la extensión); `.key.yaml` (`key` que no es propiedad requerida del body); `.codes.yaml` (`first` = `repeat`); `.conflict.yaml` (sin `409`). Agregar `valid-outcomes.yaml` a `VALID`.

### Implementation

- [x] T019 [US3] Crear `contracts/rules/functions/outcomesIdempotency.js` (`ope-outcomes-idempotency`, `given` operaciones, filtra por tag `outcomes`): exige `x-idempotency` objeto con `key` string, `first` y `repeat` strings 2xx distintos presentes en `responses`, `key` en `required` del schema del request body (resuelto por `$ref` del documento), y `responses["409"]` presente; mensajes en inglés. Registrar en el ruleset.
- [x] T020 [US3] Verificar fixtures y lint en verde.

---

## Phase 6: User Story 4 — Paginación de colecciones (Priority: P2) (commit 2, parte c)

**Goal**: toda lectura de colección del portal usa los parámetros y el envoltorio comunes.

**Independent Test**: fixtures `ope-collection-pagination.*` fallan; `valid-portal.yaml` pasa.

### Tests

- [x] T021 [P] [US4] Mutadores: `valid-portal.yaml` (`listDecisions`: `GET /v1/portal/decisions`, `portalSession` en la raíz, `x-collection: true`, los cuatro parámetros por `$ref` a `components/parameters/*`, `200` con `$ref` a `DecisionPage` = `Page` con `items` tipados, `401`, `500`; más `getDecision` `GET /v1/portal/decisions/{decisionId}` sin paginación → pasa); `ope-collection-pagination.yaml` (sin `x-collection`); `.params.yaml` (`page`/`offset` propios en vez de los comunes); `.envelope.yaml` (`200` con array pelado). Agregar `valid-portal.yaml` a `VALID`.

### Implementation

- [x] T022 [US4] Crear `contracts/rules/functions/collectionPagination.js` (`ope-collection-pagination`): `GET` con tag `portal` cuya ruta no termina en `}` ⇒ exige `x-collection: true`, parámetros con `name` ∈ {cursor, limit, from, to} (los cuatro), `200` con schema `$ref` cuyo nombre termina en `Page` y cuyo objeto tiene `items` array y `additionalProperties: false`; otras rutas del portal no se tocan. Registrar en el ruleset.
- [x] T023 [US4] `node tests/contract-rules/gen-fixtures.mjs`, pruebas y lint en verde. Commit `feat(contrato): reglas de consumidor, capacidades, idempotencia y paginación con fixtures (ADR-020)`.

---

## Phase 7: User Story 5 — Ciclo de vida (Priority: P3)

**Goal**: estados cerrados y coherencia depreciada/retirada verificadas (ya cubiertas por los fixtures de US1); documentación del protocolo.

- [ ] T024 [US5] Verificar que `tests/governance/api-map.test.ts` cubre `deprecated-without-flag`, `flag-without-deprecated`, `retired-present`, `retired-without-version`, `status-unknown` (T007) y que ADR-019 §3 describe las cuatro transiciones; agregar a `CLAUDE.md` (notas del contrato) el protocolo: depreciar = `deprecated: true` + estado en el mapa + anuncio en la descripción; retirar = quitar del contrato + `retired` con `retiredIn` + versión mayor.

---

## Phase 8: Polish — documentación publicada, guía y cierre (commit 3)

- [ ] T025 [P] Modificar `scripts/contract-docs.mjs`: antes de `build-docs`, leer `contracts/api-map.yaml`, generar una sección Markdown en inglés "## Planned surface" (tabla: operation, method and path, consumer, feature, status, source; sólo `planned` y `deprecated`, ordenadas por feature) y una línea "Built operations are documented below"; escribir una **copia** del bundle con esa sección agregada a `info.description` en un archivo temporal (`contracts/dist/openapi.docs.yaml`, ignorado por git) y construir la documentación desde ella; `contracts/dist/openapi.yaml` no cambia.
- [ ] T026 [P] Ampliar `tests/unit/contract-docs.test.ts`: el HTML contiene "Planned surface" y los `operationId` planeados (`notifyOrder`, `listDecisions`); el bundle `contracts/dist/openapi.yaml` es idéntico antes y después; presupuesto de tiempo propio como el caso existente.
- [ ] T027 [P] Actualizar `CLAUDE.md`: paso 0 del flujo HTTP (la operación existe en `contracts/api-map.yaml` como `planned` con consumidor, capacidad, feature y fuente; construirla es pasarla a `built` y, si es la primera de su consumidor, referenciar su esquema desde la raíz); tabla de comandos con `check:api-map`; notas del contrato: componentes propuestos como archivos sin referencia, `x-idempotency` en `outcomes`, `x-collection` en lecturas del portal, `merchantId` en ruta sólo bajo `admin` (ADR-020); "Reglas que fallan el build" con la salvedad (T001).
- [ ] T028 [P] Actualizar `README.md` (el mapa como índice de la API: qué existe, qué viene; `check:api-map`) y `contracts/rules/README.md` o `tests/contract-rules/README.md` (las cuatro reglas nuevas y el mapa que las alimenta).
- [ ] T029 Actualizar `specs/006-mapa-del-contrato/quickstart.md` con la tabla de estado fechada (BUILT / TESTED por historia, conteo del mapa) y verificación final: `npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check && npm run contract:docs`; `check:markers` sólo con propuestos; marcar `[x]` todas las tareas. Commit `chore(006): documentación publicada con la superficie planeada, guía de agentes y cierre`.

---

## Dependencies

- Phase 1 → Phase 2 → US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) → US4 (Phase 6) → US5 (Phase 7) → Polish.
- US2–US4 comparten `_apiMap.js` (T013) y el generador de fixtures; sus mutadores (T011, T018, T021) pueden escribirse en paralelo, la generación es una sola corrida.
- T001 (enmienda) antes de T016 (excepción en la regla): la regla cita la constitución enmendada.

## Parallel Execution Examples

- Phase 1: T002, T003, T004 en paralelo tras T001; T005 después de T004.
- US1: T007 y T008 en paralelo; T009 después.
- US2: T011 y T012 en paralelo; T013 → T014, T015, T016 (en paralelo entre sí) → T017.
- Polish: T025–T028 en paralelo; T029 al final.

## Implementation Strategy

MVP = Phase 1 + US1: el mapa existe, es verificado y `contract:check` lo exige. Después las
reglas (US2–US4, un commit), el ciclo de vida (documentación) y el cierre. Cada commit con
`contract:check`, `quality`, `test` y `test:contract` en verde; sin código de servidor salvo
la constante del catálogo de problemas.
