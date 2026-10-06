---
description: "Task list for feature 039 — la durabilidad se verifica en CI"
---

# Tasks: La durabilidad se verifica en CI

**Input**: `specs/039-durabilidad-en-ci/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.4.5); research.md con los cinco hallazgos.

**Tests**: sí, y son el entregable tanto como el código: esta feature es sobre la cadena de verificación, así
que cada pieza nueva lleva su prueba y **la prueba va primero donde hay una regla**.

**Organization**: por historia. Las tres son independientes una vez hecha la fase 1, y la 1 y la 2 son las
que cierran el hueco.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: a qué historia pertenece (US1, US2, US3)
- Cada tarea nombra su archivo

---

## Phase 1: El mecanismo (bloquea las tres historias)

**Purpose**: la declaración de mediciones y los dos proyectos que la leen. Sin esto, ninguna historia tiene
dónde pararse.

- [x] T001 `vitest.config.ts` — la **declaración de mediciones** como constante exportada
      (`MEASURED_SUITES`), con las seis rutas que hoy viven escritas a mano en la configuración de mutación
      (R-02) y un comentario que diga la frontera: **si el resultado puede cambiar porque la máquina está
      ocupada, es una medición**. Rutas de archivo, no globs, porque una ruta se verifica contra el disco
      (data-model).
- [x] T002 `vitest.config.ts` — el proyecto `durability` **excluye** las mediciones y un proyecto nuevo
      (`measures`) incluye **sólo las de durabilidad**. Los dos salen del **mismo objeto de configuración**
      —`fileParallelism: false`, timeouts, temporal por archivo— para que FR-009 valga por construcción y no
      por una copia que alguien recuerde actualizar (R-03).
- [x] T003 `vitest.mutation.config.ts` — importa `MEASURED_SUITES` en vez de repetir los seis nombres. El
      comentario que explica por qué se excluyen se queda (es el motivo, no la lista) y pierde los nombres.
- [x] T004 `package.json` — `test:durability` sigue siendo el comportamiento (ahora sin las mediciones) y
      `test:measures` corre el proyecto nuevo. `test:all` **no cambia**: el cierre local de una historia sigue
      corriendo todo, mediciones incluidas (quickstart, paso 5).
      **Y obligó a adelantar parte de T019**: `check:instructions` verifica los comandos en los dos sentidos,
      así que agregar `test:measures` a `package.json` sin su fila en la tabla de CLAUDE.md pone `contract:check`
      en rojo — abrir un comando obliga a documentarlo, que es para lo que ese gate existe.
- [x] T005 Verificación de la fase, medida el 2026-10-06: `npm run test:durability` **20 archivos, 193
      pruebas, 143 s** (era 23 / 197 / 207); `npm run test:measures` **3 archivos, 4 pruebas, 38 s**;
      `npm run test:all` **225 archivos, 1995 pruebas** — los mismos que antes, que es SC-005.

**Checkpoint**: las dos categorías existen y se pueden correr por separado. Nada de CI todavía.

---

## Phase 2: User Story 1 — Un cambio que rompe un gateway durable no entra (P1) 🎯 MVP

**Goal**: lo que decide si un cambio entra ejecuta la durabilidad de comportamiento, siempre, en un lugar que
se nombra solo.

**Independent Test**: quickstart paso 4 — romper a propósito la rehidratación de una entidad en un gateway
durable y ver que falla nombrando la durabilidad.

- [x] T006 [US1] `tests/hooks/ci.test.ts` — **antes del workflow**: el job de durabilidad existe, corre
      `npm run test:durability`, tiene la misma condición de disparo que `checks` y `mutation` (no en el
      schedule; no en una PR del mismo repositorio) y **no** declara `fetch-depth: 0` ni trae `main`, porque no
      compara contra nada. Que falle antes de T007 es parte de la verificación.
- [x] T007 [US1] `.github/workflows/ci.yml` — el job, en paralelo a los otros dos: checkout, Node de
      `.nvmrc` con caché de npm, `npm ci`, `npm run test:durability`. `timeout-minutes` con margen sobre los
      ~165 s de esta máquina. Sin artefactos: no hay reporte que leer.
- [x] T008 [US1] El encabezado del workflow (el comentario que dice qué hace cada job y por qué) nombra el
      tercero y dice **por qué está aparte**: que un rojo diga qué falló. Hoy ese comentario dice «dos jobs».
- [x] T009 [US1] Verificación de la historia, de punta a punta en local: romper la rehidratación de una
      entidad en un gateway durable, correr `npm run test:durability`, ver el rojo, y restaurar. Hecho el
      2026-10-06 sobre `sqlite-order-ledger.ts`: lo atraparon **tres** pruebas de `tests/durability/outcomes.test.ts`
      —la lectura, la idempotencia de la notificación y la de la devolución— y **ninguna del proyecto `fast`**,
      que es el motivo por el que esta suite es la única cobertura de esos gateways. Anotado en el quickstart.

**Checkpoint**: la durabilidad se verifica en CI con nombre propio, y no depende del arranque de la mutación.

---

## Phase 3: User Story 2 — Ninguna prueba corre en ningún lado (P1)

**Goal**: un archivo de durabilidad que no esté en ninguna de las dos categorías rompe el build, y una
medición declarada que ya no existe también.

**Independent Test**: agregar un archivo de durabilidad sin clasificar y ver fallar el build con su nombre.

- [ ] T010 [P] [US2] `tests/governance/fixtures/suite-coverage/` — los fixtures de los tres casos: un árbol
      donde todo está clasificado, uno con un archivo de durabilidad que no está en ninguna categoría, y uno
      con una medición declarada que no existe en el disco.
- [ ] T011 [US2] `tests/governance/suite-coverage.test.ts` — **antes del script** (como
      `ports-bound.test.ts`): pasa sobre el repositorio de verdad, y falla sobre cada fixture **nombrando** el
      archivo o la ruta. Los dos sentidos, que es el punto (FR-005, FR-006).
- [ ] T012 [US2] `scripts/check-suite-coverage.mjs` — lee los archivos de `tests/durability/` del disco y las
      dos categorías de la configuración, y falla nombrando lo que no pertenece a ninguna o lo que se declaró
      y no existe. Con `--src` (o equivalente) para que la prueba lo corra sobre un fixture. Firma JSDoc de
      toda función exportada (`checkJs`).
- [ ] T013 [US2] `scripts/quality.mjs` — el gate nuevo entra a la cadena (`GATES`), y
      `tests/governance/quality.test.ts` lo espera: la cadena pasa de siete gates a ocho.
- [ ] T014 [P] [US2] `scripts/README.md` — la fila del script en el inventario (qué es, fuente, quién lo
      corre, su prueba, tipo), que su propia prueba verifica fila por fila (ADR-032).
- [ ] T015 [US2] Verificación de la historia: `npm run check:suite-coverage` en verde sobre el repositorio;
      crear un archivo de durabilidad vacío y ver fallar `npm run quality` nombrándolo; borrarlo.

**Checkpoint**: el hueco no puede volver por olvido.

---

## Phase 4: User Story 3 — Una medición se puede correr cuando alguien quiere el número (P2)

**Goal**: las tres mediciones de durabilidad son ejecutables y nombradas, y su resultado no bloquea un
cambio.

**Independent Test**: `npm run test:measures` corre las tres e informa sus cifras.

- [ ] T016 [US3] `npm run test:measures` corrido, con las cifras anotadas en el quickstart al lado de las de
      esta máquina: es el primer dato de qué cuestan fuera del arranque de la mutación.
- [ ] T017 [US3] `tests/hooks/ci.test.ts` — el job de durabilidad **no** corre las mediciones: lo que decide
      no mide. Se verifica sobre el comando del job, no sobre la configuración, porque lo que importa es qué
      ejecuta CI.
- [ ] T018 [P] [US3] `tests/README.md` — el inventario gana la fila del proyecto `measures` y la de
      `durability` dice que ahora es comportamiento (ADR-032, sin cifras de estado).

**Checkpoint**: «no son un gate» deja de significar «no se corren nunca».

---

## Phase 5: Lo que queda dicho

- [ ] T019 `CLAUDE.md` — la tabla de comandos gana `test:measures` y la fila de `test:durability` dice que es
      el comportamiento; el ritmo de dos velocidades dice que **CI corre la durabilidad en su propio job**.
      Cuidar el límite de 200 líneas: lo que entra tiene que ser lo que hace falta en toda sesión.
- [ ] T020 [P] `.claude/rules/gates-de-calidad.md` — la regla: **qué decide y qué mide**, con la frontera y
      con el motivo de que las tres de `fast` sigan siendo gate y las tres de durabilidad no (la tabla de
      R-02). Es la regla y pertenece ahí, no en CLAUDE.md.
- [ ] T021 [P] `docs/deudas.md` — **D-35**: `main` no tiene protección de rama, así que nada impide mergear
      en rojo (R-04). Con lo que haría falta para cerrarla y por qué esta feature no la cierra: es una
      decisión del dueño sobre quién mergea y qué jobs son obligatorios, incluido si se exige el de mutación.
- [ ] T022 Correr el **quickstart** de punta a punta, los seis pasos, y anotar lo que aparezca. El paso 6
      necesita un push, así que se corre con el dueño enterado.
- [ ] T023 La cadena de cierre: `npm run format:check`, `npm run typecheck`, `npm run quality`,
      `npm run test:all`, `npm run contract:check`, `npm run test:mutation`, `npm run release-check`.
      **`contract:check` tiene que pasar sin ningún cambio en `contracts/`**: si algo ahí cambió, la feature se
      salió de su alcance. El gate de mutación no debería tener líneas de `src/` que juzgar.

---

## Dependencies & Execution Order

### Entre fases

La fase 1 bloquea las tres historias: sin las dos categorías no hay job que correr ni nada que verificar.
Después, **US1 y US2 son independientes** (una toca el workflow, la otra la cadena `quality`) y pueden ir en
cualquier orden o a la vez. US3 depende de la fase 1 nada más. La fase 5 va al final porque documenta lo
hecho.

### Dentro de cada fase

**La prueba primero donde hay una regla**: T006 → T007 (la aserción del workflow antes del job) y
T010 → T011 → T012 (los fixtures, la prueba, el script). Que T006 y T011 fallen antes es parte de la
verificación, no una formalidad.

T013 depende de T012 (no se puede encadenar un gate que no existe). T014 y T018 son documentación de lo que
las tareas anteriores crearon.

### Paralelas

Marcadas `[P]`: T010, T014, T018, T020, T021. Tocan archivos distintos y ninguna espera a otra.

### Lo que este orden evita

- **Un job que pasa porque no corre nada**: T006 lo afirma antes de que el job exista, así que el verde
  significa algo.
- **Un gate nuevo que nadie encadena**: T013 está separada de T012 a propósito; escribir el script y olvidarse
  de `quality` deja una verificación que sólo corre si alguien se acuerda, que es la forma del hueco que esta
  feature cierra.
- **Que la configuración y lo documentado digan cosas distintas**: T019 a T021 van después de que el
  comportamiento exista, y `check:instructions` verifica que lo nombrado exista.

---

## Implementation Strategy

### MVP

Fases 1 y 2. Con eso la durabilidad se verifica en CI con nombre propio, que es el hueco. US2 es lo que
impide que vuelva y yo no lo separaría de la entrega: son las dos mitades de lo mismo.

### Incremental

1. Fase 1 → las dos categorías existen y se corren por separado.
2. US1 → CI verifica la durabilidad (hueco cerrado).
3. US2 → el hueco no puede volver.
4. US3 → las mediciones vuelven a tener quién las corra.
5. Fase 5 → lo decidido queda escrito donde se busca.
