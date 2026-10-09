---
description: "Task list for feature 040 — el contrato para consumidores, y el operador con identidad"
---

# Tasks: El contrato para consumidores, y el operador con identidad

**Input**: `specs/040-el-contrato-para-consumidores/` (spec.md, plan.md, research.md, data-model.md,
contracts/consumer-artifacts.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.4.5 → 1.5.0 en el tramo 4); research.md
con los ocho hallazgos; ADR-044 en `propuesta`.

**Tests**: sí, y preceden a la implementación donde hay una regla: las fixtures de cada regla del
contrato antes de tocar la regla, la prueba del invariante con su puntero antes del `/body`, la prueba
de gobernanza de los artefactos antes de dar por emitidos.

**Organization**: por **tramo** del plan, porque el orden de `contrato.md` manda (el contrato antes que el
servidor, y lo emitido después de que el servidor haga lo que el contrato dice). Cada tarea lleva la
historia que sirve: US1 artefactos, US2 operador, US3 punteros, US4 identificador de pedido.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 · US2 · US3 · US4
- Cada tarea nombra su archivo

---

## Phase 1: El contrato (tramo 1)

**Purpose**: que el contrato diga todo lo nuevo antes de que el servidor lo haga, con sus reglas y sus
fixtures, y que sea un cambio menor.

- [x] T001 [US2] `contracts/api-map.yaml` — `getOperator` entra como `planned` bajo el hito
      `admin-panel` (`method: get`, `path: /v1/admin/operator`, `consumer: admin`, `tag: admin`,
      `capabilities: []`, `source: specs/040-el-contrato-para-consumidores/spec.md`), y en la misma fase
      pasa a `built` con `feature: "040"` cuando el path exista (orden 0 de `contrato.md`)
- [x] T002 [P] [US2] `tests/contract-rules/fixtures/` — **antes de tocar la regla**:
      `ope-required-capabilities.identifies-empty.yaml` (autenticada, `x-required-capabilities: []`, sin
      marca → falla) y `ope-required-capabilities.identifies-public.yaml` (`security: []` con
      `x-identifies-principal: true` → falla); `valid-capabilities.yaml` gana una operación con marca y
      lista vacía que tiene que pasar
- [x] T003 [US2] `contracts/rules/functions/requiredCapabilities.js` — admite la lista vacía **sólo**
      con `x-identifies-principal: true`, y la marca sólo en una operación autenticada; mensajes que
      nombran la marca; `contracts/.spectral.yaml` sin cambio de forma (la función lee la extensión)
- [x] T004 [P] [US2] `tests/contract-rules/fixtures/ope-no-pii.display-name.yaml` — `displayName` en
      un esquema que no es el del operador → falla; y una fixture válida con
      `components.schemas.Operator.properties.displayName` → pasa
- [x] T005 [US2] `contracts/rules/pii-denylist.json` gana `displayName`; `contracts/.spectral.yaml`
      (`ope-no-pii.functionOptions.allow`, una entrada con `path` igual a
      `components.schemas.Operator.properties.displayName` y su `reason`) y
      `contracts/rules/functions/noPii.js` honran la excepción: un `allow` sin `reason` es un problema
      de la regla misma (R-05)
- [x] T006 [P] [US3] `tests/contract-rules/fixtures/ope-invariants.pointer-on-operation.yaml` —
      `pointer` en un invariante de operación → falla; `valid-invariants.yaml` gana un invariante de
      esquema con `pointer: origins[N]`
- [x] T007 [US3] `contracts/rules/functions/invariants.js` — `pointer` opcional, string no vacío, sólo
      cuando el invariante cuelga de un esquema (no de una operación) (R-02)
- [x] T008 [P] [US2] `contracts/components/schemas/Operator.yaml` (NUEVO) según
      `contracts/consumer-artifacts.md` §1, y `contracts/paths/admin-operator.yaml` (NUEVO) con
      `getOperator`; `contracts/openapi.yaml` lo referencia como `/v1/admin/operator`
- [x] T009 [P] [US4] `contracts/components/schemas/ProblemDetails.yaml` — `requestId` opcional con su
      descripción
- [x] T010 [P] [US3] `x-invariants[].pointer` en `contracts/components/schemas/MerchantCreate.yaml`
      (`invalid-origin` y `origin-already-registered`: `origins[N]`), `CredentialRotation.yaml`
      (`rotation-grace-too-long`: `graceSeconds`) y los cuatro esquemas con `configuration-reason-required`
      (`reason`); los ejemplos de `contracts/components/responses/RotationUnprocessable.yaml` y
      `MerchantUnprocessable.yaml` con punteros bajo `/body` y `origin-already-registered` con su
      `errors[]`
- [x] T011 [US3] `scripts/check-invariant-tests.mjs` — un invariante con `pointer` exige que su prueba
      `[invariant:<slug>]` contenga `/body/<primer segmento>`; `tests/governance/invariant-tests.test.ts`
      gana el caso sobre fixtures (una prueba que lo nombra pasa, una que no, falla)
- [x] T012 [US1] `contracts/openapi.yaml` — `info.version: 1.12.0`; `tests/integration/bootstrap.test.ts`
      afirma la versión nueva; `contracts/README.md` gana la fila de `x-identifies-principal` en la
      tabla de extensiones y el campo `pointer` en la fila de `x-invariants`
- [x] T013 `npm run contract:check` en verde (lint con las fixtures nuevas, bundle, diff «No
      incompatible changes», api-map, invariant-tests —que ahora falla hasta que las pruebas del tramo
      2 nombren los punteros: se deja en rojo **sólo** si el tramo 2 va en el mismo commit; si no, las
      pruebas se tocan acá—, glossary, identifiers, adrs, markers, language, instructions);
      `npm run contract:types` regenera `generated/api.d.ts` con `getOperator` y `requestId`

**Checkpoint**: el contrato describe todo lo nuevo, es compatible, y cada regla enmendada falla con su
fixture. Commit: `feat(040): el contrato declara getOperator, requestId y el campo de cada invariante`.

---

## Phase 2: El servidor (tramo 2)

**Purpose**: que el servidor haga lo que el contrato dice, con las pruebas de integración que lo afirman
y sin un mutante vivo en lo nuevo.

- [x] T014 [P] [US4] `tests/integration/operator.test.ts` (NUEVO) — **antes del código**: toda
      respuesta lleva `X-Request-Id`; un Problem Details lleva `requestId` igual al encabezado; un
      `X-Request-Id` pegado no se adopta; el valor es el `reqId` del registro (el logger de prueba lo
      captura); `getOperator` con un operador con nombre y alcance `*` devuelve `operatorId`,
      `displayName` y `scope`; sin nombre → sin `displayName`; credencial desconocida →
      `401 operator-unknown`; y que la respuesta no nombra ningún merchant ni credencial
- [x] T015 [US4] `src/infrastructure/http/build-server.ts` — `requestIdHeader: false`; hook `onRequest`
      que fija `x-request-id` con `request.id` (al lado de `retryAfterOn503`, con el mismo estilo);
      `src/infrastructure/http/http-response.ts` — `send()` agrega `requestId` al cuerpo cuando el
      `content-type` es el de problema (R-03)
- [x] T016 [P] [US3] `tests/integration/admin-merchants.test.ts` — `[invariant:origin-already-registered]`
      afirma `errors: [{ pointer: "/body/origins/1", message }]` con el repetido en la segunda posición;
      `[invariant:invalid-origin]` afirma `/body/origins/0`; la prueba de `[invariant:rotation-grace-too-long]`
      (donde viva) afirma `/body/graceSeconds`; las de configuración y textos que afirmaban `/declared/...`
      pasan a `/body/declared/...`
- [x] T017 [US3] `src/interface-adapters/http/to-problem.ts` — publica `/body` + puntero;
      `src/domain/merchant/errors.ts` — `OriginAlreadyRegistered(index)` e `InvalidOrigin(index)` llevan
      `pointer: origins[${index}]`, `RotationGraceTooLong` lleva `pointer: "graceSeconds"`; las pruebas
      unitarias de dominio (`tests/unit/domain/merchant/merchant.test.ts`) afirman el detalle
- [x] T018 [P] [US2] `tests/unit/domain/operator/operator.test.ts` — `Operator.of` con `displayName`
      válido, vacío (falla), con espacios en los bordes (falla), más largo que el máximo (falla);
      `rehydrate` no juzga; `system()` sin nombre
- [x] T019 [US2] `src/domain/operator/operator.ts` — `OperatorRecord.displayName?`, `MAX_DISPLAY_NAME`
      como constante nombrada del dominio, la regla en `of`, y el error (`InvalidOperatorDisplayName`
      en `src/domain/operator/errors.ts`, sin tipo de problema: no sale al contrato, lo ve la
      configuración al arrancar); `src/composition/operators-config.ts` lo lee y lo convierte en
      `ConfigError` con su campo; `config/schemas/operators.schema.json` lo admite (`minLength: 1`,
      `maxLength` igual al del dominio); `config/dev-operators.json` gana el `displayName`
      «Operador de desarrollo»; la prueba del parser (`tests/unit/composition/…operators…`) cubre con y
      sin nombre
- [x] T020 [US2] `src/application/operator/use-cases/get-operator.use-case.ts` (NUEVO) —
      `GetOperatorUseCase` trivial (`execute({ actor }) → ok(actor)`, ADR-023), exportado por el
      `index.ts` del módulo; `src/interface-adapters/operator/presenters.ts` (`operatorDto`: `operatorId`,
      `displayName` si lo hay, `scope`) y `controllers/get-operator.ts` tipado
      `OperationHandler<"getOperator">` con `operatorOf(req)`; cableado con `served()` en el módulo que
      hoy sirve `admin` y resuelve el token (`src/composition/modules/`), sin módulo nuevo; `npm run arch`
      en verde
- [x] T021 `npm run format:check && npm run quality && npm run typecheck && npm test` en verde;
      `npm run test:contract`; `npm run test:mutation` sin sobrevivientes en lo nuevo (`to-problem.ts`,
      `build-server.ts`, `http-response.ts`, `operator.ts`, `operators-config.ts`, el caso de uso y el
      controller); contra `npm run dev`, el quickstart §2 entero. Anotar lo visto en `quickstart.md`

**Checkpoint**: las cuatro cosas que el panel pedía del servidor se ven con `curl`. Commit:
`feat(040): el servidor dice quién es el operador, en qué pedido, y qué campo rechazó`.

---

## Phase 3: Los artefactos (tramo 3)

**Purpose**: que `generated/contract/` exista con la forma del consumidor, entre al drift, y que OPE-Web
la copie sin emitir nada.

- [x] T022 [US1] `tests/governance/consumer-artifacts.test.ts` (NUEVO) — **antes del emisor**, sobre
      el bundle real: `identity.json` con la versión y el `sha256` del bundle y sin commit;
      `CONTRACT` igual en los dos módulos; toda operación `admin` del bundle en `OPERATIONS` y ninguna
      de más, en el orden del bundle, con `idempotent` según `x-idempotency`; `CAPABILITIES` igual a la
      unión ordenada; `getOperator` con `capabilities: []`; todo esquema objeto referenciado por un
      `requestBody` `admin` (transitivamente) en `CONSTRAINTS` con su `required`;
      `MerchantCreate.fields.origins` con `minItems`, `maxItems` e `items.maxLength === 255`;
      `CredentialRotation.fields.graceSeconds.minimum === 0`; una propiedad `$ref` como
      `{ type: 'object', ref }`; sin `default` ni `description`; determinismo (dos corridas, mismo texto);
      cabecera `GENERATED by scripts/contract-consumer-artifacts-lib.mjs` en cada archivo
- [x] T023 [US1] `scripts/contract-consumer-artifacts-lib.mjs` (NUEVO) — `generateConsumerArtifacts()`
      → `[file, content][]` con los ocho archivos de `contracts/consumer-artifacts.md` §3, las copias
      producidas a partir de lo que los otros emisores devuelven (no leyendo `generated/` del disco), el
      consumidor en una constante, JSDoc en toda función exportada (`checkJs`)
- [x] T024 [US1] `scripts/contract-types.mjs` y `scripts/contract-types-check.mjs` los escriben y los
      comparan; `npm run contract:types` deja `generated/contract/` y se versiona (`.gitattributes` ya
      cubre `generated/**`); romper a propósito una capacidad en `capabilities.js` y ver que
      `contract:types:check` lo diga
- [x] T025 [P] [US1] `generated/README.md` — la fila de `contract/` (qué es, derivado, quién lo lee:
      OPE-Web por `contract:sync`; verificación: `contract:types:check`, `tests/governance/consumer-artifacts.test.ts`);
      `scripts/README.md` — la fila de `contract-consumer-artifacts-lib.mjs` (clase `librería`);
      `tests/docs/readmes.test.ts` en verde
- [x] T026 [US1] En OPE-Web, contra este backend: `npm run contract:sync` copia los ocho archivos y
      `npx ope-check` pasa; si `conformity` rechaza `getOperator` por la lista vacía, **la línea de R-04**
      en `packages/core/checks/conformity.mjs` de OPE-Web (admitir `[]` cuando el bundle marca
      `x-identifies-principal`), commiteada allá como su propio cambio. Anotar lo visto

**Checkpoint**: SC-001. Commit: `feat(040): generated/contract/ es lo que un consumidor copia`.

---

## Phase 4: Los documentos (tramo 4)

**Purpose**: que lo decidido quede escrito donde se busca, y que la constitución diga lo que el lint y el
código ya hacen.

- [x] T027 [US2] `.specify/memory/constitution.md` — VII acotada a las personas observadas (visitante
      y comprador) con el operador como persona identificada, autenticada y auditada cuyo nombre para
      mostrar se sirve sólo a él; versión **1.5.0**, `Last Amended` 2026-10-09, Sync Impact Report al
      tope (MINOR; la fuente del MVP no cambia de decisión; plantillas sin cambio); `check:instructions`
      e `identifiers` en verde
- [x] T028 [P] `docs/adr/044-el-contrato-para-consumidores.md` — `estado: aceptada`; `docs/adr/031-…`
      gana la nota fechada «el operador tiene nombre para mostrar (feature 040)»;
      `scripts/identifiers-allowlist.json` **pierde** las cinco entradas de la 040 (ya existen)
- [x] T029 [P] [US2] `docs/dominio/operador.md` — el nombre para mostrar, y que no entra al registro;
      `check:glossary` en verde
- [x] T030 [P] `CLAUDE.md` — sólo si alguna tabla nombra qué genera `contract:types` o las muletas;
      `.claude/rules/contrato.md` — la viñeta de `x-required-capabilities` dice la excepción de
      `x-identifies-principal`, y la de `x-invariants` nombra `pointer`
- [x] T031 `specs/040-el-contrato-para-consumidores/quickstart.md` — «Lo corrido» con fecha, incluido
      lo que difirió; `spec.md` con **Status**: construida; en verde `npm run release-check`,
      `npm run contract:check`, `npm run test:durability` y `npm run test:all`

**Checkpoint**: `release-check` en verde con la constitución en 1.5.0. Commit:
`docs(040): cierre — constitución 1.5.0, ADR-044 aceptada, y lo corrido`.

---

## Dependencies

```
Fase 1 (contrato) ──► Fase 2 (servidor) ──► Fase 3 (artefactos) ──► Fase 4 (documentos)
```

- T002 antes de T003; T004 antes de T005; T006 antes de T007 (la fixture falla primero).
- T008 y T009 antes de T013 (`contract:types` los necesita); T010 antes de T011 (el check lee `pointer`).
- T014 antes de T015; T016 antes de T017; T018 antes de T019; T019 antes de T020.
- T022 antes de T023; T023 antes de T024; T024 antes de T026.
- T027 antes de T031 (`release-check` lee la versión).

**En paralelo dentro de una fase**: T002/T004/T006 (fixtures), T008/T009/T010 (archivos del contrato),
T014/T016/T018 (pruebas antes del código), T025 con T024, T028/T029/T030.

## Lo que no se hace, y conviene recordarlo al implementar

- **No se abre un módulo nuevo** por `getOperator`: va en el que ya sirve `admin` y resuelve el token.
- **No se emite el commit** en `identity.json`: lo agrega quien copia.
- **No se pone `pointer`** en un invariante de operación ni se adivina un campo en el borde.
- **No se cambia nada en OPE-Web** más que la línea de `conformity` de R-04, y se hace allá.
- **No se toca Tandilia.**
