---
description: "Task list template for feature implementation"
---

# Tasks: El ledger sobrevive a un reinicio

**Input**: Design documents from `/specs/030-ledger-durable/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y de dos clases. **Las que ya existen son el control**: 1372 pruebas que prueban
comportamiento, y el comportamiento no cambia por dónde se guarda. **La suite nueva prueba lo único
que sólo se ve cruzando un reinicio**, y tiene que cubrir cada puerto, no una muestra: son los
gateways que ninguna otra prueba toca.

**Organization**: por historia. Esta feature **no toca HTTP**, así que el orden de seis pasos no
aplica; el que rige es el de anillos: infraestructura → gateways → composición → pruebas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (ledger), US2 (catálogo)
- Toda tarea nombra su archivo

---

## Phase 1: Setup — el salto de Node, primero y solo

- [ ] T001 `.nvmrc`, `package.json` (`engines`) y lo que CI lea de ahí — subir a **Node 24 LTS**.
      **Va en su propio commit y antes que cualquier código de SQLite**: si algo del stack se queja
      —el compilador nativo de TypeScript, el runner de Vitest con su parche, Stryker— conviene verlo
      con el diff más chico posible, porque no tendría nada que ver con esta feature.
- [ ] T002 Verificar el salto corriendo **la cadena entera**: `format:check`, `quality`, `typecheck`,
      `build`, `test`, `test:tools`, `contract:check`, `test:contract`, `release-check`,
      `test:mutation`. En esta máquina hay que activar 24 con elevación (`nvm use 24.21.0`); si no se
      puede, **lo verifica CI y esta tarea lo dice** en vez de darlo por hecho.
- [ ] T003 `patches/README.md` — revisar si el parche del runner de Vitest sigue aplicando en 24.
      `patch-package` falla en `postinstall` si deja de aplicar, así que T002 ya lo cubre; esta tarea
      es leer el resultado y, si cambió, actualizar la fila del inventario con su motivo.

**Checkpoint**: el repositorio corre sobre Node 24 y nada más se movió.

---

## Phase 2: Foundational — el almacén, que bloquea a las dos historias

- [ ] T004 `src/infrastructure/sqlite/` — la apertura del archivo y el modo WAL. **Es el único lugar
      que importa `node:sqlite`**: el anillo de infraestructura es el que la regla reserva para «lo que
      hospeda o provee tecnología», y un gateway lo recibe por su enlace
      (`port-implementations-only-in-bind`).
- [ ] T005 `migrations/` — el esquema versionado (FR-007): una tabla por entidad, con columnas sólo
      para el merchant y la clave que el puerto busca, y el registro como documento (data-model).
- [ ] T006 `src/infrastructure/sqlite/` — la verificación de esquema al abrir: si no es el que el
      código espera, **el arranque falla diciendo qué esperaba** (FR-006). Misma regla que la
      configuración y la semilla.
- [ ] T007 `src/composition/sqlite-config.ts` — la ruta del archivo, desde el entorno y con un valor
      por defecto para desarrollo. **No es un valor de comportamiento**, así que no entra en los tres
      niveles de la constitución XI; `check:behaviour-constants` vigila lo otro.

**Checkpoint**: hay dónde escribir, y el arranque se niega si no entiende lo que encuentra.

---

## Phase 3: User Story 1 - Lo que OPE decidió sigue ahí después de un reinicio (Priority: P1) 🎯

**Goal**: decisiones, exposiciones, órdenes, corroboraciones y asignaciones sobreviven a un reinicio.

**Independent Test**: registrar, exponer, atribuir, reiniciar, y leer las tres con el mismo contenido.

- [ ] T008 [P] [US1] `src/interface-adapters/ledger/gateways/sqlite-decision-ledger.ts` — `record`,
      `find` y `bySession`. El fallo del almacén se traduce a `LedgerUnavailable` (ADR-021): el puerto
      no cambia de forma y la degradación se conserva.
- [ ] T009 [P] [US1] `src/interface-adapters/ledger/gateways/sqlite-exposure-ledger.ts` — `record` y
      `find`, con la idempotencia **a través del reinicio** (FR-005): repetir una confirmación tiene
      que responder lo mismo que la primera vez, y eso hoy lo garantiza un `Map` que se vacía.
- [ ] T010 [P] [US1] `src/interface-adapters/outcomes/gateways/sqlite-order-ledger.ts` — `record`,
      `recordReturn` y `find`.
- [ ] T011 [P] [US1] `src/interface-adapters/outcomes/gateways/sqlite-corroboration-ledger.ts` —
      `record` y `find` por orden.
- [ ] T012 [P] [US1] `src/interface-adapters/experiment/gateways/sqlite-assignment-ledger.ts` —
      `record` y `find`. **Es el que más importa de los cinco**: sin él, un visitante que vuelve
      después de un reinicio se reasigna, y la asignación es estable por visitante por diseño
      (ADR-022). Perderla no borra información: **cambia el comportamiento y contamina la medición**.
- [ ] T013 [US1] `src/composition/modules/{ledger,outcomes,experiment}.ts` — cada módulo declara su
      segunda tecnología, y `src/composition/deployments/local.ts` la elige con
      `<módulo>Module.with("sqlite")`. **Omitir la elección no compila**: el tipo pasa a ser
      `ChooseATechnology` y el despliegue no lo acepta.

### Pruebas de US1

- [ ] T014 [US1] `vitest.config.ts` — el proyecto `durability`, separado de `fast`. Las 1372 que ya
      existen **siguen en memoria**: prueban comportamiento, y hacerlas pasar por disco las haría más
      lentas sin probar nada nuevo (research R-06).
- [ ] T015 [US1] `tests/durability/` — el recorrido entero: registrar una decisión con su
      razonamiento, confirmar su exposición, atribuirle una orden con su corroboración, **cerrar y
      reabrir el almacén**, y leer las cuatro con el mismo contenido.
- [ ] T016 [US1] `tests/durability/` — la asignación cruzando el reinicio: el mismo visitante vuelve
      al **mismo brazo**. Es el caso donde la durabilidad no es sobre datos sino sobre comportamiento.
- [ ] T017 [US1] `tests/durability/` — la idempotencia cruzando el reinicio: confirmar dos veces una
      exposición responde lo mismo antes y después.
- [ ] T018 [US1] `tests/durability/` — **el aislamiento entre merchants cruzando el reinicio**. Es
      donde un índice mal puesto o un `WHERE` olvidado lo rompería, y ninguna prueba en memoria lo
      alcanza.
- [ ] T019 [US1] `tests/durability/` — el almacén que no acepta: la decisión degrada a `NO_OP` con
      motivo `ledger-unavailable` y el plano sigue respondiendo (ADR-021).

**Checkpoint**: un reinicio ya no borra el experimento.

---

## Phase 4: User Story 2 - El catálogo publicado sigue ahí (Priority: P2)

**Goal**: la última instantánea y sus recibos sobreviven, así que la tienda no se apaga entre el
reinicio y la próxima publicación.

**Independent Test**: publicar, reiniciar, y consultar la verdad de una variante sin republicar.

- [ ] T020 [US2] `src/interface-adapters/catalog/gateways/sqlite-catalog-store.ts` — `current`,
      `replace` y `receipts`, con el tope de recibos que la política del merchant fija.
- [ ] T021 [US2] `src/composition/modules/catalog.ts` y el despliegue — la segunda tecnología.
- [ ] T022 [US2] `tests/durability/` — publicar, reiniciar, y consultar la verdad de una variante con
      la misma frescura; republicar la misma instantánea sigue siendo **repetición y no conflicto**; y
      el nivel de sincronización observado no cambia por el reinicio.

**Checkpoint**: la tienda sigue interviniendo después de un reinicio.

---

## Phase 5: Cierre

- [ ] T023 `tests/integration/ingest-latency.test.ts` — correrla **con el almacén durable** y dejar el
      p50 y el p95 **anotados y fechados** en el quickstart. No es un adorno: es el número que decide
      si «desacoplar la aceptación del ledger» sube de prioridad en el hito (research R-01), y el
      quickstart es el único lugar donde queda.
- [ ] T024 `docs/adr/0NN-*.md` — el ADR de la decisión transversal: **por qué la escritura durable
      queda en el camino crítico** pese a `01 §P9`, con el argumento de trazabilidad (IX) que impide
      desacoplar a la ligera y el número de T023 como disparador. Se escribe al cerrar, cuando los
      identificadores existen.
- [ ] T025 `docs/deudas.md` — D-21 se queda `abierta` y gana la referencia a esta feature; si
      aparecen deudas nuevas, sus filas.
- [ ] T026 `CLAUDE.md` y `.claude/rules/` — **sólo si hace falta**, con el criterio de admisión. La
      hipótesis es que sí hace falta algo: dónde vive un driver y por qué un gateway no lo importa es
      una regla acotada que llega cuando alguien toca `src/interface-adapters/*/gateways/`.
- [ ] T027 `npm run check:glossary`, `check:invariant-tests`, `check:identifiers`, `check:api-map`,
      `check:language`, `check:behaviour-constants`, `check:ports-bound` — los siete, uno por uno.
- [ ] T028 Correr el quickstart **entero**, sus siete pasos, y dejar su tabla de estado **fechada**.
      El paso 7 no lo decide ningún comando: abrir el almacén y leer una fila del ledger como lo haría
      alguien que está discutiendo una cifra y no tiene el código a mano.
- [ ] T029 Cadena completa como CI, con `build` antes de `test:contract`.
- [ ] T030 `npm run test:mutation`. Los gateways nuevos son código con ramas —traducir un fallo del
      almacén a `LedgerUnavailable` es una— así que acá el gate tiene de qué agarrarse, a diferencia
      de un renombre.

---

## Dependencies & Execution Order

- **F1 (Node)** va **primero y sola**. Nada de SQLite se escribe antes de que T002 diga que la cadena
  pasa en 24.
- **F2 (el almacén)** bloquea a las dos historias: sin dónde escribir no hay gateway que probar.
- **US1 (F3)** es la MVP. Los cinco gateways (T008–T012) son **paralelos entre sí**: archivos
  distintos, sin dependencia. T013 va después de los cinco, porque el despliegue no compila con uno a
  medias.
- **US2 (F4)** es independiente de US1 y podría ir antes; va después porque el ledger es lo
  irrecuperable.
- **F5** al final. T024 después de que existan los identificadores; T023 antes que T024, porque el ADR
  cita su número.

### Paralelismo real

Esta vez hay: **T008 a T012 son cinco archivos sin dependencia entre sí**. Es el único tramo de la
feature que no es una cadena.

---

## Implementation Strategy

### El MVP es US1

El ledger es lo que no se recupera. US2 entrega el catálogo, que la plataforma puede reenviar.

### Commits

Uno por T001 (el salto de Node, solo), uno por historia, y los del cierre.

---

## Notes

- **La suite nueva es el único lugar que toca los gateways durables.** El proyecto `fast` sigue en
  memoria a propósito, y eso hace que la cobertura de esta feature dependa entera de `tests/durability/`.
  Por eso las tareas listan **un caso por puerto y por garantía**, no una muestra: si algo se cubre
  «de paso», acá no se cubre.
- **T016 no es una prueba de datos, es una de comportamiento.** El resto de la suite verifica que lo
  guardado se lea igual; ésa verifica que **el sistema decida igual**, que es otra cosa.
- **Lo que este plan no puede verificar**: que SQLite se comporte como PostgreSQL bajo concurrencia.
  Está en **D-21** con su motivo y su fecha, y ninguna tarea de acá lo promete.
