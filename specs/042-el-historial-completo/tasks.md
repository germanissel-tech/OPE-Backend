---
description: "Task list for feature 042 — el historial completo"
---

# Tasks: El historial completo

**Input**: `specs/042-el-historial-completo/` (spec.md, plan.md, research.md, data-model.md,
contracts/historial.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.1, sin enmiendas); research.md con
los ocho hallazgos.

**Tests**: sí, y preceden a la implementación: la regla antes de la entidad, la integración de cada
lectura antes de tocar su caso de uso y su presentador, la de aislamiento antes de la operación nueva.

**Organization**: por **tramo** del plan, porque el orden de `contrato.md` manda (el contrato antes que
el servidor). Cada tarea lleva la historia que sirve: US1 el historial dice qué reinició, US2 la versión
del merchant por número.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 · US2
- Cada tarea nombra su archivo

---

## Phase 1: El contrato (tramo 1)

**Purpose**: que el contrato diga lo que toda lectura trae antes de que el servidor lo haga. La
operación nueva entra en el tramo 4, con quien la sirve: `bootstrap` se niega a arrancar si el
contrato declara una operación que ningún módulo sirve, y un commit no entra sin las pruebas en verde.

- [x] T001 [P] [US1] `contracts/components/schemas/MerchantConfigurationVersion.yaml`:
      `windowsRestarted`, opcional, la definición de `PlatformConfigurationVersion` (`uniqueItems`,
      `ExperimentId`), y la descripción de §3
- [x] T002 [P] [US1] `PlatformConfigurationVersion.yaml`, `TreatmentDefaultsVersion.yaml`,
      `TextVersion.yaml`: la descripción de `windowsRestarted` dice que toda lectura lo trae (§4)
- [x] T003 `npm run contract:check` en verde, sin cambio incompatible en `contract:diff`; después
      `npm run contract:types` (pasos 2 y 3); `info.version: 1.14.0`. Commit:
      `feat(042): el contrato — la versión del merchant declara lo que reinició`

**Checkpoint**: el bundle tiene el campo; `npm test` en verde (el campo es opcional y nadie lo manda todavía).

---

## Phase 2: La pregunta (tramo 2)

**Purpose**: que el módulo de experimentos conteste qué experimentos reinició una versión (research
R-01 a R-03).

- [x] T004 [P] [US1] `tests/unit/domain/experiment/` (el archivo de la entidad): `restartedBy` —
      verdadero con el mismo `level` y `configurationVersion`; falso con otro número u otro nivel; un
      reinicio de texto no responde por una causa sin texto del mismo número, ni al revés; con texto,
      cuentan `family`, `attributeValue` (ausente en los dos o igual), `locale` y `layer`; un
      experimento sin reinicios, falso
- [x] T005 [US1] `src/domain/experiment/experiment.ts`: `restartedBy(source: RestartSource): boolean`,
      con el comentario de la regla (data-model §1)
- [x] T006 [P] [US1] `src/application/experiment/ports/experiment-store.ts`: `all()`, que devuelve `readonly Experiment[]` («todo experimento de todo merchant, el más viejo primero»);
      `interface-adapters/experiment/gateways/memory-experiment-store.ts` la implementa; el durable la
      delega en su índice, como `get` y `listOf`
- [x] T007 [P] [US1] `tests/unit/application/experiment/`: `WindowRestarts.restartedBy` — encuentra un
      experimento reiniciado y cerrado después; con `merchantId`, sólo los de ese merchant; sin
      coincidencias, vacío
- [x] T008 [US1] `src/application/experiment/services/window-restarts.service.ts`:
      `restartedBy(source, merchantId?)` en la interfaz y en la clase, sobre `experimentStore.all()`;
      exportado por `application/experiment/index.ts`
- [x] T009 [P] [US1] `tests/durability/experiment-store.test.ts`: después de reiniciar el almacén,
      `all()` trae los experimentos con sus reinicios, y `restartedBy` los encuentra

**Checkpoint**: `npm test` y `npm run test:durability` en verde; la regla, con su mutación.

---

## Phase 3: Las lecturas globales y de textos (tramo 3)

**Purpose**: US1 en plataforma, defaults y textos.

- [ ] T010 [P] [US1] `tests/integration/levels-history.test.ts` — **antes del código**: con un
      experimento activo, una correctiva de plataforma que lo alcanza; la lista en la respuesta de
      publicar, en repetir el mismo cuerpo (`200`), en `listPlatformConfigurationVersions` y en
      `getPlatformConfigurationVersion`; lo mismo con defaults; una versión normal sin el campo; cerrar
      el experimento no cambia la lista
- [ ] T011 [US1] `src/application/configuration/use-cases/list-level-versions.use-case.ts` y
      `get-level-version.use-case.ts`: devuelven, por versión, `{ version, windowsRestarted }`
      preguntando a `WindowRestartsService` por `{ level, configurationVersion }`; dependencia nueva
      `restarts`
- [ ] T012 [US1] `publish-level.use-case.ts`: la rama `repeated` pregunta lo mismo en vez de `[]`
      (research R-04); como la dependencia `reached` ya envuelve `restarts`, `ReachedExperimentsService`
      gana `restartedBy(version)` y el caso de uso sigue en cuatro dependencias
- [ ] T013 [US1] `src/interface-adapters/configuration/presenters.ts`: `levelHistoryPage` y
      `levelVersionAnswer` usan la lista que trae la lectura; ningún `windowsRestarted: []` queda en el
      archivo
- [ ] T014 [P] [US1] `tests/integration/messages/base-text.test.ts` y `merchant-text.test.ts` — **antes
      del código**: lo mismo de T010 para un texto de la plataforma y uno de un merchant; un texto y una
      versión de configuración con el mismo número no se mezclan; dos textos de claves distintas con el
      mismo número, tampoco
- [ ] T015 [US1] `src/application/messages/services/reached-by-text.service.ts`: la causa de un
      reinicio de texto se arma en una función (`restartCauseOf(version)`) que usan `restart` y la
      lectura, y el servicio gana `restartedBy(version)`
- [ ] T016 [US1] `src/application/messages/use-cases/`: `list-text-versions`, `get-text-version`,
      `list-merchant-text-versions`, `get-merchant-text-version` devuelven la lista por versión;
      `publish-text` y `publish-merchant-text` la preguntan al repetir
- [ ] T017 [US1] `src/interface-adapters/messages/presenters.ts`: sin `windowsRestarted: []`; la página
      y la versión usan lo que trajo la lectura
- [ ] T018 [US1] `src/composition/modules/configuration.ts` y `messages.ts`: las dependencias nuevas

**Checkpoint**: T010 y T014 en verde; `npm test` entero.

---

## Phase 4: El merchant (tramo 4)

**Purpose**: US1 en la configuración del merchant, y US2. La operación entra al contrato acá (pasos
0 a 3 de `contrato.md`), y se commitea con su controller.

- [ ] T019 [US2] `contracts/api-map.yaml`: `getMerchantConfigurationVersion` (`method: get`,
      `path: /v1/admin/merchants/{merchantId}/configuration/versions/{version}`, `consumer: admin`,
      `tag: admin`, `capabilities: [configuration:read]`, `status: planned`, `roadmap: admin-panel`,
      `source: specs/042-el-historial-completo/spec.md`), después de `listConfigurationVersions`
      (paso 0 de `contrato.md`)
- [ ] T020 [P] [US2] `contracts/paths/admin-configuration-version.yaml` (NUEVO) según
      `contracts/historial.md` §2, con `admin-platform-configuration-version.yaml` como molde:
      `merchantId` y `version` (`integer`, `minimum: 1`), `200` `MerchantConfigurationVersion` con un
      ejemplo de una correctiva que reinició `exp_…`, `400`, `401`, `403` (`MerchantForbidden`), `404`
      (`ConfigurationVersionNotFound`); `contracts/openapi.yaml`: la ruta; `contract:check` y `contract:types`
- [ ] T021 [P] [US1] [US2] `tests/integration/admin-configuration.test.ts` — **antes del código**: la
      correctiva del merchant con su experimento activo trae la lista al publicar, al repetir y en
      `listConfigurationVersions`; `getMerchantConfigurationVersion` de la 2 de tres (lo que declaró,
      correctiva, motivo, instante, operador, la lista), de la 4 (`404 configuration-version-not-found`)
      y de la `0` (`400`)
- [ ] T022 [P] [US2] `tests/integration/isolation.test.ts`: la versión por número de un merchant fuera
      del alcance responde `403 merchant-out-of-scope` igual exista o no; la versión 1 de un merchant
      no trae el experimento de otro que también publicó su versión 1 correctiva
- [ ] T023 [US2] `src/application/configuration/ports/configuration-store.ts`:
      `versionOf(merchantId, version)`; `gateways/sqlite-configuration-store.ts` con su consulta
      (data-model §4) y `gateways/memory-configuration-store.ts`
- [ ] T024 [P] [US2] `tests/durability/configuration-store.test.ts`: `versionOf` después de reiniciar
      el almacén; otro merchant con el mismo número no se cruza
- [ ] T025 [US1] `publish-merchant-configuration.use-case.ts`: `windowsRestarted` en la respuesta
      (data-model §5), con el `windowRestarted` del registro intacto;
      `list-configuration-versions.use-case.ts`: la lista por versión, preguntando con el merchant
- [ ] T026 [US2] `src/application/configuration/use-cases/get-merchant-configuration-version.use-case.ts`
      (NUEVO, según `.claude/rules/caso-de-uso.md`): `scoped`, `store`, `restarts`; alcance, versión,
      `ConfigurationVersionNotFound("merchant", n)`
- [ ] T027 [US2] `src/interface-adapters/configuration/controllers/get-merchant-configuration-version.ts`
      (NUEVO, `OperationHandler<"getMerchantConfigurationVersion">`); el presentador de la versión del
      merchant con la lista, para las cuatro respuestas que la llevan; exportado por el `index.ts` del
      módulo
- [ ] T028 [US2] `src/composition/modules/configuration.ts`: el handler servido; `api-map.yaml`:
      `built`, `feature: "042"` en lugar de `roadmap`

**Checkpoint**: T021 y T022 en verde; el servidor arranca con la operación nueva.

---

## Phase 5: El cierre (tramo 5)

- [ ] T029 La cadena: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm test`,
      `npm run test:durability`, `npm run test:mutation` (sin mutantes vivos en lo nuevo, ADR-016),
      `npm run test:contract`, `npm run release-check`
- [ ] T030 El quickstart a mano contra `npm run dev` (los siete pasos), con «Lo corrido» fechado;
      romper a propósito lo de la tabla «Romperle algo»
- [ ] T031 [P] `spec.md`: **Status**: Construida; `contracts/README.md` o el README que lo pida si el
      inventario de `tests/docs` lo exige; `docs/dominio/` no cambia (sin sustantivo nuevo)

**Checkpoint**: todo en verde. Commit: `docs(042): cierre — lo corrido y el estado`. Push y PR.

---

## Dependencies

```text
Tramo 1 ──► Tramo 2 ──► Tramo 3
                   └──► Tramo 4 ──► Tramo 5
```

- T003 antes de todo `src/`; T019 antes de T020 (el mapa antes que el contrato), los dos antes de T027.
- T005 antes de T008; T008 antes de T011, T015, T025 y T026.
- T010 antes de T011–T013; T014 antes de T015–T017; T021 y T022 antes de T023–T027.
- Los tramos 3 y 4 son independientes entre sí después del 2.

## Lo que no se hace, y conviene recordarlo al implementar

- **No se guarda nada en la versión** (research R-01): ni columna, ni campo del documento.
- **No se agrega el merchant a `RestartSource`** (research R-03): el filtro va en la pregunta.
- **El booleano `windowRestarted`** que lee el registro de administración no cambia.
- **El testigo de concurrencia** es la 043.
