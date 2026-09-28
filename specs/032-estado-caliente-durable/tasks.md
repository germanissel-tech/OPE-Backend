---
description: "Task list template for feature implementation"
---

# Tasks: Un reinicio deja de reiniciar los topes

**Input**: Design documents from `/specs/032-estado-caliente-durable/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/README.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y con una particularidad de esta feature: **el escenario es el reinicio**, así que la suite
de durabilidad no cubre una mitad sino casi todo. Las que ya existen son el control —FR-010 y SC-004 exigen
que el caso normal, con el estado en memoria, no cambie— y una prueba de comportamiento que haya que tocar
es la señal de que esta feature se metió donde no debía.

**Organization**: por historia. Esta feature **sí toca HTTP**, así que el orden del contrato rige: su
cambio se diseñó en `contracts/` durante el plan y se aplica en la fase 1, **antes de cualquier código**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (los topes sobreviven), US2 (la sesión vuelve como estaba), US3 (en memoria lo activo)
- Toda tarea nombra su archivo

---

## Phase 1: Setup — el contrato, primero y solo

**Propósito**: el cambio del contrato **regenera tipos** y el renombre rompe cada lugar que lee el campo
viejo. Va en su propio commit por el mismo argumento con que la 031 separó el runner de migraciones y la
030 el salto de Node: si algo se mueve, conviene verlo con el diff más chico posible.

- [x] T001 `contracts/no-op-reasons.yaml` — el motivo `state-unavailable` con su emisor y su descripción,
      tal como `contracts/README.md` lo fija. Es un cambio **compatible** (ADR-014): el contrato declara
      `Decision.reason` como string con patrón, no como enum.
- [x] T002 `src/domain/shared-kernel/no-op-reasons.ts` — la réplica del catálogo. El archivo dice que es una
      réplica y una prueba verifica que coinciden, así que esto no es duplicación sino la copia que el gate
      vigila.
- [x] T003 `contracts/components/schemas/PlatformConfiguration.yaml` — `sessionWindowMs` pasa a
      **`sessionDurationMs`**, con la descripción que dice qué es: la regla del backend que el SDK obedece,
      no una observación del cliente. **El renombre no es cosmético**: ese nombre es el que produjo la
      ambigüedad que FR-002 viene a partir, y cuesta cero porque ningún merchant consume el contrato
      (`info.x-stability: building`, ADR-003).
- [x] T004 `config/platform.json` — el valor pasa de 86 400 000 a **1 800 000** (30 minutos), que es la
      decisión del dueño (FR-001). Y el dominio, la configuración y todo lo que leía el campo viejo: el
      compilador los nombra uno por uno, que es para lo que sirve el renombre.
- [x] T005 Correr la cadena con el contrato cambiado y **nada más**: `contract:check`, `format:check`,
      `typecheck`, `quality`, `test`, `test:contract`. `contract:diff` va a reportar el cambio incompatible
      y **aceptarlo** por la marca `building`; que lo reporte es lo correcto, no un problema a silenciar.

**Checkpoint**: el contrato dice lo que va a significar, y nada más se movió.

**Dos cosas que la fase 1 tuvo que hacer y esta lista no previó**, las dos porque el renombre no era
cosmético:

- **La retención caliente entró acá, no en T018.** `composition/modules/decision.ts` usaba el campo
  viejo como TTL del almacén en memoria, así que renombrarlo y nada más habría bajado la retención de
  24 h a 30 minutos **sin reconstrucción todavía** — un cambio de comportamiento justo en la fase que
  promete no tener ninguno. Entró como `OPE_SESSION_RETENTION_MS` con el default de un día, con lo que
  la fase 1 no cambia ninguna respuesta. T018 queda reducido al cableado de las dependencias nuevas.
- **La versión del nivel 1 subió a `platform-2`.** Una decisión registra con qué configuración se tomó
  (constitución IX), y dos corridas con `platform-1` y duraciones de sesión distintas serían
  indistinguibles en el ledger. `info.version` del contrato subió a 1.10.0, que es el bump MINOR que
  ADR-003 pide para un cambio incompatible con la marca `building`.

---

## Phase 2: Foundational — poder leer lo durable (bloquea a las tres historias)

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esto esté.

### El esquema y la lectura por visitante

- [x] T006 `tests/durability/store.test.ts` — **antes de la migración**: un almacén en versión 2 sube a 3,
      sus decisiones quedan intactas y **ninguna fila tiene el visitante vacío**. Ese último es el que
      importa: un relleno que falla no rompe nada, hace que la lectura por visitante mienta en silencio.
- [x] T007 `migrations/003-*.sql` — `decisions` gana `visitor_id` **`NOT NULL`** con su índice
      `decisions_by_visitor`, rellenado desde el documento con `json_extract`. **Reconstruye la tabla y no
      usa `ALTER TABLE ADD COLUMN`**, y el motivo está en `data-model.md`: la columna quedaría nullable para
      siempre, y una fila con el visitante en `NULL` es un tope que deja de aplicarse sin que nada falle.
      Los `created_at` **se copian**: esta migración no es cuándo la fila apareció.
- [x] T008 [P] `migrations/README.md` — la fila del inventario de `003` y el diagrama ER con la columna
      nueva. Sin cifras de estado (ADR-032); `tests/docs/readmes.test.ts` es el gate, y recordar que lee de
      `git ls-files`: una migración sin rastrear no cuenta.
- [x] T009 `tests/durability/ledger.test.ts` — **antes de la lectura**: las intervenciones de un visitante,
      cruzando un reinicio, con aislamiento por merchant, y **verificando su plan de consulta**: tiene que
      decir `decisions_by_visitor` y no `SCAN decisions`. En esta familia de features un índice equivocado ya
      salió más de tres veces peor que ninguno.
- [x] T010 `src/application/ledger/ports/decision-ledger.ts` y sus dos gateways — la lectura por visitante
      (FR-007), acotada a una ventana porque la fatiga cuenta dentro de 24 h y traer todo el histórico de un
      visitante para descartarlo sería trabajo tirado en el camino de decisión.

### La tercera respuesta de los puertos

- [x] T011 `src/domain/decision/errors.ts` y `contracts/problem-types.yaml` — `StateUnavailable`, con el
      **mismo slug** que el motivo de `NO_OP` porque nombran la misma cosa desde los dos lados. Va al
      catálogo aunque ningún endpoint lo emita, que es la regla de `entidad.md`.
- [x] T012 `tests/unit/application/decision/` — **antes de cambiar los puertos**: las tres respuestas y sus
      tres consecuencias. Recordado decide, olvidado reconstruye, **fallado degrada** — y el tercero es el
      que hoy no se puede expresar.
- [x] T013 `session-state-store.ts` y `visitor-state-store.ts` — `load` devuelve
      `Promise<Result<State | undefined, StateUnavailable>>`. Tres respuestas, tres valores (FR-012).
      **Es un adelanto de un punto del hito, no un invento de esta feature**: «puertos de lectura con canal
      de fallo» ya está declarado en `durable-write.ts` como trabajo de `persistence-and-resilience`, y acá
      se hace **en los dos que lo necesitan ahora**. Los demás siguen lanzando, y el comentario lo dice para
      que después no parezca que estos dos son la excepción.
- [x] T014 [P] Los gateways en memoria de los dos puertos — devuelven `ok(...)`, y **nunca fallan**, porque
      un `Map` no puede: el canal de fallo existe para el durable y en memoria es una rama muerta que se
      declara como tal.

### La reconstrucción

- [x] T015 `tests/unit/application/decision/` — **antes del servicio**, y el caso que decide SC-002: los
      eventos `duplicate` **se replican** y los `rejected` **no**. Dos pruebas y no una, porque los dos
      errores devuelven un estado plausible: con los rechazados adentro la sesión vuelve con señales que
      nunca tuvo; sin los duplicados, con menos de las que tuvo.
- [x] T016 `src/application/decision/services/state.service.ts` — `recall` reconstruye cuando la memoria
      dice «no lo recuerdo»: las señales de `EventLog.bySession`, las intervenciones de la sesión de
      `DecisionLedger.bySession` —que **existe desde la 030**— y las del visitante de la lectura nueva.
      El servicio queda en **cinco** dependencias. El filtro de `disposition` va **en un solo lugar**, con
      su razonamiento al lado.
- [x] T017 `remember` sigue guardando en caliente y nada más: lo durable ya lo escriben el ledger y el
      registro, y escribir dos veces lo mismo crearía dos verdades que pueden discrepar.
- [x] T018 [P] `src/composition/` — el cableado de las dos dependencias nuevas del servicio. La
      **retención caliente** ya entró en la fase 1 como `OPE_SESSION_RETENTION_MS`
      (`state-retention-config.ts`), con el argumento de `event-log-config.ts`: no cambia ninguna
      respuesta, así que no va a los tres niveles ni al contrato. El motivo de que se adelantara está en
      la nota de la fase 1.
- [x] T019 `npm test` — **ninguna prueba de comportamiento cambia de expectativa** (FR-010, SC-004). Si hay
      que tocar una, esta feature se metió en el caso normal, que no debía tocar.

**Checkpoint**: lo durable se puede leer, y una sesión olvidada se puede reconstruir.

---

## Phase 3: User Story 1 — Los topes sobreviven al despliegue (P1) 🎯 MVP

**Goal**: el presupuesto de la sesión y la fatiga del visitante siguen valiendo después de un reinicio.

**Independent Test**: agotar el presupuesto de una sesión, reiniciar, y ver que la siguiente decisión sigue
degradando por presupuesto agotado y no interviene otra vez.

- [x] T020 [P] [US1] `tests/durability/restart.test.ts` — el escenario 1 de la historia y el daño real: una
      sesión que agotó su presupuesto **sigue agotada** después del reinicio. Con el despliegue durable de
      punta a punta, por HTTP, que es el único lugar donde se ve lo que un deploy hace.
- [x] T021 [P] [US1] `tests/durability/restart.test.ts` — el escenario 2: un visitante que agotó su cupo del
      día **sigue agotado**. Es el tope que cruza visitas y el único que impide que una cadena de
      despliegues no tenga techo.
- [x] T022 [P] [US1] El escenario 3: dos merchants con actividad, y ninguna reconstrucción lee nada del
      otro. Cruzando el reinicio, que es donde un índice mal puesto lo rompería.
- [x] T023 [US1] `EXPLAIN QUERY PLAN` sobre las tres lecturas de la reconstrucción, sobre una tabla **con
      filas** porque SQLite planifica distinto una vacía. Si alguna dice `SCAN`, el índice no sirve.
- [x] T024 [US1] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: la historia 1 funciona sola y es la feature mínima entregable — el daño comercial que
ocurre hoy en cada despliegue deja de ocurrir.

---

## Phase 4: User Story 2 — Una sesión que vuelve, vuelve como estaba (P2)

**Goal**: la decisión después de un desalojo es la misma que habría sido sin él.

**Independent Test**: acumular señales, forzar que la sesión salga de memoria, y comprobar que la decisión
siguiente es la misma.

- [x] T025 [P] [US2] `tests/durability/state-reconstruction.test.ts` — SC-002 completo: la misma secuencia
      de eventos con y sin desalojo produce **la misma decisión**, comparando el veredicto y su motivo.
- [x] T026 [P] [US2] Una sesión que **nunca existió** se crea vacía sin buscar nada — el caso más común y
      el que no es una falla (FR-012, el segundo escenario de la historia).
- [x] T027 [US2] Una sesión **más vieja que su duración** no se reconstruye: es otra visita y el SDK debería
      haberle dado otro identificador. Que llegue **se registra**, porque es un SDK que no cumple y eso es
      información, no ruido.
- [x] T028 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las historias 1 y 2 funcionan, cada una por su cuenta.

---

## Phase 5: User Story 3 — En memoria está lo que está pasando (P3)

**Goal**: el estado caliente guarda las sesiones con actividad, y las quietas dejan lugar sin perderse.

- [ ] T029 [P] [US3] `tests/unit/interface-adapters/` — una sesión sin actividad durante el tiempo de
      expiración sale de memoria, y **su siguiente evento la recupera**. Las dos mitades: que salga y que
      vuelva; una sola no dice nada.
- [ ] T030 [US3] La expiración por inactividad con la **retención caliente** de T018, separada de la
      duración de la sesión (FR-003). Lo que cambia acá es memoria, no una regla de negocio — que es todo el
      motivo de haber partido el campo.
- [ ] T031 [US3] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Lo que pasa cuando no se puede leer — la respuesta de Q1

**Propósito**: no es una historia, es lo que hace confiables a las tres. **Los topes son obligatorios y las
señales best-effort**, y el motivo es la asimetría: sin los topes el sistema hace algo que nunca hizo; sin
las señales hace lo que está en producción hoy.

- [ ] T032 [P] `tests/durability/` — con el almacén caído: la decisión **degrada a `NO_OP
state-unavailable`**, la decisión **se emite y se registra**, y **no** se responde un error HTTP. Un
      500 acá significaría un defecto, y una degradación se registra (FR-013, precedente de
      `ledger-unavailable`).
- [ ] T033 [P] Con las **señales** ilegibles pero los topes legibles: se decide con el lote actual —que es
      lo que el sistema hace hoy en toda sesión— y la decisión **registra que las señales quedaron
      incompletas** (FR-015), para que el análisis no las cuente como una sesión sin actividad.
- [ ] T034 El motivo registrado **no es `barrier-unclear`**, y eso se prueba: confundirlos convertiría una
      falla de infraestructura en un dato falso del piloto, y nadie tendría con qué distinguirlos después.
- [ ] T035 Dejar escrito —en el código y en el ADR— que **el plazo de FR-016 no existe hoy**: `SqlStore` es
      síncrono y una lectura síncrona devuelve o lanza, así que «tardó demasiado» no puede ocurrir. La mitad
      que sí ocurre está cubierta; el plazo es de la spec del gateway de PostgreSQL (research R-03).

**Checkpoint**: lo que no se puede leer no se inventa, y se dice por qué no se intervino.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T036 **Medir SC-005**: el p95 de una decisión **que tuvo que reconstruir**, contra el de una que no.
      No hay presupuesto declarado porque no hay base de comparación; el número se publica con lo que es —
      SQLite local, sin red, o sea **no el caso que importa** (**D-21**).
- [ ] T037 `docs/adr/040-*.md` — el ADR de las decisiones transversales: la decisión **espera** I/O
      (excepción al principio IV, declarada y **sin cuantificar**, con el trato de ADR-038 menos el número);
      los puertos de lectura ganan canal de fallo **en dos de muchos**, como adelanto del hito; y el plazo de
      FR-016 diferido al gateway de PostgreSQL con su motivo técnico.
- [ ] T038 [P] `docs/deudas.md` — lo que esta feature deja anotado, si algo: el costo sin medir de la
      espera, y lo que el arranque en frío bajo carga no se puede saber hoy.
- [ ] T039 [P] Los READMEs que el cambio toca, con su inventario (ADR-032). `migrations/` ya en T008;
      verificar `contracts/` por el campo renombrado y `config/` por el valor.
- [ ] T040 Correr el **quickstart** de punta a punta, los siete pasos, y **anotar lo que aparezca**. En las
      dos features anteriores encontró lo que ningún gate veía — la última vez, seis pasos que daban verde
      sin ejecutar nada.
- [ ] T041 La cadena de cierre: `contract:check`, `test:all`, `test:mutation`, `test:contract`,
      `release-check`.

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (contrato)**: sin dependencias, y **va sola en su commit**. Bloquea a todo: el renombre rompe
  cada lector del campo viejo, y eso es lo que queremos que el compilador enumere de una vez.
- **Phase 2 (foundational)**: depende de la 1. **Bloquea a las tres historias.**
- **Phases 3, 4 y 5 (historias)**: dependen de la 2 y **entre ellas no**.
- **Phase 6 (Q1)**: depende de T013 (la tercera respuesta) y de que haya reconstrucción; en la práctica,
  después de la 3.
- **Phase 7 (polish)**: al final, salvo T038 y T039 que pueden ir antes.

### Dentro de cada fase

**Las pruebas primero y tienen que fallar**, que es lo que el flujo de la constitución pide. Los cinco
pares de esta lista: T006→T007 (la migración), T009→T010 (la lectura por visitante), T012→T013 (los
puertos), T015→T016 (la reconstrucción) y T029→T030 (la expiración).

**Las historias 1 y 2 no tienen par**, y es deliberado: su código lo entrega la fase 2, así que sus tareas
son **verificación de punta a punta** de algo ya construido — pasan desde el primer momento. Eso no las hace
ceremonia: son el único lugar donde se ve lo que un despliegue real hace, y la 031 mostró que una prueba de
gateway verde no dice nada sobre el camino completo.

`EXPLAIN QUERY PLAN` va **después** de las pruebas, porque el plan se verifica sobre una tabla con datos.
El gate de mutación al final de cada historia, sobre su diff.

### Paralelismo

Marcadas `[P]`: T008, T014, T018, T020, T021, T022, T025, T026, T029, T032, T033, T038, T039. Todas tocan
archivos distintos y ninguna depende de otra incompleta.

---

## Implementation Strategy

### Lo mínimo entregable

Phases 1, 2 y 3. Con eso **el daño que ocurre hoy en cada despliegue deja de ocurrir**, que es lo que
justifica la feature; las otras dos historias mejoran la calidad de la decisión y la eficiencia.

### Incremental

1. Phase 1 → el contrato dice lo que va a significar, y nada más se movió
2. Phase 2 → lo durable se puede leer y una sesión se puede reconstruir
3. Phase 3 → **MVP**: los topes sobreviven al despliegue
4. Phase 4 → la sesión vuelve como estaba
5. Phase 5 → en memoria está lo que está pasando
6. Phase 6 → lo que no se puede leer no se inventa
7. Phase 7 → medir, declarar, y **usar** el sistema

### Notas

- Un commit por tarea o por grupo lógico, en español, y **ninguno sin pruebas verdes**
- El gate de mutación es por historia; un superviviente se responde con la skill `triaging-mutants`
- **Los dos supervivientes que este repo produce siempre** y que esta feature va a tentar: el spread
  condicional sobre un campo opcional (`lastInterventionAt`) y un `??` sobre una clave. Reconocerlos al
  escribir cuesta menos que triarlos después
- Sin push hasta que el dueño lo pida; sin merge sin el dueño
