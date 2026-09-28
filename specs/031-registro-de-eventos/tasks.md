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

- [x] T004 `migrations/002-*.sql` — dos cosas en una migración porque son un solo cambio de criterio
      (FR-016): **las siete tablas de la 030 reformadas** a clave primaria autoincremental (lo que era
      clave de negocio pasa a índice UNIQUE) con `created_at` y `updated_at`, y la tabla
      **`received_events`** con sus cinco índices, tal como `data-model.md` los fija.
      Es una **reconstrucción de tabla** por cada una —crear, copiar, borrar, renombrar—: SQLite no
      admite agregar una `PRIMARY KEY` ni una columna `NOT NULL` con default no constante (research
      R-03). Los timestamps de las filas que ya existan valen **el instante de la migración**, y el
      comentario del archivo lo dice, porque su instante real no existe e inventarle otro sería escribir
      un dato falso en un registro de auditoría.
      **Tres cosas que la tarea no había previsto, y las tres eran necesarias.** (1) Los `INSERT` de los
      gateways no listan las columnas nuevas y son `NOT NULL`, así que **fallarían todos**: los dos
      timestamps van con `DEFAULT` en el esquema, y hay un motivo de fondo —son hechos **del
      almacenamiento**, no del dominio, mientras un instante que el dominio significa llega por el
      puerto `Clock`—. Así ningún gateway puede olvidarlos y la regla de que son iguales al crear se
      cumple por construcción. (2) Un `DEFAULT` no se dispara en un `UPDATE`, así que los dos únicos
      lugares que actualizan una fila —la devolución de una orden y una instantánea republicada— mueven
      `updated_at` ellos mismos. (3) **Tres gateways nombraban `rowid`**, el implícito de SQLite que
      PostgreSQL no tiene: ahora nombran `id`, y ésa es la deuda de D-21 que esta migración salda.
- [x] T005 `tests/durability/store.test.ts` — que **ninguna** de las ocho tablas queda fuera de las
      dos reglas (SC-009), leyendo el **esquema del almacén** y no la migración: lo que importa es lo que
      quedó. Y que las filas que había antes de migrar siguen ahí con su contenido.
      **Lo importante es cómo se prueba**: la suite crea almacenes nuevos que reciben las dos
      migraciones juntas, que es justo el caso que **no puede** mostrar si una reconstrucción funciona.
      Así que la prueba copia **los archivos de migración reales** —no un esquema falso—, abre un almacén
      con sólo `001`, llena las siete tablas, y deja que `002` lo suba: lo que le pasa a la máquina de
      cualquiera que corrió la 030. Tres casos: nada se pierde, las ocho tablas cumplen las dos reglas y
      un `INSERT` nuevo deja los dos timestamps iguales, y la unicidad que daban las claves primarias
      sigue valiendo como índice — con `received_events` probando **lo contrario a propósito**, que el
      mismo evento dos veces son dos filas y lo que se rechaza es la misma llegada dos veces.
      Dos pruebas viejas hubo que arreglar: fijaban el número de versión esperado (`expects 1`), así que
      **cada migración las rompería**. Ahora afirman que el rechazo nombra los dos números, que es lo que
      importaba.
- [x] T006 `migrations/README.md` — la fila del inventario de `002` y la tabla de «qué hace una
      segunda escritura con la misma clave» extendida con `received_events`. Sin cifras de estado
      (ADR-032); `tests/docs/readmes.test.ts` es el gate.
      **Y los dos diagramas Mermaid, que el cambio volvió falsos**: describían claves primarias de
      negocio que ya no existen. El ER ahora dibuja índices únicos, omite las tres columnas que **todas**
      las tablas comparten para no repetirlas ocho veces, y agrega `received_events` con su vínculo a la
      decisión. Detalle del gate: el inventario se lee de `git ls-files`, así que una migración nueva no
      cuenta hasta estar rastreada — la prueba dice «está en el inventario pero no en el directorio».

### La identidad y la entidad

- [x] T007 [P] `src/domain/ingestion/ids.ts` — `BatchId` junto a `EventId`, con su `asBatchId`. Vive acá
      y no en el shared kernel porque tiene un dueño claro: la ingesta acuña la llegada (research R-05).
      El comentario dice **qué identifica y qué no**, porque la constitución VI avisa que colapsar
      identidades es el error más caro: identifica **una llegada**, no un evento, no una sesión.
- [x] T008 [P] `src/application/ingestion/ports/batch-id-generator.ts` — el puerto que acuña, con la
      forma de `DecisionIdGenerator`: quien acuña un id lo pide por un puerto del dueño, nunca al
      kernel.
      **Y su implementación y su enlace se adelantaron desde T017**, porque el gate
      `check:ports-bound` no admite un puerto declarado sin enlazar: un archivo de puerto solo es
      «código muerto» para `check:dead-code` y la cadena no pasa. `randomBatchIds` con la forma de
      `randomDecisionIds` (UUID v4 sin guiones, prefijo `bat_`), enlazado en el módulo de composición.
- [x] T009 `tests/unit/domain/ingestion/recorded-event.test.ts` — **antes de la entidad**: las tres
      invariantes en sus dos sentidos, y que `rehydrate` acepta lo que `of` rechazaría, porque un cambio
      de reglas no debe romper la lectura de un histórico que la feature promete conservar entero.
      **Las pruebas quedaron cortas, y ése es el hallazgo** (ver T010): las reglas que importaban son
      errores de compilación, así que lo que las afirma son cuatro casos `@ts-expect-error` que rompen
      el build en vez de una corrida. Escribiéndolas encontré además que una de ellas contradecía la
      regla que yo mismo había escrito —afirmaba un evento **aceptado sin decisión**, y no existe: el
      plano siempre responde una, degradada a `NO_OP ledger-unavailable` si el ledger no puede
      registrar—. El único caso sin decisión ni brazo es el rechazado.
- [x] T010 `src/domain/ingestion/recorded-event.ts` — **no es una clase: es una unión discriminada de
      tipos, y eso corrige el `data-model.md` de esta feature.** Se escribió como clase con tres reglas,
      y dos gates la rechazaron por el mismo motivo: una clase necesita un error, un error del dominio
      **tiene que figurar en el catálogo público de tipos de problema** (`tests/unit/domain/error-codes`)
      y éste no lo emitiría ningún endpoint, porque no es un error de negocio sino **un error de
      programación**.
      ADR-024 pide hacer el estado ilegal **irrepresentable** antes de pedir una regla, así que
      `DecidedArrival | RejectedArrival` convierte las dos reglas que importaban en errores de
      compilación y no queda nada que validar en runtime. Con eso desaparecen la clase, el error, su
      entrada en el catálogo —y el contrato **sigue sin tocarse**, como el plan prometió—. Queda un
      valor sin reglas, como `Exposure` y `Assignment`, que ADR-024 dice no envolver por uniformidad.
      La tercera regla (`position >= 0`) se fue con la clase: la produce un `map` sobre el lote, así que
      era una guarda contra un error de programación que ningún llamador puede cometer.

### El puerto, sus dos implementaciones y la cola

- [x] T011 `src/application/ingestion/ports/event-log.ts` — el puerto como `data-model.md` lo fija.
      **`record(...)` devuelve `void`, no `Promise`, y no tiene canal de fallo**, y el comentario explica
      el mecanismo: un tipo que se puede esperar invita a esperarlo, y ahí se pierde FR-007. El
      requisito deja de depender de que alguien se acuerde.
- [x] T012 `src/interface-adapters/ingestion/queue/` — la cola: encolar es una operación en memoria que
      **no espera**, vaciar corre aparte. Implementa `Closeable` para drenar al cerrar (FR-017). El
      drenaje **tiene techo**: `SHUTDOWN_TIMEOUT_MS` son 10 s y pasado el plazo el proceso sale con 1
      (research R-09), así que lo que no alcance a salir se trata como lo de una caída abrupta en vez de
      colgar el apagado.
      **Una decisión que la tarea no nombraba: qué hace una cola llena.** Esperar lugar es lo único que
      FR-007 prohíbe, así que **descarta y lo dice** — y descarta la llegada **nueva** y no la más vieja,
      porque lo encolado está más cerca de escribirse. Es una pérdida que la reconciliación de FR-018 no
      puede ver —la decisión a la que pertenece se escribió perfectamente—, así que se avisa en el
      momento en vez de contarse para después.
      **Y dos mutantes obligaron a probar efectos, no llamadas** (`.claude/rules/gates-de-calidad.md`):
      sin `clearInterval` la cola seguía escribiendo después de cerrada, y sin `unref` el timer
      **retendría el event loop** — o sea que un proceso sin nada más que hacer no saldría. El segundo se
      observa sin lanzar un proceso: Node lista los recursos que mantienen vivo el loop, y un timer sin
      referencia no está entre ellos.
- [x] T013 ~~`config/platform.json` y su esquema — el **tamaño de la cola** y su **intervalo de
      vaciado** como entradas del nivel plataforma~~ → **`src/composition/event-log-config.ts`, y la
      tarea estaba equivocada.** Son valores del **entorno**, no de comportamiento, como la ruta del
      almacén que la 030 ya decidió así: nada que un merchant o un visitante observe cambia con ellos
      (FR-007, FR-009, FR-011) y no son parte del tratamiento que se congela en el piloto.
      **Lo que lo cerró fue la consecuencia**: el nivel 1 **se publica al SDK** dentro de
      `EffectiveConfiguration`, cuyo DTO es el record entero y cuyo esquema no admite propiedades
      extra. Ponerlos ahí obligaba a contarle a cada merchant el tamaño de un buffer nuestro y **a
      tocar el contrato**, que el plan prometió no tocar. Y `check:behaviour-constants` no lo exigía:
      es una lista de nombres retirados, no una regla general — lo verifiqué en vez de suponerlo.
- [x] T014 `tests/unit/.../event-log.test.ts` — **antes de las dos implementaciones**: un solo contrato
      de pruebas que se corre contra ambas, para que no puedan divergir. Es lo que hizo que en la 030 la
      memoria y SQLite terminaran rechazando igual una sobreescritura, en vez de que el comportamiento
      dependiera del despliegue.
      **Corre contra tres cosas y no dos**: la memoria, la durable, y **la cola envolviendo a la
      memoria** — porque envolver no debe cambiar ninguna respuesta, y es la única línea del contrato
      que sabe que una cola podría existir (`settle`).
      **Y el gate de mutación encontró que le faltaban dos casos, los dos la misma omisión**: cada
      prueba tenía **una** fila por merchant y toda ventana cubría todo lo registrado, así que una
      lectura que ignoraba su clave respondía igual que una que la respetaba, y un filtro que dejaba
      pasar todo era indistinguible de uno que filtraba. Se agregaron dos filas por merchant bajo claves
      distintas, y una ventana con sus dos bordes y sus dos afueras.
- [x] T015 [P] `src/interface-adapters/ingestion/gateways/memory-event-log.ts` — la implementación del
      lazo local y del proyecto `fast`. Existe para que ninguna prueba unitaria tenga que abrir un
      almacén, que es lo que mantiene rápido el lazo que el gate de mutación necesita (ADR-016).
- [x] T016 [P] `src/interface-adapters/ingestion/gateways/sqlite-event-log.ts` — la durable, con el patrón
      de `.claude/rules/gateway-durable.md`: el driver **llega por el enlace**, se escribe
      `entidad.record()`, y al leer **toda clase anidada se rehidrata** — el error que se ve bien en toda
      lectura y falla en la única escritura que importa.

### El cableado y el punto de encolado del camino aceptado

- [x] T017 `src/composition/modules/ingestion.ts` — el puerto nuevo con sus dos tecnologías, elegidas por
      el despliegue (`ADR-033`, `.with("sqlite")`), y la cola en el grafo **después** del almacén, para
      que el cierre en orden inverso drene antes de cerrarlo (research R-09).
      **La cola es la misma en los dos despliegues**: lo que la tecnología elige es sólo qué escribe
      detrás. Un despliegue que escribiera directo sería uno donde FR-007 no vale.
      Y el gate de duplicación tuvo razón sobre lo primero que escribí: los dos enlaces que no dependen
      de la tecnología estaban repetidos en las dos ramas, que es peor que repetición — dos lugares que
      mantener en paso para algo que no tiene motivo para diferir.
- [x] T018 [P] `src/composition/deployments/{local,durable}.ts` — cada despliegue elige. No compila si
      nadie elige, que es la garantía que ADR-033 da.
      **La ingesta salió de `sharedModules`**, que es la lista de los módulos que no tienen nada que
      elegir: ahora tiene dos tecnologías, así que es decisión de cada despliegue.
- [x] T019 `src/application/ingestion/use-cases/ingest-batch.use-case.ts` — el **punto 1**: después de
      `decisionPlane.decide`, porque el `decisionId` y el brazo no existen antes (research R-01). Encola
      una fila por evento con su `disposition` —`accepted` o `duplicate`—, su `receivedAt`, su decisión
      y su brazo.
      **Seis dependencias, no cinco**: research R-01 se olvidó del generador de `BatchId`. Seis es el
      **máximo** que ADR-023 permite, así que queda dicho en el tipo — lo próximo que necesite una
      dependencia acá se resuelve extrayendo un servicio, no relajando el límite.
      Y dos cosas que escribí mal y corregí antes de que el gate las viera, porque son supervivientes
      conocidos de este repo (`.claude/rules/gates-de-calidad.md`): el spread condicional del brazo
      —ahora se pasa el valor, y el tipo ya lo admite ausente— y un `??` inalcanzable al buscar la
      disposición por índice. Lo segundo se arregló en la raíz: `dispositionsOf` devuelve el **evento**
      junto a su estado, así que no hay búsqueda por índice ni fallback para un caso imposible.
- [x] T020 `src/domain/ledger/decision.ts` — `DecisionFacts` gana **cuántos eventos traía el lote**. Es
      lo que permite nombrar el hueco en eventos y no sólo en lotes (research R-10). No cambia ningún
      veredicto ni ninguna respuesta, así que no viola FR-011 — y T021 lo verifica en vez de afirmarlo.
      **El campo es opcional, y la primera versión lo hizo obligatorio.** Requerirlo rompió nueve
      archivos de prueba, y esa churn era la señal: una decisión registrada **antes** de esta feature no
      tiene el campo, y `rehydrate` no juzga lo que lee (ADR-024), así que un campo obligatorio sería un
      tipo que **miente sobre el histórico** que el sistema promete conservar. Donde falta, el hueco es
      nombrable en lotes y no en eventos, que es la verdad sobre esas filas.
      Y no hizo falta agregarlo al puerto del plano: el request ya lleva el lote entero.
- [x] T021 `npm test` — **ninguna prueba de comportamiento cambia de expectativa** (SC-005). Si hay que
      tocar una, el registro dejó de ser un observador puro y eso es un defecto de esta feature, no una
      expectativa a actualizar.
      **Verificado contra el diff y no de memoria**: el único archivo de prueba preexistente que cambió
      es el del caso de uso, con 60 líneas agregadas y **dos borradas** — un import reordenado y el
      `return` del fixture. Ni una expectativa se movió. 1423 pruebas del proyecto `fast`, 68 de
      durabilidad, 7 gates, arquitectura sin violaciones, y el gate de mutación sin supervivientes sobre
      el caso de uso, la decisión y el servicio del plano.

**Checkpoint**: lo que el SDK manda se escribe, sobrevive a un reinicio, y la decisión no se enteró.

---

## Phase 3: User Story 1 — Del click al veredicto, y al revés (P1) 🎯 MVP

**Goal**: de una decisión se llega a lo que se recibió, y de lo recibido a la decisión que produjo, con
el brazo con el que entró.

**Independent Test**: ingestar un lote, esperar a que la cola se vacíe, y recorrer el vínculo en los dos
sentidos.

- [x] T022 [P] [US1] `tests/durability/event-log.test.ts` — los cinco escenarios de aceptación de la
      historia, **cruzando un reinicio** (FR-009): el contenido igual, de la decisión a los eventos, de
      un evento a su decisión **incluida la que resultó `NO_OP`**, el brazo, y el aislamiento entre dos
      merchants. Se escriben antes de las consultas y tienen que fallar.
      **Ya estaban, escritas en el bloque anterior con el contrato compartido**, así que lo que la
      historia necesitaba de verdad era lo que ninguna prueba de gateway puede dar: **el camino
      completo**. Salió `tests/integration/event-register.test.ts`, que hace un `POST` real, deja que la
      cola drene al parar la app —lo que ejercita FR-017 de paso— y recorre el vínculo en los dos
      sentidos.
- [x] T023 [P] [US1] `tests/integration/...` — que un lote **sin experimento activo** se registra **sin
      brazo**, y no con `CONTROL` inventado. Es la distinción que la spec marcó como caso borde y la
      que haría falsa toda lectura del piloto si se perdiera.
      **Y los dos brazos reales**, que era lo que faltaba: un experimento activo y visitantes elegidos
      con la función de asignación del dominio, para no adivinar en qué brazo cae cada uno. La primera
      versión de la prueba del «sin brazo» usaba el merchant A, que **sí** tiene experimento por
      defecto — lo corrigió la corrida, no la lectura.
- [x] T024 [US1] `sqlite-event-log.ts` y su par en memoria — `byDecision` y `bySession`, con los índices
      `(merchant_id, decision_id)` y `(merchant_id, session_id, id)`. El segundo es el que la **032**
      va a consumir para reconstruir señales, y el `id` en el índice es lo que da el orden de llegada
      sin que ninguna columna lleve un contador que pueda discrepar con la realidad.
      **Ya implementado en T015/T016**: el puerto se escribió entero, no por historia. Se marca hecho y
      se dice, en vez de contarlo como trabajo de esta fase.
- [x] T025 [US1] Verificar con `EXPLAIN QUERY PLAN` que las dos consultas usan su índice, no que lo
      tienen: en esta feature un índice equivocado salió **más de tres veces peor que ninguno**
      (research R-06). Si dice `SCAN`, el índice no sirve. Va después de las pruebas porque el plan se
      verifica sobre una tabla con datos.
      Cuatro consultas y no dos —las tres lecturas por clave más el volumen—, sobre una tabla con 200
      filas, porque SQLite planifica distinto una vacía. **Y verifiqué que la aserción discrimina**: un
      plan sin índice dice literalmente `SCAN <tabla>`, comprobado aparte, así que `not.toContain` no
      es una afirmación vacía.
- [x] T026 [US1] `npm run test:mutation` acotado al diff de la historia. Ningún mutante de las líneas
      propias sobrevive; si sobrevive, la skill `triaging-mutants` y su orden de cuatro pasos.
      **Cero supervivientes, exit 0**, sobre el diff completo de la rama.

**Checkpoint**: la historia 1 funciona sola y es la feature mínima entregable.

---

## Phase 4: User Story 2 — Lo que se descartó también deja rastro (P2)

**Goal**: el duplicado y el lote rechazado quedan con su motivo. Es la mitad que vuelve **forense** al
registro: un registro que sólo guarda lo aceptado muestra el tráfico que OPE entendió, no el que llegó.

**Independent Test**: mandar un lote con un evento repetido y otro con un instante fuera de tolerancia, y
encontrar los dos con su motivo.

- [x] T027 [P] [US2] `tests/durability/...` — los cuatro escenarios, antes de la implementación: la
      repetición registrada como repetición y no como evento nuevo, el instante fuera de tolerancia con
      su invariante, el lote que mezcla sesiones con **los `session_id` de cada evento** —que es lo que
      permite _mostrar_ la mezcla en vez de esconderla (research R-07)—, y que consta que **no produjo
      decisión**.
- [x] T028 [P] [US2] `tests/integration/...` — el caso que SC-003 pide y que hoy es imposible:
      **distinguir un merchant sin tráfico de uno cuyo tráfico se descartó**. Es la prueba que justifica
      la historia.
- [x] T029 [US2] `ingest-batch.use-case.ts` — el **punto 2**: el `return fail(batch.error)`, que es el
      único lugar donde se sabe qué llegó y qué invariante lo rechazó (research R-01). Ese camino **no
      pasa por el plano de decisión**, así que las filas van sin `decisionId` y sin brazo, y eso es
      exactamente lo que FR-006 pide poder ver.
      La unión discriminada de T010 es lo que lo vuelve seguro: la rama rechazada **no puede** nombrar
      una decisión, así que no hay forma de escribir acá una fila que diga algo falso sobre por qué el
      tráfico no intervino. Y lo que quedó registrado es **la mezcla misma** —cada fila con su sesión y
      su visitante—, que es lo que un operador necesita para arreglar la integración; la prueba que
      escribí primero afirmaba dos sesiones distintas y la corrida la corrigió: el helper varía el
      **visitante**.
- [x] T030 [US2] `sqlite-event-log.ts` y su par — `byEvent`, con el índice `(merchant_id, event_id)`
      **no único**. La no-unicidad **es el diseño**: un reintento del SDK trae el mismo `eventId` y cada
      llegada es un hecho (research R-04). Es lo que reconstruye la referencia al duplicado sin tocar el
      puerto de deduplicación (research R-08).
      **Ya implementado en T015/T016**, como `byDecision` y `bySession`: el puerto se escribió entero.
      Se marca hecho y se dice.
- [x] T031 [US2] Que la referencia al duplicado **puede faltar** y eso está bien: si la llegada original
      cayó fuera del registro, queda la repetición con su motivo y sin puntero (research R-08). Es
      coherente con Q3 y se prueba, no se asume.
      Va en el contrato compartido, así que lo verifican **las tres** implementaciones: la repetición
      contesta con su disposición y simplemente no hay nada antes. Una que se presentara como primera
      llegada sería lo contrario de lo que el registro promete.
- [x] T032 [US2] `npm run test:mutation` acotado al diff de la historia.
      **Cero supervivientes, exit 0**, sobre el diff completo.

**Checkpoint**: las historias 1 y 2 funcionan, cada una por su cuenta.

---

## Phase 5: User Story 3 — Cuánto trabajo está haciendo esto (P3)

**Goal**: cuántos eventos por merchant, de qué tipos, en qué ventana, sin abrir cada registro.

**Independent Test**: ingestar tráfico de dos merchants y obtener por cada uno su volumen por tipo.

- [x] T033 [US3] ~~`tests/durability/...`~~ → **el contrato compartido y `tests/integration/`**, que es
      donde faltaban. Los dos escenarios —conteos separados por merchant y la distribución por tipo en
      **una sola consulta** (SC-007)— ya los cubría el contrato en las tres implementaciones, así que lo
      que esta historia necesitaba era el **camino completo**: dos merchants con tráfico real por HTTP,
      varios tipos, y cada uno con sus propios conteos.
      **Y una afirmación de diseño que no estaba escrita en ninguna parte: el volumen cuenta lo que
      llegó, no lo que se aceptó.** Un duplicado y un lote rechazado **costaron trabajo** igual que uno
      aceptado, y FR-012 existe para dimensionar carga; `disposition` es lo que separa las tres para
      quien pregunte otra cosa. Queda probado, no sólo dicho.
- [x] T034 [US3] `sqlite-event-log.ts` y su par — `volume`, con el índice **de cobertura**
      `(merchant_id, received_at, type)` —y no `created_at`, como esta tarea decía: ver la corrección de
      T013—. La cobertura no es un detalle: medido, la misma consulta cuesta 507 ms sin índice útil,
      **1 703 ms** con `(merchant_id, type)` y **107 ms** con éste.
      **Ya implementado en T015/T016**, como las otras tres lecturas.
- [x] T035 [US3] `EXPLAIN QUERY PLAN` sobre la consulta de volumen: tiene que usar
      `received_events_volume`. Es la tarea que la medición de R-06 hizo obligatoria.
      **Hecho en T025**, junto con las otras tres consultas, y con la aserción verificada aparte: un plan
      sin índice dice literalmente `SCAN <tabla>`.
- [x] T036 [US3] `npm run test:mutation` acotado al diff de la historia.
      **Cero supervivientes, exit 0**, sobre el diff completo.

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
