---
description: "Task list template for feature implementation"
---

# Tasks: El reparto no se ajusta en silencio

**Input**: Design documents from `/specs/023-reparto-sin-ajuste-silencioso/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/delta.md](./contracts/delta.md)

**Tests**: sí, y son la mitad del trabajo. La spec las pide explícitamente (SC-001, SC-002, SC-003,
SC-007) y `check:invariant-tests` no pasa sin la prueba de la invariante nueva.

**Organization**: por historia, para que cada una se pueda entregar y probar sola. El contrato es la
única fase que bloquea a todas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3
- Toda tarea nombra su archivo

---

## Phase 1: Setup — las dos condiciones de arranque

**Purpose**: confirmar que el terreno es el que el plan supuso. Si alguna falla, la feature se
replantea antes de escribir código, no después.

- [ ] T001 Confirmar la base: `git log --oneline main..HEAD` incluye las cuatro ramas encadenadas
      (020, 021, 022, 023) si el dueño todavía no mergeó, o sale de `main` si ya lo hizo. Anotar cuál
      de las dos es, porque decide contra qué compara `contract:diff`.
- [ ] T002 **Condición de arranque, no trámite**: `grep -n "x-stability" contracts/openapi.yaml` dice
      `building`. **Si no está, parar**: sin la marca, estrechar lo que la operación acepta exige
      versión mayor y prefijo `/v2/`, y eso es otra feature y otra conversación con el dueño.

---

## Phase 2: Foundational — el contrato

**Purpose**: el contrato es la fuente de verdad y el corte. Hasta que los tipos se regeneren no hay
nada que implementar.

**⚠️ CRITICAL**: bloquea las tres historias.

- [ ] T003 `contracts/problem-types.yaml` — agregar el slug `treatment-share-too-fine`, status `422`,
      título «The treatment share is finer than the split can resolve». **No** tocar
      `invalid-treatment-share`: sigue siendo el de fuera de rango, que produce el esquema (research
      R-03).
- [ ] T004 `contracts/components/schemas/ExperimentCreate.yaml` — dos cambios en el mismo archivo:
      la descripción de `treatmentShare` deja de prometer el ajuste («a finer value takes the nearest
      bucket») y declara la regla con su ejemplo (`0.07` sí, `0.075` no); y una entrada nueva en el
      `x-invariants` que ya existe, con `type`, `status`, `rule` y `description` (las cuatro que
      `ope-invariants` exige). **No** agregar `multipleOf`: rechazaría `0.07` (research R-01).
- [ ] T005 `contracts/components/responses/ExperimentUnprocessable.yaml` — el `example` único pasa a
      `examples` con dos: el de los cortes tal cual y el nuevo. Verificado que `ope-no-generic-422`
      lee las dos formas y que esta respuesta la referencia **una sola operación**, así que nada más
      se rompe.
- [ ] T006 `contracts/openapi.yaml` — `info.version` de `1.5.0` a `1.6.0`. El prefijo `/v1/` **no**
      cambia (ADR-003, la marca de T002).
- [ ] T007 `npm run contract:check` y **leer el diff, no contarlo**: tiene que reportar la
      descripción de `treatmentShare`, la invariante nueva y el ejemplo de la `422`. **Ningún campo
      agregado, quitado ni renombrado.** Si aparece un cuarto cambio, parar y revisar qué se tocó de
      más.
- [ ] T008 `npm run contract:types` y confirmar que `generated/problem-types.{js,d.ts}` trae el slug
      nuevo en `ProblemSlug` con su status. **Nunca editar lo generado a mano.**

**Checkpoint**: el contrato declara la regla. `check:invariant-tests` va a fallar hasta T014 y eso es
lo esperado.

---

## Phase 3: User Story 1 - El reparto que se declara es el que ocurre (Priority: P1) 🎯 MVP

**Goal**: una tasa que el reparto no puede representar se rechaza nombrándola, por la API y por la
semilla, en vez de ajustarse al balde más cercano.

**Independent Test**: abrir experimentos por la API con `0.004`, `0.005`, `0.075`, `0.999` y
`0.12345` y verificar que los cinco se rechazan sin dejar experimento abierto; y con los 101 valores
de dos decimales, que se aceptan.

### Implementación

- [ ] T009 [US1] `src/domain/experiment/experiment.ts` — el método estático que juzga, junto a
      `ASSIGNMENT_BUCKETS` y `bucketsOf`. La regla es la ida y vuelta:
      `bucketsOf(share) / ASSIGNMENT_BUCKETS === share`. **Sin epsilon y sin ningún número nuevo**
      (research R-01). Su comentario dice el mecanismo: por qué la ida y vuelta y no la división —
      `0.07 / 0.01` da `7.000000000000001` y rechazaría diez valores legítimos—, que es justo lo que
      el lector no puede reconstruir mirando el código.
- [ ] T010 [US1] `src/domain/experiment/errors.ts` — la clase del error, con
      `readonly code = "treatment-share-too-fine" as const` y `readonly module = MODULE`; agregarla a
      la unión `ExperimentError` del archivo. Sin la unión no compila el `Result` de `Experiment.of`;
      sin la entrada del catálogo (T003) falla la prueba de réplica.
- [ ] T011 [US1] `src/domain/experiment/experiment.ts` — `Experiment.of` aplica la regla **después**
      del rango (`isRate`) y antes del resto. El orden importa: un `1.5` tiene que seguir devolviendo
      `invalid-treatment-share` y no el error nuevo.

### Pruebas

- [ ] T012 [US1] `tests/unit/domain/experiment/experiment.test.ts` — la prueba que sostiene la
      feature: recorre **los 101** valores de dos decimales y los acepta, **y los construye de las
      dos maneras**, calculados (`n / 100`) y parseados desde su literal JSON, porque es como llegan
      por la red. Más los cinco rechazos de SC-001 y el ruido de una suma
      (`0.1 + 0.2 === 0.30000000000000004`), que se rechaza. **Si alguno de los 101 falla, el juicio
      se está haciendo por división**: parar y volver a R-01.
- [ ] T013 [US1] **Correr acá, no al final**:
      `npx vitest run --project fast tests/unit/domain/experiment/assignment-regression.test.ts`.
      Es el único lugar donde esta feature puede cambiar comportamiento sin que nadie lo note. **Si
      la huella cambia, parar** — no se ajusta la prueba.
- [ ] T014 [US1] `tests/integration/admin-experiments.test.ts` — la prueba
      `[invariant:treatment-share-too-fine]` que `check:invariant-tests` exige: abre un experimento
      con `0.075` por la API, verifica `422` con el `type` del catálogo, que el cuerpo nombra el
      campo, y que **no queda ningún experimento abierto** (FR-005: rechazar antes de registrar).
- [ ] T015 [US1] `tests/unit/composition/config.test.ts` — el camino de la semilla: un
      `OPE_MERCHANTS` cuyo experimento declara `0.004` hace que `readConfig` lance un `ConfigError`
      que nombra `merchants[0].experiments[0].treatmentShare`.

**Checkpoint**: US1 entregable sola. El reparto declarado es el que ocurre.

---

## Phase 4: User Story 2 - El holdout que se declara es el que ocurre (Priority: P2)

**Goal**: la misma regla para el holdout, en los tres lugares donde se declara.

**Independent Test**: publicar una configuración de merchant y unos defaults de tratamiento con
`holdoutShare: 0.004` y verificar que los dos se rechazan nombrando el campo; y que con uno así en
un archivo del release el servidor no arranca.

### Implementación

- [ ] T016 [US2] `src/domain/configuration/treatment-values.ts` — `TreatmentValues.judge` aplica la
      regla al `holdoutShare` junto a `isRate`, importando el método estático de
      `domain/experiment/index.js`. Verificado que `CONTEXT_MAP` permite ese import y que no hay
      ciclo. El error es el `InvalidConfigurationValue("holdoutShare", …)` que ya existe, con un
      mensaje que dice la regla; **no** se inventa un slug (research R-03).
- [ ] T017 [US2] `src/domain/experiment/index.ts` — exportar el método sólo si no queda expuesto por
      `Experiment`. Si es un estático de la clase, el `index.ts` ya lo exporta y esta tarea es
      confirmarlo y cerrarla.

### Pruebas

- [ ] T018 [P] [US2] `tests/unit/domain/configuration/levels.test.ts` — `TreatmentValues.judge`
      rechaza `holdoutShare: 0.004` nombrando el campo y acepta `0`, `0.05` y `1`.
- [ ] T019 [P] [US2] `tests/integration/admin-configuration.test.ts` — publicar una versión con
      `declared: { holdoutShare: 0.004 }` responde `422 invalid-configuration-value` apuntando a
      `holdoutShare`, y **no se crea ninguna versión**.
- [ ] T020 [US2] `tests/unit/composition/config.test.ts` — un `OPE_TREATMENT_DEFAULTS` con
      `holdoutShare: 0.004` hace que `readConfig` lance nombrando `treatmentDefaults.holdoutShare`.

**Checkpoint**: US1 y US2 funcionan solas y juntas.

---

## Phase 5: User Story 3 - Ningún valor ya escrito queda escondido (Priority: P3)

**Goal**: saber, antes de que la regla empiece a rechazar, si algo ya escrito la viola.

**Independent Test**: recorrer las tasas versionadas y arrancar el servidor.

- [ ] T021 [P] [US3] Recorrer las tasas cuantizadas de `config/treatment-defaults.json` y
      `config/dev-merchants.json` **valor por valor, no con una regla**, y confirmar que cada una
      resuelve exactamente a un balde. Si alguna no, corregirla **y decir cuál era** en el commit:
      es un hallazgo, no un trámite.
- [ ] T022 [P] [US3] Lo mismo con los fixtures de `tests/unit/composition/fixtures/` y los helpers
      (`tests/helpers/test-app.ts`). **No tocar** `tests/audit/fixtures/`: son entradas deliberadas
      de la skill de auditoría.
- [ ] T023 [US3] `npm run build && npm run dev` con la configuración de desarrollo: el servidor
      arranca y responde. Es la prueba de que ningún valor del repositorio quedó del lado
      equivocado de la regla.

**Checkpoint**: las tres historias, cada una verificable sola.

---

## Phase 6: Cierre y documentación

- [ ] T024 `tests/unit/domain/commercial/commercial-policy.test.ts` y
      `tests/unit/domain/experiment/experiment.test.ts` — la prueba de que **la feature no se
      derramó** (SC-007): un `marginShare: 0.375`, un `incentiveLadderShare: [0.125]` y un
      `cuts: [0.125]` siguen siendo válidos. Nadie los cuantiza, así que la regla no les toca
      (research R-06). Sin esta prueba, el próximo que lea el código extiende la regla «por
      coherencia» y rompe configuraciones legítimas.
- [ ] T025 `docs/adr/035-una-sola-unidad-para-las-tasas.md` — la enmienda: qué tasa es **declarable**,
      por qué la ida y vuelta y no el epsilon ni `multipleOf`, y por qué esto va acá y no en un ADR
      nuevo (la 022 sacó la ambigüedad de unidad, ésta la de representabilidad; son la misma
      pregunta). Registrar que reemplaza a FR-008 de la spec. Citar ADR-022 y ADR-024.
- [ ] T026 [P] `CLAUDE.md` — la convención de tasas de ADR-035 gana una oración: una tasa es una
      fracción de 1 **y**, si algo la cuantiza, una que resuelva exactamente a su balde. Nombrar el
      método que la juzga.
- [ ] T027 [P] `contracts/README.md` — sólo si la tabla de extensiones o el inventario cambian. Es
      probable que no: no hay extensión `x-*` nueva, sólo una entrada más en una que ya está.
- [ ] T028 `specs/023-reparto-sin-ajuste-silencioso/quickstart.md` — correr el quickstart entero y
      dejar su tabla de estado fechada, con las aserciones preexistentes que hayan cambiado
      enumeradas una por una.
- [ ] T029 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `test:contract`, `release-check` (**avisa por la marca de construcción: es lo
      esperado**).
- [ ] T030 `npm run test:mutation` en verde sobre las líneas cambiadas. **Atención al mutante
      previsible**: la comparación de T009 es una línea, y un mutante que la convierta en `true`
      sobrevive si la prueba sólo verifica aceptaciones. T012 tiene que matarlo con los rechazos.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: T002 es una **condición de arranque**. Sin la marca de construcción la feature se
  replantea.
- **Contrato (F2)**: **bloquea todo**. T003 → T004 → T005 pueden ir en cualquier orden entre sí, pero
  los tres antes de T007, y T007 antes de T008.
- **US1 (F3)**: después de F2. T009 → T010 → T011 en orden (el error antes de usarlo); T012 después
  de T011; T013 en cuanto T011 esté.
- **US2 (F4)**: después de F2 y de T009 (necesita el método). **No** necesita nada de US1.
- **US3 (F5)**: después de US1 y US2, porque recién ahí la regla rechaza.
- **F6**: al final. T025 necesita el diseño ya implementado.

### Paralelismo real

- T003, T004, T005: archivos distintos del contrato.
- T018 y T019: dos archivos de prueba.
- T021 y T022: dos conjuntos de datos.
- T026 y T027: dos documentos.
- **US2 completa contra US1 completa**, si hubiera dos personas: sólo comparten T009.

---

## Implementation Strategy

### MVP: US1 sola

F1 → F2 → F3 y parar. Con eso el agujero grave está cerrado: ningún experimento se abre con un
reparto que no es el que va a ocurrir. US2 y US3 agregan valor sin cambiar nada de lo anterior.

### Commits

Uno por fase, en español. El del contrato va separado del código a propósito: son los dos lugares
donde un error se ve distinto.

---

## Notes

- **El juez de "no cambió nada" es la prueba de regresión de la asignación** (T013). Se corre en
  medio de US1, no al final.
- **La prueba de los 101 valores es la que decide si el diseño está bien implementado.** Si hay que
  agregarle un epsilon para que pase, la regla se implementó por división: volver a R-01.
- **`check:invariant-tests` va a fallar entre T004 y T014**, y está bien. No es motivo para adelantar
  la prueba ni para sacar la invariante.
- **Redocly ya emite cuatro avisos de `no-invalid-media-type-examples`** en el contrato actual. Si
  T005 agrega un quinto, el ejemplo nuevo no valida contra `ProblemDetails`: arreglar el ejemplo, no
  silenciar el aviso.
- No tocar `tests/audit/fixtures/`: son entradas deliberadas de la skill de auditoría.
