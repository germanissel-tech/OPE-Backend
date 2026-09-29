---
description: "Task list template for feature implementation"
---

# Tasks: Nada de lo que se configuró u observó se pierde en un reinicio

**Input**: Design documents from `/specs/033-configuracion-durable/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí. Como en la 032, **el escenario es el reinicio**, así que la suite de durabilidad no cubre
una mitad sino casi todo. Y hay dos cosas más que sólo se ven ahí: el plan de consulta de cada índice
sobre una tabla con filas, y la latencia.

**Organization**: por historia. **Esta feature no toca HTTP**: el contrato no cambia, ninguna operación
se agrega ni cambia, así que el orden de seis pasos de `.claude/rules/contrato.md` no se dispara. Que eso
esté dicho es lo que evita que alguien busque el paso que falta.

**Tres historias y no cuatro.** La historia 4 de la spec —la auditoría atómica— **no entra**, con el
diseño registrado en **D-28** (research R-05 y su enmienda). No es una tarea pendiente de esta lista: es
otra feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (el merchant sobrevive), US2 (configuración, historial, experimentos), US3 (lo observado del tráfico)
- Toda tarea nombra su archivo

---

## Phase 1: Foundational — el esquema (bloquea a las tres historias)

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esto esté.

- [x] T001 `tests/durability/store.test.ts` — **antes de la migración**: un almacén en versión 3 sube a 4,
      **lo que ya tenía queda intacto**, y las siete tablas nuevas quedan vacías. Es la primera migración de
      la serie que **sólo crea**, así que el caso a verificar no es un traspaso sino que no toca nada.
- [x] T002 `migrations/004-*.sql` — las siete tablas de `data-model.md`. Lo que hay que no equivocarse:
      `merchant_origins` con **índice único global sobre `origin`** (un origen pertenece a un solo
      merchant, desactivados incluidos); `anchor_diagnostics` único por merchant, anclaje y superficie con
      **`count` como columna**; `admin_entries` **sin** clave de negocio y con `merchant_id` nullable; y
      **ningún índice por huella de credencial**, que es deliberado y va dicho en el archivo.
- [x] T003 [P] `migrations/README.md` — la fila del inventario de `004` y el diagrama ER con las siete
      tablas. Sin cifras de estado (ADR-032); `tests/docs/readmes.test.ts` es el gate, y lee de
      `git ls-files`: **una migración sin rastrear no cuenta** (lo encontró la 032).
- [x] T004 Correr `npm run test:durability` y `npm test` con la migración y **nada más**: el esquema sube
      y nada cambia de comportamiento. Es el checkpoint más barato de toda la feature y el que aísla un
      problema de esquema de un problema de gateway.

**Checkpoint**: el almacén tiene dónde guardar, y nada más se movió.

---

## Phase 2: User Story 1 — Un merchant dado de alta sigue existiendo (P1) 🎯 MVP

**Goal**: lo que un operador da de alta sirve tráfico después del despliegue.

**Independent Test**: dar de alta un merchant, reiniciar, y que una petición con la credencial emitida
antes del reinicio responda `202`.

### El gateway y lo que se rompe en silencio

- [x] T005 [US1] `tests/durability/merchant-store.test.ts` — **antes del gateway**, y el caso que decide la
      historia: un merchant leído del almacén **autentica**. No que exista, no que se liste: que
      `allowsOrigin` y la resolución por huella funcionen. Es donde se ve si los orígenes se rehidrataron.
- [x] T006 [US1] `src/interface-adapters/merchant/gateways/sqlite-merchant-store.ts` — el gateway.
      **`Origin` es una clase con `equals` y `JSON.parse` no devuelve clases**: un merchant leído sin
      rehidratar sus orígenes se lista bien, se ve bien en el panel y **no autentica ninguna petición**.
      El síntoma no aparece al leer. `Credential` es un tipo y las fechas vuelven marcadas, así que ésos
      vuelven solos.
- [x] T007 [US1] `tests/durability/merchant-store.test.ts` — la unicidad de origen, **cruzando el
      reinicio** y **alcanzando a los desactivados**: el origen de un merchant desactivado sigue reservado.
      Lo decide el índice y no una lectura previa, que es la carrera que `01 §6` prohíbe.
- [x] T008 [US1] La gracia de una credencial rotada como **instante**: una gracia vencida durante el
      apagado no autentica al volver. El apagado no es un temporizador que se pausa.

### El índice en memoria, que es el riesgo de la feature

- [x] T009 [US1] `tests/unit/interface-adapters/merchant/` — **antes del índice**: los tres mapas se llenan
      al abrir, se actualizan **después** de una escritura exitosa y **no** después de una fallida. El
      segundo es el que importa: un índice que se actualiza antes de que el almacén acepte es una verdad
      que el almacén no tiene.
- [x] T010 [US1] El índice en `sqlite-merchant-store.ts`: por identificador, por huella y por origen.
      **Y el comentario que dice exactamente cuándo deja de ser correcto** — con dos procesos, el índice
      de uno no ve el alta del otro y un merchant recién creado autenticaría en un nodo y no en el otro
      (**D-21**). Va en el gateway y no sólo en la investigación, porque es ahí donde alguien lo va a leer.
- [x] T011 [US1] `tests/durability/merchant-store.test.ts` — que el índice **se reconstruye al abrir**:
      tras un reinicio, un merchant escrito antes resuelve por huella y por origen sin que nadie lo haya
      tocado en este proceso.

### El cableado, la semilla y la medición

- [x] T012 [US1] `src/composition/` — `merchantModule.with("sqlite")` en `deployments/durable.ts` y la
      tecnología en su módulo. Un módulo con dos tecnologías **no compila si nadie elige** (ADR-033), así
      que olvidarse falla en compilación.
- [x] T013 [US1] `src/composition/bootstrap.ts` — la línea que hoy falta (SC-008). `importSeed` ya conserva
      lo que hay; lo que se agrega es que **lo diga** cuando no se aplica, y que la vía es la API. Hoy
      `if (imported > 0)` calla justo en el caso que confunde. **Sin la cifra, decidido al implementar**:
      el caso de uso responde `skipped` y nada más, y contar los merchants en el arranque sólo para poner
      un número en una línea de log es trabajo por una línea; lo que faltaba era el motivo.
- [x] T014 [US1] `tests/durability/` — el arranque en sus **dos** situaciones: almacén vacío que importa, y
      almacén con merchants que no importa y lo dice. Una sola no dice nada: el silencio es el defecto.
- [x] T015 [US1] `tests/durability/ingest-latency.test.ts` — **SC-002, la condición de aceptación**: el p95
      de la ingesta con el almacén durable contra el mismo con todo en memoria, **en la misma corrida**.
      Acá es donde el índice se justifica o no; si esto empeora de forma apreciable, la feature no está
      terminada. Y la lección de la 032: comparar dos cosas que no arrastran la misma historia da una
      diferencia que no significa nada.
- [x] T016 [US1] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: la historia 1 funciona sola y **es la feature mínima entregable** — un panel deja de ser
una consola sobre algo que se borra.

---

## Phase 3: User Story 2 — La configuración, el historial y los experimentos (P2)

**Goal**: lo publicado es auditable, no sólo vigente.

**Independent Test**: publicar dos versiones y abrir un experimento con asignaciones, reiniciar, y que las
versiones estén con su orden y su autoría y que un visitante ya asignado vuelva al mismo brazo.

- [ ] T017 [P] [US2] `tests/durability/configuration-store.test.ts` — **antes del gateway**: dos versiones
      con su orden, su operador, su instante y su motivo, y **la efectiva es la de versión máxima**. Sin
      bandera de «vigente», que sería un segundo lugar donde decir lo mismo.
- [ ] T018 [US2] `src/interface-adapters/configuration/gateways/sqlite-configuration-store.ts` — único por
      `(merchant, version)`; `versionsOf` pagina por versión descendente.
- [ ] T019 [P] [US2] `tests/durability/experiment-store.test.ts` — **antes del gateway**: un experimento
      calibrando sigue calibrando, con su reparto, su semilla, su muestra y sus reinicios de ventana. Y si
      alguna parte de su documento es una clase, se nombra y se rehidrata — la misma trampa que T006.
- [ ] T020 [US2] `src/interface-adapters/experiment/gateways/sqlite-experiment-store.ts` — único por
      `(merchant, experiment)`. El estado **no** es columna: `listOf` trae los del merchant y filtra el
      llamador.
- [ ] T021 [US2] `tests/durability/experiment-store.test.ts` — **SC-004, la incoherencia que esto arregla**:
      ninguna asignación queda apuntando a un experimento inexistente después de un reinicio, y un
      visitante ya asignado vuelve al mismo brazo. Hoy no se nota en los merchants de la semilla porque el
      archivo trae los mismos identificadores; con uno creado por la API, el identificador se perdía.
- [ ] T022 [US2] `src/interface-adapters/admin/gateways/sqlite-admin-log.ts` — append-only, **sin clave de
      negocio y sin índice único**: dos acciones idénticas del mismo operador en el mismo instante son dos
      acciones. `merchant_id` nullable porque la ausencia **significa** una acción de plataforma.
- [ ] T023 [US2] `tests/durability/admin-log.test.ts` — el registro global y el del merchant después de un
      reinicio, con el aislamiento: el de un merchant trae sólo las suyas y **ninguna de plataforma**.
- [ ] T024 [US2] `src/composition/` — las tres tecnologías en `deployments/durable.ts` y sus módulos.
- [ ] T025 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las historias 1 y 2 funcionan, cada una por su cuenta.

---

## Phase 4: User Story 3 — Lo que se observó del tráfico sigue ahí (P3)

**Goal**: las dos listas que el panel muestra no se vacían en un deploy, y un reintento sigue siendo un
duplicado.

**Independent Test**: reportar diagnósticos y publicar un catálogo con una etiqueta sin mapear, reiniciar,
y ver las dos listas con sus conteos; reenviar un evento de antes del reinicio y ver que cuenta como
duplicado.

### Las dos listas del panel

- [ ] T026 [P] [US3] `tests/durability/admin-observations.test.ts` — **antes de los gateways**: los
      diagnósticos siguen con su conteo y un reporte posterior al reinicio **acumula sobre lo que ya
      había**. Ese «acumula» es el caso que distingue un `upsert` de un `insert`.
- [ ] T027 [US3] `src/interface-adapters/admin/gateways/sqlite-anchor-diagnostics-store.ts` — único por
      `(merchant, anclaje, superficie)` y **`count` incrementado en el almacén**
      (`ON CONFLICT … DO UPDATE SET count = count + 1`): hacerlo leyendo y escribiendo es otra carrera. El
      tope por merchant **llega con cada escritura**, porque es política y no esquema (constitución XI).
- [ ] T028 [US3] `src/interface-adapters/admin/gateways/sqlite-unmapped-value-log.ts` — `replace` borra el
      conjunto del merchant y escribe el nuevo **en una transacción**: un reemplazo a medias deja un
      conjunto que nunca existió.
- [ ] T029 [P] [US3] `tests/durability/admin-observations.test.ts` — el tope de valores sin mapear se aplica
      **sobre lo conservado**, no sobre lo que llegó en esta corrida.

### La ventana de deduplicación, recuperable

- [ ] T030 [US3] `src/application/ingestion/ports/event-log.ts` y sus dos gateways — la lectura de los
      identificadores de un merchant dentro de una ventana, acotada al tope. **No existe hoy** (`volume`
      devuelve conteos por tipo, no ids) y **el índice que necesita ya existe**:
      `received_events_volume (merchant_id, received_at, type)` sirve por su prefijo.
- [ ] T031 [P] [US3] `tests/unit/interface-adapters/ingestion/` — **antes del envoltorio**: se reconstruye
      **una vez por merchant y por arranque**, se respeta el tope con los más recientes, y **si la lectura
      falla el `claim` sigue respondiendo**. El tercero es el que importa: degradar la ingesta porque una
      reconstrucción de medición falló sería la mezcla que `01 §P9` existe para evitar.
- [ ] T032 [US3] `src/interface-adapters/ingestion/gateways/recovering-event-dedup.ts` — el envoltorio
      sobre la deduplicación en memoria, como `queuedEventLog` envuelve el registro. El gancho es el primer
      `claim` de cada merchant desde el arranque.
- [ ] T033 [US3] `tests/durability/event-dedup.test.ts` — **SC-006 por los dos lados**: un evento reenviado
      tras el reinicio cuenta como duplicado **y** el primer lote de un merchant no tarda apreciablemente
      más que el siguiente. Una sola mitad deja pasar el diseño equivocado.
- [ ] T034 [US3] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 5: Los planes de consulta, sobre tablas con filas

- [ ] T035 `tests/durability/` — `EXPLAIN QUERY PLAN` de las lecturas nuevas **sobre tablas con filas**,
      porque SQLite planifica distinto una vacía y la misma aserción contra un almacén fresco pasa sin
      decir nada (lo aprendió la 032). Las que importan: la unicidad de origen, las versiones de
      configuración por merchant, el registro por merchant, el `upsert` del diagnóstico, y la lectura
      nueva del registro de eventos. Si alguna dice `SCAN`, el índice no sirve.
- [ ] T036 **SC-011, el inventario completo**: una prueba que recorre los puertos de almacenamiento y
      falla si alguno no está clasificado —ya durable, esta feature, recuperable, configuración del
      despliegue—. Es lo que vuelve verificable «todo persiste»; sin eso es una afirmación que la próxima
      feature vuelve a descubrir incompleta, **que es lo que pasó al escribir esta spec**.

**Checkpoint**: lo que se agregó usa sus índices, y la afirmación de la spec es un gate y no una frase.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T037 `docs/adr/041-*.md` — la **tercera** excepción al principio IV: una lectura local en el borde de
      autenticación de todo request. Con el trato de ADR-038 y ADR-040 —nombrada, medida contra la única
      base que hay, con su costo real abierto— más las dos alternativas de R-02 y por qué el índice gana
      por lo que cuesta **mañana** y no por lo que cuesta hoy.
- [ ] T038 [P] `migrations/README.md` — **mudar ahí el inventario de portabilidad** que hoy vive en el
      plan. Un plan se archiva con su feature y ese inventario no caduca; el README es documento vivo y
      tiene un gate que lo verifica. Sin cifras de cuántas veces aparece cada construcción: eso lo informa
      un `grep`.
- [ ] T039 [P] `docs/deudas.md` — lo que esta feature deja anotado, si algo. **D-28 ya está** (la auditoría
      atómica con su diseño) y **D-21 gana** lo que el índice en memoria le apoya encima.
- [ ] T040 [P] Los READMEs que el cambio toca, con su inventario (ADR-032). `migrations/` en T003 y T038;
      verificar `tests/` por las suites nuevas y `config/` si algo del archivo semilla cambió de rol.
- [ ] T041 Correr el **quickstart** de punta a punta, los siete pasos, y **anotar lo que aparezca**. En las
      tres features anteriores encontró lo que ningún gate veía — la última vez, un paso que seguido al pie
      no llegaba a intervenir nunca.
- [ ] T042 La cadena de cierre: `contract:check`, `test:all`, `test:mutation`, `test:contract`,
      `release-check`.

---

## Dependencies & Execution Order

### Entre fases

- **Phase 1 (esquema)**: sin dependencias. **Bloquea a las tres historias.** Va en su propio commit: si
  algo se mueve, conviene verlo con el diff más chico posible.
- **Phases 2, 3 y 4 (historias)**: dependen de la 1 y **entre ellas no**.
- **Phase 5 (planes)**: después de las historias, porque el plan se verifica sobre tablas con datos.
- **Phase 6 (polish)**: al final, salvo T038, T039 y T040 que pueden ir antes.

### Dentro de cada fase

**Las pruebas primero y tienen que fallar.** Los pares de esta lista: T001→T002 (la migración), T005→T006
(el gateway del merchant), T009→T010 (el índice), T017→T018 y T019→T020 (configuración y experimentos),
T026→T027 (el `upsert`) y T031→T032 (la reconstrucción de la ventana).

**El gate de mutación al final de cada historia**, sobre su diff.

### Paralelismo

Marcadas `[P]`: T003, T017, T019, T026, T029, T031, T038, T039, T040. Tocan archivos distintos y ninguna
depende de otra incompleta.

---

## Implementation Strategy

### Lo mínimo entregable

Phases 1 y 2. Con eso **un merchant dado de alta por la API sirve tráfico después del deploy**, que es lo
que justifica la feature y lo que convierte un panel en herramienta. Las otras dos historias agregan lo
que ese panel muestra y la fidelidad de la deduplicación.

### Incremental

1. Phase 1 → el almacén tiene dónde guardar, y nada más se movió
2. Phase 2 → **MVP**: el merchant sobrevive, y SC-002 dice si el índice valió
3. Phase 3 → la configuración es auditable y ninguna asignación queda huérfana
4. Phase 4 → el panel no se vacía y un reintento sigue siendo un reintento
5. Phase 5 → los índices se usan, y «todo persiste» pasa a ser un gate
6. Phase 6 → declarar, mudar lo que no caduca, y **usar** el sistema

### Notas

- Un commit por tarea o por grupo lógico, en español, y **ninguno sin pruebas verdes**
- **La comprobación que en la 032 encontró dos falsos verdes**: desactivar la implementación y ver que la
  prueba falla. Acá aplica a T011 (el índice tras el reinicio), T021 (las asignaciones huérfanas) y T033
  (el duplicado). Cuesta un minuto
- **Los dos supervivientes que este repo produce siempre** y que esta feature va a tentar: el spread
  condicional sobre un campo opcional, y un `??` sobre una clave de búsqueda — y acá hay tres mapas con
  claves compuestas, así que el segundo es probable
- Sin push hasta que el dueño lo pida; sin merge sin el dueño
