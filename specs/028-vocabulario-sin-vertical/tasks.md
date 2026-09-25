---
description: "Task list template for feature implementation"
---

# Tasks: El vocabulario deja de nombrar una prenda

**Input**: Design documents from `/specs/028-vocabulario-sin-vertical/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/delta.md](./contracts/delta.md),
[quickstart.md](./quickstart.md)

**Tests**: sí. En un renombre las pruebas no son el entregable, son **el control**: lo que hay que
demostrar es que nada cambió de comportamiento, y eso sólo lo dice una prueba que ya existía y sigue
en verde con el nombre nuevo.

**Organization**: por historia. El orden de seis pasos de toda feature que toca HTTP rige dentro de
cada una: mapa → contrato → `contract:check` → tipos → código → gates. **Los tipos generados nunca se
editan a mano.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3
- Toda tarea nombra su archivo

---

## Phase 1: Setup — lo que va antes del contrato

- [ ] T001 [P] `docs/dominio/anclaje.md` — la nota deja de listar un anclaje que nombra una prenda y
      pasa a listar los cuatro nuevos. ADR-008: la nota va **antes** de que el sustantivo entre al
      contrato, no después.
- [ ] T002 [P] `docs/dominio/eventos/interaccion-con-selector-de-talle.md` — **el archivo se
      renombra** y la nota explica qué control es, no qué atributo elige ese control en un rubro. El
      nombre del archivo es parte de la nota: uno que nombra una prenda es la misma deuda en el
      índice.
- [ ] T003 `contracts/api-map.yaml` — **verificar que no cambia**: ninguna operación se agrega, se
      retira ni cambia de forma. Es el paso 0 del orden de seis y acá la respuesta es «nada que
      hacer», que también hay que comprobar. `check:api-map` es el gate.

**Checkpoint**: el glosario ya nombra lo que el contrato va a decir.

---

## Phase 2: User Story 1 - El control que elige variante se llama por lo que hace (Priority: P1) 🎯 MVP

**Goal**: el punto de anclaje y el evento dejan de nombrar una prenda, el contrato deja de deberle un
anclaje a la fuente, y el campo que ninguna autoridad leía se va.

**Independent Test**: el vocabulario de anclajes y de eventos no contiene ningún nombre de prenda; la
misma secuencia de señales produce la misma decisión; y la cuenta de anclajes coincide con la fuente.

### El contrato

- [ ] T004 [US1] `contracts/components/schemas/Anchor.yaml` — el enum pasa a
      `[variant_selector, price, cta, policies]` y la descripción deja de hablar de talles.
- [ ] T005 [US1] `contracts/components/schemas/AnchorMap.yaml` — las claves del mapa siguen al enum.
- [ ] T006 [US1] `contracts/components/schemas/SizeSelectorInteracted.yaml` → **renombrar el archivo**
      a `VariantSelectorInteracted.yaml`, el `enum` del discriminador al tipo nuevo, y **eliminar** la
      propiedad que lleva la etiqueta del talle junto con su entrada en `required` (R-03). El evento
      queda sin campos propios.
- [ ] T007 [US1] `contracts/components/schemas/Event.yaml` — la entrada del `discriminator.mapping` y
      el `$ref` del `oneOf` siguen al archivo nuevo. Si uno se mueve y el otro no, `contract:lint`
      falla: es la prueba de que el mapping y la unión no se desincronizan.
- [ ] T008 [P] [US1] Los ejemplos y descripciones que nombran el anclaje o el evento:
      `contracts/examples/event-batch.yaml`, `contracts/examples/exposure-confirmation.yaml`,
      `contracts/paths/sdk-config.yaml`, `contracts/paths/sdk-diagnostics.yaml`,
      `contracts/paths/admin-diagnostics.yaml`, `contracts/paths/admin-configuration.yaml`.
- [ ] T009 [US1] `contracts/openapi.yaml` — `info.version` a la **MINOR** siguiente. El cambio es
      incompatible y entra por la marca `info.x-stability: building` (ADR-003): `contract:diff` lo
      reporta y lo acepta, `release-check` avisa.
- [ ] T010 [US1] `npm run contract:check` y `npm run contract:types`. **Nunca editar lo generado.**

### El código

- [ ] T011 [US1] `src/domain/shared-kernel/intervention.ts` — `ANCHORS`.
- [ ] T012 [US1] `src/domain/ingestion/event.ts` — `EVENT_TYPES` y la interfaz del evento, que pierde
      su único campo propio y queda como `EventBase<…>`, igual que `product_viewed`.
- [ ] T013 [US1] `src/domain/barrier/signals.ts` — el caso del `switch` exhaustivo. **No compila si
      falta**, que es exactamente el punto de que sea exhaustivo.
- [ ] T014 [US1] `src/domain/selection/candidate.ts` — las familias de candidatos que llevan el
      anclaje en su identificador.
- [ ] T015 [US1] `src/interface-adapters/ingestion/controllers/ingest-events.ts` — la traducción del
      DTO, que deja de leer el campo eliminado.

### La configuración

- [ ] T016 [US1] `config/treatment-defaults.json` — la regla que cuenta interacciones con el selector
      y **su identificador** (`fit.size-selector-twice` → `fit.variant-selector-twice`), y la de
      devoluciones que nombra la duda de talle. Un identificador que nombra una prenda es la misma
      deuda con otra ropa, y éstos viajan al ledger como el motivo de la barrera.
- [ ] T017 [US1] `config/messages.json` — las tres familias del anclaje renombrado, **cada texto con
      una versión nueva** (R-06). El texto no cambia; el identificador sí, porque lleva la familia
      adentro y conservarlo dejaría un identificador nombrando una familia que no existe. Unificar de
      paso el formato, que hoy convive en dos estilos en el mismo archivo.

### Pruebas de US1

- [ ] T018 [P] [US1] `tests/contract/` — las réplicas del kernel (`ANCHORS`, `EVENT_TYPES`) contra el
      contrato. Si una se renombró y la otra no, esto falla; no hay que escribir nada nuevo, hay que
      verlo fallar antes y pasar después.
- [ ] T019 [US1] `tests/integration/decision-plane.test.ts` y `tests/unit/application/barrier/` — **la
      prueba que importa más que todas las demás**: la misma secuencia de señales produce la misma
      barrera, la misma confianza, el mismo escalón y el mismo anclaje. Un renombre que cambia una
      decisión no es un renombre.
- [ ] T020 [P] [US1] `tests/integration/ingest-events.test.ts` — un evento con el nombre viejo, y uno
      con el nombre nuevo **más el campo eliminado**, reciben `400` nombrando el campo. Es lo que
      convierte «el vocabulario es cerrado» en algo verificable.
- [ ] T021 [US1] El resto de `tests/` que nombra el vocabulario viejo. Son las que más ocurrencias
      tienen (R-00) y ninguna cambia de intención: cambian de palabra.

**Checkpoint**: el SDK y el backend hablan de variantes, y ninguna decisión se movió.

---

## Phase 3: User Story 2 - El bloque de la página no nombra una prenda (Priority: P2)

**Goal**: el vocabulario de bloques nombra lugares de cualquier ficha, no de una de ropa.

**Independent Test**: ningún miembro nombra un concepto de una vertical, y una sesión que permanecía
en ese bloque sigue produciendo la misma barrera.

- [ ] T022 [US2] `contracts/components/schemas/BlockDwelled.yaml` — el enum del bloque: el miembro que
      nombra una prenda pasa a `specifications`, que nombra el mismo lugar en cualquier rubro (R-04).
- [ ] T023 [US2] `npm run contract:check` y `npm run contract:types`.
- [ ] T024 [US2] `src/domain/ingestion/event.ts` — `BLOCKS`.
- [ ] T025 [US2] `config/treatment-defaults.json` — las reglas que nombran ese bloque y **sus
      identificadores**: la de lectura de la guía y la condición negada de la regla de devoluciones.
- [ ] T026 [P] [US2] `tests/contract/` — la réplica de `BLOCKS` contra el contrato.
- [ ] T027 [US2] `tests/unit/domain/barrier/` y `tests/integration/` — permanecer en el bloque
      renombrado infiere la misma barrera con la misma confianza que antes.

**Checkpoint**: el vocabulario de lugares sirve para una heladera.

---

## Phase 4: User Story 3 - El tope de barreras dice lo que significa (Priority: P3)

**Goal**: el esquema deja de declarar un número que el tipo ya garantiza.

**Independent Test**: se puede explicar en una frase qué limita el esquema sin usar el número tres con
dos sentidos distintos, y una configuración con todas las barreras se acepta.

- [ ] T028 [US3] `contracts/components/schemas/MerchantConfigurationDeclared.yaml` — **borrar
      `maxItems`** del campo de barreras; `minItems: 1` y `uniqueItems: true` se quedan, y la
      descripción dice qué limita sin depender de cuántas barreras existan hoy. El tope no se
      reemplaza por otro número: con `uniqueItems` sobre un enum de tres, una lista de más de tres no
      puede existir (R-07).
- [ ] T029 [US3] `npm run contract:check` y `npm run contract:types`.
- [ ] T030 [P] [US3] `tests/integration/admin-configuration.test.ts` — una configuración con todas las
      barreras se acepta; una con una repetida se rechaza por `uniqueItems`, como antes; y una con
      ninguna, por `minItems`. Lo que se prueba es que **borrar el tope no aflojó nada**.

**Checkpoint**: el límite se mueve solo el día que exista una cuarta barrera.

---

## Phase 5: Cierre

- [ ] T031 `.specify/memory/constitution.md` — la enmienda **PATCH** con sus dos viñetas (R-08). La
      primera la causa esta feature: la glosa de la barrera sigue a la fuente, que Governance permite
      **porque el documento fuente cambió**. La segunda es hallazgo y no alcance: la viñeta `Escalas`
      contradice a ADR-035 desde la feature 022. **Confirmar con el dueño antes de escribirla**; si
      prefiere separarla, sale de acá y entra como fila en `docs/deudas.md` con el motivo.
      Sync Impact Report arriba del archivo, como las enmiendas anteriores.
- [ ] T032 `docs/adr/0NN-*.md` — el ADR que registra **la enmienda de la fuente del 2026-09-25**: qué
      se cambió de `01`, `02` y `03`, por qué ninguna decisión cambió de contenido, y el criterio que
      separó lo que un documento decide de lo que ejemplifica. Precedente: ADR-030, que registra
      decisiones de producto del dueño. Se escribe **al cerrar**, cuando los identificadores que
      nombra existen (`check:identifiers`).
- [ ] T033 `docs/deudas.md` — D-14 a `implementada` con su commit, y su narrativa apuntando al ADR de
      T032. D-16 y D-17 quedan abiertas: esta feature no las toca.
- [ ] T034 `CLAUDE.md` y `.claude/rules/` — **sólo si hace falta**, con el criterio de admisión: ¿hace
      falta en toda sesión, es un procedimiento, o es de una parte del código? La hipótesis es que no
      hace falta nada: el criterio de qué vocabulario es de quién ya está en `.claude/rules/contrato.md`
      desde la 027. `check:instructions` verifica la clasificación en los dos sentidos.
- [ ] T035 `npm run check:glossary`, `check:invariant-tests`, `check:identifiers`, `check:api-map`,
      `check:language`, `check:behaviour-constants`, `check:ports-bound` — los siete, uno por uno,
      antes de la cadena completa.
- [ ] T036 Correr el quickstart **entero**, sus nueve pasos, y dejar su tabla de estado **fechada**.
      El paso 9 no lo decide ningún comando: leer los dos enums como si uno vendiera heladeras.
- [ ] T037 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `build`, `test`,
      `test:tools`, `contract:check`, `test:contract`, `release-check`. **`build` antes de
      `test:contract`**: con un `dist/` viejo se prueba el servidor anterior y el error culpa al
      código de hoy.
- [ ] T038 `npm run test:mutation`. Por historia, el gate acotado
      (`--files <archivo>:<desde>-<hasta>`) mientras el código está fresco; la corrida completa del
      diff, al cierre. Ante un superviviente, la skill `triaging-mutants`.
- [ ] T039 **El canario**: `grep -rnE "size_selector|size_guide" src/ contracts/ config/` tiene que
      dar **nada**. Mientras quede una ocurrencia, la feature no está hecha. En la 027 este paso
      encontró lo único que quedaba, así que no es ceremonia.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: el glosario va **antes** del contrato (ADR-008). T001 y T002 son paralelas; T003 es
  una verificación y no bloquea a nadie.
- **US1 (F2)**: la MVP. Dentro, el orden es inamovible: contrato (T004–T009) → tipos (T010) → código
  (T011–T015) → configuración (T016–T017) → pruebas (T018–T021).
- **US2 (F3)**: independiente de US1 —toca otro enum y otras reglas— y podría ir antes. Va después
  porque US1 es la que tiene la deuda del anclaje faltante y el campo muerto, y porque compartir el
  mismo `contract:types` una sola vez sale más barato que dos.
- **US3 (F4)**: independiente de las dos. Toca un esquema que ninguna de las otras toca.
- **F5**: al final. T032 después de que existan los identificadores; T039 antes de declarar la feature
  terminada.

### Paralelismo real

- T001 con T002.
- T008 con el resto del contrato de US1 sólo si son archivos distintos (lo son).
- T018, T020, T026 y T030 son pruebas de archivos distintos.
- **US2 y US3 se pueden hacer en cualquier orden entre sí**, y las dos después de US1 por el costo del
  ciclo de tipos, no por dependencia.

---

## Implementation Strategy

### El MVP es US1

US1 sola ya entrega lo que la feature promete: el vocabulario que un integrador de otro rubro lee
primero —anclajes y eventos— deja de nombrar una prenda, y de paso desaparecen una deuda y un campo
muerto. US2 y US3 son mejoras del mismo criterio sobre superficies más chicas.

### Commits

Uno por historia, en español, con las pruebas en verde. El cierre puede llevar más de uno: la
enmienda de la constitución y el ADR son cambios distintos de la implementación y se leen mejor
separados.

---

## Notes

- **En un renombre, la prueba que vale es la que ya existía.** Escribir pruebas nuevas para un
  renombre es fácil y no prueba nada: lo que demuestra que no se rompió el comportamiento es que la
  suite anterior pase con el nombre nuevo y **sin cambiar ninguna expectativa de comportamiento**. Si
  una prueba necesita cambiar lo que espera, no era un renombre.
- **El campo eliminado es la única parte que no es un renombre.** Quita un dato del contrato, así que
  tiene su propia prueba (T020) y su propia línea en el ADR: el resto de la feature se puede leer como
  «lo mismo con otros nombres», y esto no.
- **Lo que este plan no puede verificar**: que `specifications` sea el mejor nombre para el bloque en
  un rubro que nadie observó todavía. `03 §9` dice que el piloto no va a contestar eso. Lo que sí se
  puede afirmar es que el nombre viejo era de indumentaria y éste no.
