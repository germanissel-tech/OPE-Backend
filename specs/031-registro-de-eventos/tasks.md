---
description: "Task list template for feature implementation"
---

# Tasks: Lo que el SDK manda deja de ser invisible

**Input**: Design documents from `/specs/031-registro-de-eventos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y de tres clases. **Las que ya existen son el control**: FR-011 y SC-005 exigen que
ninguna cambie de expectativa, así que una prueba de comportamiento que haya que tocar es la señal de
que el registro dejó de ser un observador puro. **Las nuevas del proyecto `fast`** prueban la entidad,
la cola y las consultas. **La suite de durabilidad** prueba lo único que sólo se ve cruzando un
reinicio, que acá es la mitad de lo que la feature promete: que lo escrito sobrevive, que el apagado
drena y que una caída abrupta deja el hueco nombrado.

**Organization**: por historia. Esta feature **no toca HTTP**, así que el orden de seis pasos del
contrato no aplica; el que rige es el de anillos (ADR-013): infraestructura → dominio → aplicación →
adaptadores → composición.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (del click al veredicto), US2 (lo descartado), US3 (cuánto trabajo)
- Toda tarea nombra su archivo

---

## Phase 1: Setup — el runner de migraciones, primero y solo

**Propósito**: que un almacén existente pueda subir de versión. Va **antes de que exista la migración
002** y en su propio commit, por el mismo argumento con que la 030 separó el salto de Node: cambia cómo
**todo** almacén se abre, y si rompe algo, rompe algo que no tiene nada que ver con esta feature.

- [x] T001 `tests/durability/store.test.ts` — las pruebas del runner **primero, y tienen que fallar**:
      son cuatro casos porque son cuatro caminos distintos. Archivo vacío (aplica todas), archivo en la
      última versión (no hace nada), archivo **una versión atrás** (aplica sólo la pendiente y conserva
      las filas que tenía), y archivo en una versión **mayor** (se niega, y el mensaje dice qué
      esperaba). **El tercero es el que hoy no existe y es el motivo de esta fase**: tiene que fallar
      antes de T002 y pasar después, y las otras tres tienen que pasar en los dos momentos — son el
      control de que el cambio no rompió lo que ya funcionaba.
      **Verificado con `git stash`** sobre el cambio de T002: los dos casos nuevos fallan sin él y
      pasan con él. El de «ya al día» **pasa en los dos momentos**, y se dice en vez de contarlo como
      si probara algo: no es una capacidad nueva sino un guardia de regresión. Se agregó un cuarto
      caso que la tarea no pedía —una migración pendiente que falla a medias no deja nada—, porque la
      002 reconstruye siete tablas y sin transacción un fallo a mitad dejaría un esquema que no es ni
      el viejo ni el nuevo.
- [x] T002 `src/infrastructure/sqlite/open-store.ts` — `prepareSchema` aprende a aplicar **las
      migraciones pendientes**: las de versión mayor a la que el archivo declara, cada una en su
      transacción, verificando al final que la versión resultante es la esperada (research R-02). Se
      **conserva** la negativa a arrancar para los dos casos que la justificaban: una versión mayor que
      la que este build conoce, y una versión 0 con tablas adentro, que es otra base de datos en esa
      ruta.
      **Dos cosas que la tarea no había previsto.** El lint rechazó `BEGIN`/`COMMIT`/`ROLLBACK`
      repetidos, y tenía razón sobre algo real: la transacción de la migración era la misma que
      `SqlStore.transaction` ya hacía, así que salió un `inTransaction` que las dos usan — el
      duplicado era la transacción, no los literales. Y **un mutante sobrevivió**
      (`found < expected` → `<=`): era **equivalente**, porque un `return` temprano volvía inalcanzable
      ese borde. Se reestructuró en vez de excepcionarlo —estar al día dejó de ser un caso especial y
      pasó a ser el recorrido sin nada pendiente—, y el mutante murió. La razón queda en el código,
      donde alguien podría volver a «simplificarlo».
- [x] T003 Correr la cadena del lazo con el runner cambiado y **nada más**: `format:check`, `quality`,
      `typecheck`, `test`, `test:durability`. Si algo se movió, se ve acá con el diff más chico posible.
      **Verde**: 7 gates, 1380 pruebas del proyecto `fast` **sin una sola expectativa cambiada**, 50 de
      durabilidad (eran 47), y el gate de mutación acotado sin supervivientes. Más `check:language` y
      las 45 de documentación, por los dos documentos que el cambio volvió falsos y hubo que corregir:
      la sección de migraciones de `.claude/rules/gateway-durable.md` y la del arranque en
      `migrations/README.md`, que decían que el arranque rechaza todo lo que no sea la versión
      esperada.

**Checkpoint**: un almacén de la feature 030 puede subir de versión, y no hay ninguna migración nueva
todavía.

---

## Phase 2: Foundational — escribir el registro (bloquea a las tres historias)

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esto esté. Las tres leen de lo mismo.

### El esquema

- [ ] T004 `migrations/002-*.sql` — dos cosas en una migración porque son un solo cambio de criterio
      (FR-016): **las siete tablas de la 030 reformadas** a clave primaria autoincremental (lo que era
      clave de negocio pasa a índice UNIQUE) con `created_at` y `updated_at`, y la tabla
      **`received_events`** con sus cinco índices, tal como `data-model.md` los fija.
      Es una **reconstrucción de tabla** por cada una —crear, copiar, borrar, renombrar—: SQLite no
      admite agregar una `PRIMARY KEY` ni una columna `NOT NULL` con default no constante (research
      R-03). Los timestamps de las filas que ya existan valen **el instante de la migración**, y el
      comentario del archivo lo dice, porque su instante real no existe e inventarle otro sería escribir
      un dato falso en un registro de auditoría.
- [ ] T005 [P] `tests/durability/store.test.ts` — que **ninguna** de las ocho tablas queda fuera de las
      dos reglas (SC-009), leyendo el **esquema del almacén** y no la migración: lo que importa es lo que
      quedó. Y que las filas que había antes de migrar siguen ahí con su contenido.
- [ ] T006 [P] `migrations/README.md` — la fila del inventario de `002` y la tabla de «qué hace una
      segunda escritura con la misma clave» extendida con `received_events`. Sin cifras de estado
      (ADR-032); `tests/docs/readmes.test.ts` es el gate.

### La identidad y la entidad

- [ ] T007 [P] `src/domain/ingestion/ids.ts` — `BatchId` junto a `EventId`, con su `asBatchId`. Vive acá
      y no en el shared kernel porque tiene un dueño claro: la ingesta acuña la llegada (research R-05).
      El comentario dice **qué identifica y qué no**, porque la constitución VI avisa que colapsar
      identidades es el error más caro: identifica **una llegada**, no un evento, no una sesión.
- [ ] T008 [P] `src/application/ingestion/ports/batch-id-generator.ts` — el puerto que acuña, con la
      forma de `DecisionIdGenerator`: quien acuña un id lo pide por un puerto del dueño, nunca al
      kernel.
- [ ] T009 `tests/unit/domain/ingestion/recorded-event.test.ts` — **antes de la entidad**: las tres
      invariantes en sus dos sentidos, y que `rehydrate` acepta lo que `of` rechazaría, porque un cambio
      de reglas no debe romper la lectura de un histórico que la feature promete conservar entero.
- [ ] T010 `src/domain/ingestion/recorded-event.ts` — la entidad, **clase porque tiene reglas**
      (ADR-024): `private constructor`, `of(...)` que devuelve `Result`, `rehydrate` que **no re-juzga**
      y `record()`. Las tres invariantes de `data-model.md`, y la primera es la que importa:
      `rejected` ⟺ `rejectedBy` presente ⟺ `decisionId` ausente, porque una fila que dice «rechazado» y
      trae una decisión es un dato falso sobre por qué el tráfico no intervino.

### El puerto, sus dos implementaciones y la cola

- [ ] T011 `src/application/ingestion/ports/event-log.ts` — el puerto como `data-model.md` lo fija.
      **`record(...)` devuelve `void`, no `Promise`, y no tiene canal de fallo**, y el comentario explica
      el mecanismo: un tipo que se puede esperar invita a esperarlo, y ahí se pierde FR-007. El
      requisito deja de depender de que alguien se acuerde.
- [ ] T012 `src/interface-adapters/ingestion/queue/` — la cola: encolar es una operación en memoria que
      **no espera**, vaciar corre aparte. Implementa `Closeable` para drenar al cerrar (FR-017). El
      drenaje **tiene techo**: `SHUTDOWN_TIMEOUT_MS` son 10 s y pasado el plazo el proceso sale con 1
      (research R-09), así que lo que no alcance a salir se trata como lo de una caída abrupta en vez de
      colgar el apagado.
- [ ] T013 [P] `config/platform.json` y su esquema — el **tamaño de la cola** y su **intervalo de
      vaciado** como entradas del nivel plataforma, no constantes: son reglas del despliegue y
      `check:behaviour-constants` rechaza la constante (constitución XI, ADR-031).
- [ ] T014 `tests/unit/.../event-log.test.ts` — **antes de las dos implementaciones**: un solo contrato
      de pruebas que se corre contra ambas, para que no puedan divergir. Es lo que hizo que en la 030 la
      memoria y SQLite terminaran rechazando igual una sobreescritura, en vez de que el comportamiento
      dependiera del despliegue.
- [ ] T015 [P] `src/interface-adapters/ingestion/gateways/memory-event-log.ts` — la implementación del
      lazo local y del proyecto `fast`. Existe para que ninguna prueba unitaria tenga que abrir un
      almacén, que es lo que mantiene rápido el lazo que el gate de mutación necesita (ADR-016).
- [ ] T016 [P] `src/interface-adapters/ingestion/gateways/sqlite-event-log.ts` — la durable, con el patrón
      de `.claude/rules/gateway-durable.md`: el driver **llega por el enlace**, se escribe
      `entidad.record()`, y al leer **toda clase anidada se rehidrata** — el error que se ve bien en toda
      lectura y falla en la única escritura que importa.

### El cableado y el punto de encolado del camino aceptado

- [ ] T017 `src/composition/modules/ingestion.ts` — el puerto nuevo con sus dos tecnologías, elegidas por
      el despliegue (`ADR-033`, `.with("sqlite")`), y la cola en el grafo **después** del almacén, para
      que el cierre en orden inverso drene antes de cerrarlo (research R-09).
- [ ] T018 [P] `src/composition/deployments/{local,durable}.ts` — cada despliegue elige. No compila si
      nadie elige, que es la garantía que ADR-033 da.
- [ ] T019 `src/application/ingestion/use-cases/ingest-batch.use-case.ts` — el **punto 1**: después de
      `decisionPlane.decide`, porque el `decisionId` y el brazo no existen antes (research R-01). Encola
      una fila por evento con su `disposition` —`accepted` o `duplicate`, que salen del mismo
      `results`—, su `receivedAt`, su decisión y su brazo. El caso de uso queda en **cinco**
      dependencias, dentro del máximo de seis de ADR-023.
- [ ] T020 `src/domain/ledger/decision.ts` — `DecisionFacts` gana **cuántos eventos traía el lote**. Es
      lo que permite nombrar el hueco en eventos y no sólo en lotes (research R-10). No cambia ningún
      veredicto ni ninguna respuesta, así que no viola FR-011 — y T021 lo verifica en vez de afirmarlo.
- [ ] T021 `npm test` — **ninguna prueba de comportamiento cambia de expectativa** (SC-005). Si hay que
      tocar una, el registro dejó de ser un observador puro y eso es un defecto de esta feature, no una
      expectativa a actualizar.

**Checkpoint**: lo que el SDK manda se escribe, sobrevive a un reinicio, y la decisión no se enteró.

---

## Phase 3: User Story 1 — Del click al veredicto, y al revés (P1) 🎯 MVP

**Goal**: de una decisión se llega a lo que se recibió, y de lo recibido a la decisión que produjo, con
el brazo con el que entró.

**Independent Test**: ingestar un lote, esperar a que la cola se vacíe, y recorrer el vínculo en los dos
sentidos.

- [ ] T022 [P] [US1] `tests/durability/event-log.test.ts` — los cinco escenarios de aceptación de la
      historia, **cruzando un reinicio** (FR-009): el contenido igual, de la decisión a los eventos, de
      un evento a su decisión **incluida la que resultó `NO_OP`**, el brazo, y el aislamiento entre dos
      merchants. Se escriben antes de las consultas y tienen que fallar.
- [ ] T023 [P] [US1] `tests/integration/...` — que un lote **sin experimento activo** se registra **sin
      brazo**, y no con `CONTROL` inventado. Es la distinción que la spec marcó como caso borde y la
      que haría falsa toda lectura del piloto si se perdiera.
- [ ] T024 [US1] `sqlite-event-log.ts` y su par en memoria — `byDecision` y `bySession`, con los índices
      `(merchant_id, decision_id)` y `(merchant_id, session_id, id)`. El segundo es el que la **032**
      va a consumir para reconstruir señales, y el `id` en el índice es lo que da el orden de llegada
      sin que ninguna columna lleve un contador que pueda discrepar con la realidad.
- [ ] T025 [US1] Verificar con `EXPLAIN QUERY PLAN` que las dos consultas usan su índice, no que lo
      tienen: en esta feature un índice equivocado salió **más de tres veces peor que ninguno**
      (research R-06). Si dice `SCAN`, el índice no sirve. Va después de las pruebas porque el plan se
      verifica sobre una tabla con datos.
- [ ] T026 [US1] `npm run test:mutation` acotado al diff de la historia. Ningún mutante de las líneas
      propias sobrevive; si sobrevive, la skill `triaging-mutants` y su orden de cuatro pasos.

**Checkpoint**: la historia 1 funciona sola y es la feature mínima entregable.

---

## Phase 4: User Story 2 — Lo que se descartó también deja rastro (P2)

**Goal**: el duplicado y el lote rechazado quedan con su motivo. Es la mitad que vuelve **forense** al
registro: un registro que sólo guarda lo aceptado muestra el tráfico que OPE entendió, no el que llegó.

**Independent Test**: mandar un lote con un evento repetido y otro con un instante fuera de tolerancia, y
encontrar los dos con su motivo.

- [ ] T027 [P] [US2] `tests/durability/...` — los cuatro escenarios, antes de la implementación: la
      repetición registrada como repetición y no como evento nuevo, el instante fuera de tolerancia con
      su invariante, el lote que mezcla sesiones con **los `session_id` de cada evento** —que es lo que
      permite _mostrar_ la mezcla en vez de esconderla (research R-07)—, y que consta que **no produjo
      decisión**.
- [ ] T028 [P] [US2] `tests/integration/...` — el caso que SC-003 pide y que hoy es imposible:
      **distinguir un merchant sin tráfico de uno cuyo tráfico se descartó**. Es la prueba que justifica
      la historia.
- [ ] T029 [US2] `ingest-batch.use-case.ts` — el **punto 2**: el `return fail(batch.error)`, que es el
      único lugar donde se sabe qué llegó y qué invariante lo rechazó (research R-01). Ese camino **no
      pasa por el plano de decisión**, así que las filas van sin `decisionId` y sin brazo, y eso es
      exactamente lo que FR-006 pide poder ver.
- [ ] T030 [US2] `sqlite-event-log.ts` y su par — `byEvent`, con el índice `(merchant_id, event_id)`
      **no único**. La no-unicidad **es el diseño**: un reintento del SDK trae el mismo `eventId` y cada
      llegada es un hecho (research R-04). Es lo que reconstruye la referencia al duplicado sin tocar el
      puerto de deduplicación (research R-08).
- [ ] T031 [US2] Que la referencia al duplicado **puede faltar** y eso está bien: si la llegada original
      cayó fuera del registro, queda la repetición con su motivo y sin puntero (research R-08). Es
      coherente con Q3 y se prueba, no se asume.
- [ ] T032 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las historias 1 y 2 funcionan, cada una por su cuenta.

---

## Phase 5: User Story 3 — Cuánto trabajo está haciendo esto (P3)

**Goal**: cuántos eventos por merchant, de qué tipos, en qué ventana, sin abrir cada registro.

**Independent Test**: ingestar tráfico de dos merchants y obtener por cada uno su volumen por tipo.

- [ ] T033 [US3] `tests/durability/...` — los dos escenarios, antes de la consulta: conteos separados por
      merchant sin que ninguno incluya al otro, y la distribución por tipo legible en **una sola
      consulta** (SC-007).
- [ ] T034 [US3] `sqlite-event-log.ts` y su par — `volume`, con el índice **de cobertura**
      `(merchant_id, created_at, type)`. La cobertura no es un detalle: medido, la misma consulta cuesta
      507 ms sin índice útil, **1 703 ms** con `(merchant_id, type)` y **107 ms** con éste.
- [ ] T035 [US3] `EXPLAIN QUERY PLAN` sobre la consulta de volumen: tiene que usar
      `received_events_volume`. Es la tarea que la medición de R-06 hizo obligatoria.
- [ ] T036 [US3] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: La integridad del registro — lo que Q3 decidió

**Propósito**: no es una historia, es la promesa que hace confiable a las tres. El registro **no promete
completitud; promete saber dónde no la tiene.**

- [ ] T037 `tests/durability/...` — los dos casos, opuestos a propósito y antes de lo que los hace pasar:
      apagado ordenado **no pierde nada**; terminación abrupta pierde lo encolado y al volver **el hueco
      queda nombrado** — cuántos eventos y en qué intervalo (SC-010).
- [ ] T038 El apagado ordenado drena la cola (FR-017): la cola se cierra **antes** del almacén porque el
      grafo cierra en orden inverso a la creación, y eso sale de T017 y no de una lista que alguien
      tenga que mantener.
- [ ] T039 La reconciliación al arrancar (FR-018): una decisión **sin sus eventos registrados** es un
      lote que llegó y no se escribió, y su `decidedAt` da el intervalo. El conteo es en eventos gracias
      a T020. Se registra al volver.
- [ ] T040 Dejar escrito en el código y en el ADR que **los dos tramos no tienen la misma garantía**: los
      lotes aceptados se reconcilian contra el ledger, los rechazados se cuentan desde el log operativo
      porque no dejan decisión (research R-10). Se declara, no se promedia.

**Checkpoint**: lo que el registro no sabe, lo dice.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T041 **Medir SC-004**: el p95 del lote de ingesta contra lo que la 030 midió (memoria 0,90–1,35 ms;
      SQLite 1,94–2,72 ms) sobre el presupuesto de 150 ms de `01 §4.6`. Es la verificación de FR-007, y
      el número se publica con lo que es: SQLite local, no el motor de producción (**D-21**).
- [ ] T042 `docs/adr/039-*.md` — el ADR de las tres decisiones transversales de esta feature, juntas
      porque salen del mismo razonamiento: el registro vive en el **camino de medición** (`01 §P9`, la
      primera vez que ese principio se cumple entero), hace falta una **quinta identidad** y por qué las
      cuatro no alcanzan, y el runner **aplica migraciones hacia adelante**. Con la evidencia, como
      ADR-038.
- [ ] T043 [P] `docs/deudas.md` — cerrar la parte de **D-21** que esta feature salda: el orden de
      inserción deja de apoyarse en el `rowid` implícito de SQLite, que no existe en PostgreSQL. Las
      otras dos siguen abiertas y se dice cuáles.
- [ ] T044 [P] Los READMEs que el cambio toca, con su inventario (ADR-032): `migrations/` ya en T006,
      más `tests/` si la suite gana archivos y `config/` por las dos entradas nuevas.
- [ ] T045 Correr el **quickstart** de punta a punta, los ocho pasos, y **anotar lo que aparezca**. Es la
      tarea que la 030 demostró que no es ceremonia: sus cuatro arreglos posteriores al verde salieron de
      usar el sistema, ninguno de correr la cadena de gates sobre sí misma.
- [ ] T046 La cadena de cierre: `contract:check`, `test:all`, `test:mutation`, `test:contract`,
      `release-check`.

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (runner)**: sin dependencias, y **va sola en su commit**. Bloquea a la 2, porque sin ella la
  migración 002 deja sin arrancar a cualquier almacén existente.
- **Phase 2 (foundational)**: depende de la 1. **Bloquea a las tres historias.**
- **Phases 3, 4 y 5 (historias)**: dependen de la 2 y **entre ellas no**. En orden de prioridad, o en
  paralelo si hubiera con quién.
- **Phase 6 (integridad)**: depende de T020 (el campo de la decisión) y de que haya algo escrito; en la
  práctica, después de la 3.
- **Phase 7 (polish)**: al final, salvo T043 y T044 que pueden ir antes.

### Dentro de cada fase y cada historia

**Las pruebas primero y tienen que fallar**, que es lo que el flujo de la constitución pide («las de
contrato y pruebas preceden a las de implementación») y lo que hace que una prueba pruebe algo. Después la
implementación; después `EXPLAIN QUERY PLAN`, que necesita una tabla con datos; el gate de mutación al
final, sobre el diff de la historia.

Los pares prueba→implementación de esta lista: T001→T002 (el runner), T009→T010 (la entidad), T014→T015 y
T016 (los dos gateways), T022 y T023→T024 (US1), T027 y T028→T029 y T030 (US2), T033→T034 (US3),
T037→T038 y T039 (la integridad).

### Paralelismo

Marcadas `[P]`: T005, T006, T007, T008, T013, T015, T016, T018, T022, T023, T027, T028, T043, T044.
Todas tocan archivos distintos y ninguna depende de otra incompleta.

En Phase 2 el bloque de la identidad y la entidad (T007–T010) es independiente del bloque del esquema
(T004–T006): son dos frentes que se pueden hacer a la vez.

---

## Implementation Strategy

### Lo mínimo entregable

Phases 1, 2 y 3. Con eso, de una decisión se llega a lo que la produjo y al revés — que es la feature;
lo demás son variantes de lo mismo, como la propia spec dice de su historia 1.

### Incremental

1. Phase 1 → un almacén puede subir de versión, y nada más se movió
2. Phase 2 → el tráfico se escribe y sobrevive a un reinicio
3. Phase 3 → **MVP**: del click al veredicto y al revés
4. Phase 4 → lo descartado deja rastro, y un merchant sin tráfico se distingue de uno descartado
5. Phase 5 → el volumen, antes del piloto
6. Phase 6 → el registro dice lo que no sabe
7. Phase 7 → medir, declarar, y **usar** el sistema

### Notas

- Un commit por tarea o por grupo lógico, en español, y **ninguno sin pruebas verdes**
- El gate de mutación es por historia, no al final: un mutante que sobrevive se responde con la skill
  `triaging-mutants` y su orden de cuatro pasos, que existe para no pagar la corrida completa dos veces
- Sin push hasta que el dueño lo pida; sin merge sin el dueño
