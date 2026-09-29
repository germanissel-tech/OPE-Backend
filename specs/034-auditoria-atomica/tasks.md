---
description: "Task list template for feature implementation"
---

# Tasks: Una acción administrativa y su entrada de auditoría se commitean juntas

**Input**: Design documents from `/specs/034-auditoria-atomica/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y con una particularidad de esta feature: **casi todo lo que hay que probar es lo que pasa
cuando algo falla en el medio**. Eso no se ve en memoria y no se ve sin reiniciar, así que la suite de
durabilidad no cubre una mitad sino el corazón.

**Organization**: por historia. **Esta feature no toca HTTP** —ninguna operación se agrega ni cambia, y
las diez auditadas ya declaran `503`— así que el orden de seis pasos de `.claude/rules/contrato.md` no se
dispara. Que eso esté dicho es lo que evita que alguien busque el paso que falta.

**Y no hay migración**: es la primera feature del hito que toca durabilidad sin tocar el esquema.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (la acción y su registro son una sola cosa), US2 (el tráfico no paga), US3 (el olvido no es silencioso)
- Toda tarea nombra su archivo

---

## Phase 1: Foundational — el mecanismo (bloquea a las tres historias)

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esto esté. Y el objetivo de la fase es que, al
terminarla, **nada haya cambiado de comportamiento**: todas las escrituras y lecturas esperan un turno que
todavía nadie retiene.

- [ ] T001 `tests/durability/unit-of-work.test.ts` — **antes del mecanismo**, y contra un almacén de
      verdad: lo escrito dentro de una unidad que aborta **no queda**; lo de una que cierra sí; dos
      unidades seguidas no se pisan; y una unidad que termina deja el almacén escribible otra vez. Es la
      única prueba que puede decir que la reversión revierte.
- [ ] T002 `src/infrastructure/sqlite/open-store.ts` — `scope`, `enter`, `busy` y el guardia con
      `AsyncLocalStorage`. **La `transaction` síncrona no se toca**: la orden sigue decidiendo
      primero/repetido/conflicto ahí adentro. Lo que hay que no equivocarse: `enter()` resuelve **ya** para
      el dueño de la unidad y espera para todos los demás, y esa distinción es lo único que el almacén no
      puede saber sin el contexto asincrónico.
- [ ] T003 `src/interface-adapters/shared-kernel/sql-store.ts` — los tres miembros en el vocabulario que un
      gateway recibe, con el motivo de `busy` escrito donde está: es sincrónico porque la cola del registro
      no puede esperar a nadie (ADR-039), y un `await` ahí sería una regresión del principio IV.
- [ ] T004 `tests/helpers/sql-store.ts` — el doble de `SqlStore` **en un solo lugar**. Hoy hay dos escritos
      a mano en unitarias y los tres miembros nuevos los multiplican; el momento de juntarlos es antes de
      agregarlos, no después.
- [ ] T005 `src/interface-adapters/shared-kernel/durable-store.ts` — el turno de **todas** las escrituras
      de **todos** los gateways, en `tried`, que es donde desembocan `stored` y `attempted`. Una línea, y
      es el pago del trabajo que la 033 hizo al mudar esos envoltorios al kernel del anillo.
- [ ] T006 `tests/unit/interface-adapters/shared-kernel/durable-store.test.ts` — que una escritura espera su
      turno y que el fallo sigue traduciéndose igual. Con el doble de T004.
- [ ] T007 Los sitios de **lectura** de los gateways durables — el envoltorio simétrico al de escritura.
      Una lectura dentro de la transacción de otro ve lo que esa transacción **no commiteó**, así que
      también espera. **Las dos lecturas del arranque no esperan** —los índices en memoria de merchants y
      experimentos (ADR-041)— y eso va escrito donde están: en el arranque no hay unidad posible.
- [ ] T008 `tests/durability/unit-of-work.test.ts` — el guardia: con una unidad ajena abierta, escribir o
      leer sin turno **lanza**. Es el caso que hace que T007 no dependa de la memoria de nadie.
- [ ] T009 Correr `npm test` y `npm run test:durability` **sin nada más**: el mecanismo está y ninguna
      expectativa cambió. Es el checkpoint más barato de la feature y el que separa un problema del
      mecanismo de un problema del decorador.

**Checkpoint**: todo espera su turno y nadie retiene ninguno. Comportamiento idéntico.

---

## Phase 2: User Story 1 — La acción y su registro son una sola cosa (P1) 🎯 MVP

**Goal**: una acción de administración y su entrada de auditoría quedan las dos o ninguna.

**Independent Test**: ejecutar una acción con un registro sano y otra con un registro que falla al escribir
la entrada, y comprobar en el almacén que el efecto está en el primer caso y **no está** en el segundo.

- [ ] T010 [US1] `src/application/shared-kernel/ports/unit-of-work.ts` — el puerto del kernel:
      `scope<T>(work: (abort: () => void) => Promise<T>): Promise<Result<T, StoreUnavailable>>`. El `abort`
      que recibe el trabajo es lo que permite revertir desde un anillo donde `try/catch` está prohibido
      (ADR-023) y donde una excepción sería un `500` en vez del `503` declarado (research R-02).
- [ ] T011 [US1] `src/interface-adapters/shared-kernel/unit-of-work.ts` — las dos implementaciones. La
      durable abre, ejecuta, cierra o revierte; **la de memoria ejecuta y responde `ok`**, y eso no es un
      stub que tape un caso: ese despliegue nunca prometió atomicidad (research R-05).
- [ ] T012 [US1] `src/composition/` — el enlace del puerto por tecnología. Un módulo con dos tecnologías
      **no compila si nadie elige** (ADR-033), así que olvidarse falla en compilación.
- [ ] T013 [P] [US1] `tests/unit/application/shared-kernel/audited-use-case.test.ts` — **antes de tocar el
      decorador**, y con las tres aserciones que deciden si la feature audita lo que debe: un **rechazo de
      negocio no aborta** y su entrada queda; **sólo** el fallo del registro aborta; y cuando aborta, la
      respuesta de la operación **es** el fallo de la unidad.
- [ ] T014 [US1] `src/application/shared-kernel/decorators/audited-use-case.ts` — el cambio: la consulta
      previa sale y el trabajo pasa a correr dentro de la unidad. Sin `try/catch`, que el lint rechaza en
      el acto.
- [ ] T015 [US1] `src/application/shared-kernel/ports/audit-trail.ts` y sus dos implementaciones —
      `writable()` se va. La transacción subsume lo que preguntaba, y dos mecanismos para la misma promesa
      son dos lugares donde puede fallar.
- [ ] T016 [US1] `tests/durability/atomic-audit.test.ts` — **SC-001**: con el registro fallando al escribir
      la entrada, ni el merchant ni sus orígenes reservados quedan; con el registro sano, las dos cosas
      sobreviven al reinicio. Es la ventana de ADR-034 cerrada.
- [ ] T017 [US1] `tests/integration/admin-log-unavailable.test.ts` y `tests/helpers/unavailable-ledgers.ts`
      — qué afirman ahora que no hay consulta previa. **La garantía del arranque no se toca**: un registro
      que no acepta escrituras al arrancar sigue impidiendo arrancar, porque la semilla es una acción
      administrativa y ahora también corre dentro de una unidad.
- [ ] T018 [US1] `tests/durability/atomic-audit.test.ts` — el aislamiento **a través de una reversión**: una
      acción sobre un merchant que revierte no deja ni toca nada de otro (constitución V).
- [ ] T019 [US1] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: la historia 1 funciona sola y **es la feature mínima entregable** — la regla de ADR-034
deja de ser cierta sólo en el caso barato.

---

## Phase 3: User Story 2 — El tráfico del SDK no paga la auditoría de nadie (P2)

**Goal**: mientras una acción de administración corre, la ingesta responde, nada degrada y nada se pierde.

**Independent Test**: tráfico de ingesta continuo con acciones de administración en paralelo, y comparar el
p95 y los motivos de las decisiones contra la misma corrida sin acciones.

- [ ] T020 [P] [US2] `tests/unit/interface-adapters/ingestion/event-log-queue.test.ts` — **antes del
      cambio**: un `flush` que encuentra el almacén ocupado **no escribe y no pierde**, y el siguiente
      escribe todo. El conteo final es lo que se afirma, no que «reintentó».
- [ ] T021 [US2] `src/interface-adapters/ingestion/queue/event-log-queue.ts` — preguntar `busy` y devolver
      lo pendiente a la cola. **Sin `await`**: `record` devuelve `void` a propósito y `flush` es síncrono
      porque nadie puede esperar la escritura del registro (ADR-039, principio IV).
- [ ] T022 [US2] `tests/durability/admin-concurrency.test.ts` — **SC-002, la condición de aceptación**, más
      SC-003 y SC-004 en la misma corrida: el p95 de la ingesta con acciones de administración concurrentes
      contra el p95 sin ellas; cero decisiones degradadas por almacén no disponible; y el conteo exacto de
      llegadas registradas. Si el p95 empeora de forma apreciable, la unidad retiene el camino de decisión
      más de lo que una escritura local justifica y la feature no está terminada.
- [ ] T023 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las historias 1 y 2 funcionan, y la segunda es la que dice si la primera es aceptable.

---

## Phase 4: User Story 3 — Un olvido no puede ser silencioso (P3)

**Goal**: quien agregue un almacén durable y se olvide del turno lo descubre en su primera prueba.

**Independent Test**: un gateway escrito para eso escribe sin turno y falla de inmediato con una unidad
ajena abierta; con ninguna abierta, funciona.

- [ ] T024 [US3] `tests/durability/unit-of-work.test.ts` — las dos mitades juntas, que es lo que las hace
      valer: **falla** con una unidad ajena abierta y **no cuesta nada** cuando no hay ninguna. Una sola
      mitad deja pasar un guardia que rompe todo o uno que no protege nada.
- [ ] T025 [US3] `.claude/rules/gateway-durable.md` — el punto que le falta a la regla: **el turno se
      espera, y no esperarlo lanza**. Es la regla que llega cuando alguien trabaja sobre un gateway
      durable, así que es el único lugar donde la próxima persona lo va a leer a tiempo.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 5: Lo que queda dicho

- [ ] T026 `docs/adr/` — dos cosas y conviene no mezclarlas: **la enmienda a ADR-034**, que declara cerrada
      la ventana que él mismo dejó abierta y dice con qué; y un **ADR nuevo** para la unidad de trabajo: la
      cuarta excepción al principio IV, con su medición de SC-002, el guardia y su motivo, y por qué el
      puerto sobrevive al cambio de motor (D-21). Con el trato de ADR-038, ADR-040 y ADR-041.
- [ ] T027 [P] `docs/deudas.md` — **D-28 cerrada**, con el commit. Y lo que esta feature deja anotado, si
      algo: D-30 ya está (el presupuesto por sesión) y D-21 no gana nada nuevo — la unidad es del proceso,
      que es lo que esa deuda ya dice de todo.
- [ ] T028 [P] Los READMEs que el cambio toca, con su inventario (ADR-032): `tests/` por las suites nuevas
      y `src/` si el mapa de anillos cambia de forma. `migrations/` **no**, y eso es el dato.
- [ ] T029 Correr el **quickstart** de punta a punta, los seis pasos, y **anotar lo que aparezca**. En las
      cuatro features anteriores encontró lo que ningún gate veía — la última vez, un registro que dice que
      importó la semilla cuando no la importó.
- [ ] T030 La cadena de cierre: `contract:check`, `test:all`, `test:mutation`, `test:contract`,
      `release-check`. Y `npm run build` antes de `test:contract`, que es lo que la 033 aprendió: compara
      fechas de `dist/`.

---

## Dependencies & Execution Order

### Entre fases

- **Fase 1 bloquea todo.** El mecanismo es el 60 % de la feature y las tres historias son sus consumidores.
- **US1 (fase 2) es la feature mínima entregable.** Con la fase 1 y ella, la ventana está cerrada.
- **US2 (fase 3) puede empezar apenas termine la fase 1**, porque la cola no depende del decorador. Pero su
  medición (T022) necesita que US1 esté, porque lo que se mide es el costo de una acción **auditada**.
- **US3 (fase 4) es independiente de las dos**: el guardia existe desde la fase 1 y lo que agrega son sus
  pruebas y la regla.
- **La fase 5 va al final**, porque un ADR que describe lo que todavía no se midió es una promesa.

### Dentro de cada fase

**Las pruebas primero y tienen que fallar.** Los pares de esta lista: T001→T002 (el mecanismo),
T006→T005 (el turno de las escrituras), T013→T014 (el decorador), T020→T021 (la cola). Que una prueba
falle antes es lo que separa una prueba de un comentario.

### Paralelismo

Marcadas `[P]`: T013, T020, T027, T028. Tocan archivos distintos y ninguna espera a otra.

**Y una que parece paralela y no lo es**: T003 y T004. Agregar los tres miembros al vocabulario rompe todos
los dobles de `SqlStore` a la vez, así que el doble compartido va **antes** o el árbol no compila en el
medio.

---

## Implementation Strategy

### Lo mínimo entregable

Fase 1 más US1. Con eso, una acción administrativa y su entrada son una sola cosa, que es lo que D-28 pide
y lo que ADR-034 declaró abierto. US2 no agrega garantía: **agrega la evidencia de que la garantía no costó
lo que no se puede pagar**, y por eso no es opcional aunque sea la segunda.

### Incremental

1. Fase 1 → todo espera su turno, nada cambió. Se puede commitear y dejar así sin riesgo.
2. US1 → la ventana se cierra. Verificable sola.
3. US2 → la medición. Acá la feature se acepta o se revisa.
4. US3 → el guardia probado y la regla escrita, para la próxima persona.
5. Fase 5 → lo que queda dicho.

### Notas

- **El orden de la fase 1 importa más que en otras features**: T003 sin T004 deja el árbol sin compilar, y
  T005 sin T002 no tiene qué esperar.
- **Un `catch` en `application/` lo rechaza el lint en el acto**, así que si T014 necesita uno, la que está
  mal es la forma del puerto (T010) y no el decorador.
- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el dueño.
