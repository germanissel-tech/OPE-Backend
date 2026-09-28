# Investigación — Fase 0: Lo que el SDK manda deja de ser invisible

**Feature**: `031-registro-de-eventos` | **Fecha**: 2026-09-27 | **Plan**: [plan.md](./plan.md)

Lo que este documento resuelve son las incógnitas del plan, no las de la spec: la spec ya cerró sus
tres preguntas con el dueño (Q1 la unidad de registro, Q2 la retención, Q3 lo encolado al morir el
proceso) y aquellas decisiones no se rediscuten acá. Lo que sigue es lo que hubo que **leer del
código** para poder planificar, y **dos hallazgos que cambian el tamaño de la feature**.

---

## R-01 — Dónde se encola, y por qué ahí y no antes

**Decisión**: el encolado ocurre en el caso de uso de ingesta, en **dos puntos**, y los dos después de
que ya se sabe todo lo que la fila necesita.

`src/application/ingestion/use-cases/ingest-batch.use-case.ts` tiene esta forma exacta:

```ts
const batch = EventBatch.of(events, now, { pastMs, futureMs });
if (!batch.ok) return fail(batch.error); // ← punto 2: lote rechazado
const results = resultsOf(batch.value, await eventDedup.claim(merchantId, batch.value.eventIds()));
const accepted = results.filter((r) => r.status === "accepted").length;
const decision = await decisionPlane.decide({ merchantId, batch: batch.value, now });
return ok({ accepted, duplicates: results.length - accepted, results, decision });
```

- **Punto 1, lote aceptado**: después de `decisionPlane.decide`, porque el `decisionId` y el brazo
  **no existen antes**. Encolar antes obligaría a volver sobre la fila para completarla, que es la
  forma más cara de conseguir lo mismo.
- **Punto 2, lote rechazado**: en el `return fail(batch.error)`, que es el único lugar donde se sabe
  qué llegó y qué invariante lo rechazó. Ese camino **no pasa por el plano de decisión**, así que no
  hay decisión ni la habrá: eso es justamente lo que FR-006 pide poder ver.

**Alternativas descartadas.** Encolar en el adaptador HTTP: el adaptador no conoce la decisión ni el
resultado de la deduplicación, así que registraría menos. Escribir síncrono: lo prohíbe la decisión del
dueño y FR-007, y no hace falta —ADR-038 midió que una escritura durable cuesta 1,0–1,4 ms p95 sobre un
presupuesto de 150 ms, o sea que sería **asequible**; el motivo para no hacerlo no es el costo sino que
este registro es el primer componente que cae del lado de medición de `01 §P9`, y ponerlo en el camino
síncrono sería elegir la mezcla que ese principio existe para evitar.

**Qué gana el caso de uso**: una dependencia más. Hoy tiene cuatro (`clock`, `tolerance`, `eventDedup`,
`decisionPlane`); con el puerto del registro queda en cinco, dentro del máximo de seis de ADR-023.

---

## R-02 — El runner de migraciones no sabe migrar (**hallazgo**)

**Este es el hallazgo que más cambia el plan.** `prepareSchema`, en
`src/infrastructure/sqlite/open-store.ts`, tiene exactamente tres salidas:

| Estado del archivo             | Qué hace                         |
| ------------------------------ | -------------------------------- |
| versión ya igual a la esperada | lo usa                           |
| versión 0 **y vacío**          | aplica **todas** las migraciones |
| cualquier otra cosa            | **se niega a arrancar**          |

El mensaje de la tercera lo dice con todas las letras: «It was not migrated and it was not replaced, so
nothing was written.»

La feature 030 lo dejó así **a propósito** y lo declaró en su spec: «**Nada que migrar**: no hay datos
en producción, así que la primera versión del esquema no necesita convivir con ninguna anterior.»

**Consecuencia para FR-016**: agregar `002-*.sql` no es escribir un archivo `.sql`. Cualquier almacén
que hoy exista en versión 1 —el `data/ope.db` de `npm run dev`, el de quien probó el quickstart de la
030— **dejaría de arrancar**. Esta feature es la primera que necesita migración hacia adelante, y el
runner tiene que aprenderla.

**Decisión**: el runner aplica **las migraciones pendientes** —las de versión mayor a la que el archivo
declara—, cada una en su transacción, y verifica al final que la versión resultante es la esperada. La
negativa a arrancar se conserva para el único caso que la justificaba: una versión **mayor** que la que
este build conoce, o una versión 0 con tablas adentro, que es otra base de datos en esa ruta.

**Alternativa descartada**: un comando aparte (`npm run migrate`). Se descarta porque el almacén es de
un solo proceso (**D-21**) y el arranque ya es el único momento en que alguien lo abre; un paso manual
extra es una forma de que producción corra sobre un esquema viejo sin que nada lo diga.

---

## R-03 — SQLite no puede agregar una clave primaria con `ALTER TABLE`

FR-014 y FR-015 piden, para **las siete tablas de la 030**, una clave primaria autoincremental y dos
timestamps. SQLite no admite ni agregar una `PRIMARY KEY` ni agregar una columna `NOT NULL` con un
default no constante, así que la migración 002 es una **reconstrucción de tabla** por cada una: crear la
nueva forma, copiar, borrar la vieja, renombrar. Es el procedimiento que la documentación de SQLite
recomienda y no tiene atajo.

**El valor de los timestamps en las filas que ya existen** es la única decisión que esto obliga. Las
filas de la 030 no llevan su instante de creación: **no existe**, y ponerle uno inventado sería escribir
un dato falso en un registro cuyo sentido es la auditoría. Se usa **el instante de la migración**, que
es cierto («esta fila estaba acá cuando el esquema cambió») y que se declara en el comentario de la
migración para que nadie lo lea como el momento en que la decisión se tomó.

**Sobre el costo, con precisión** (la spec lo dice de forma más gruesa): `AUTOINCREMENT` no es lo mismo
que `INTEGER PRIMARY KEY` a secas — agrega la tabla interna `sqlite_sequence` y garantiza que un id no
se reusa nunca. Lo medido incluía `AUTOINCREMENT`, y el costo en tamaño y en escritura fue nulo. La
garantía de no reuso no hace falta con un registro que sólo agrega, pero sí el día que **D5** obligue a
borrar: sin ella, un id borrado vuelve y el orden deja de ser el de llegada.

**Lo que esto salda**: una de las tres deudas que **D-21** anotó. Hoy el orden de inserción se lee del
`rowid` implícito de SQLite —el comentario de `001-ledger-and-catalog.sql` lo dice— y ese `rowid` no
existe en PostgreSQL. Una columna autoincremental sí.

---

## R-04 — El registro no tiene clave natural única, y eso es correcto (**hallazgo**)

Registrar los duplicados (FR-005) choca de frente con la forma que la medición de Q1 usó, que llevaba
`UNIQUE (merchant_id, event_id)`: **si un evento repetido tiene que quedar registrado, el `eventId` no
puede ser único en el registro.** Un reintento del SDK es exactamente eso, y cada llegada es un hecho
distinto que el registro existe para conservar.

Peor: el mismo `eventId` puede repetirse **dentro de un mismo lote**, y el caso de uso ya lo contempla
(«a repeated eventId inside the batch counts once»). Así que tampoco alcanza `(merchant, lote, evento)`.

**Decisión**: la clave única del registro es **`(merchant_id, batch_id, position)`** — la posición del
evento dentro de la llegada. Identifica una llegada y no un evento, que es lo que el registro guarda. El
`event_id` lleva un índice **no único**, que es lo que permite encontrar todas las llegadas de un mismo
evento.

La regla del dueño lo admite: «si es necesario pueden crear índices UNIQUE combinando fields» — «si es
necesario», y acá lo necesario es otra combinación.

---

## R-05 — Hace falta una identidad nueva, y la constitución obliga a justificarla

R-04 necesita un `batch_id`, y **hoy no existe**: el caso de uso no nombra el lote. La constitución VI
fija cuatro identidades con un propósito único cada una y avisa que «colapsarlas es la fuente de errores
más cara del sistema», así que agregar una quinta se justifica o no se hace.

**Propósito de `BatchId`, que ninguna de las cuatro cubre**: identificar **una llegada** — un `POST` del
SDK—, para agrupar sus eventos y para que escribir la misma llegada dos veces no duplique filas. No es
`eventId` (que identifica un evento, no una llegada, y se repite entre llegadas), no es `sessionId` (una
sesión tiene muchas llegadas), no es `visitorId` ni `orderId`.

**Por qué no alcanza el `decisionId`**, que sería lo más barato: **un lote rechazado no produce
decisión**. Agrupar por decisión dejaría sin agrupar justamente el tráfico que la historia 2 vino a hacer
visible.

**Dónde vive**: en `src/domain/ingestion/ids.ts`, junto a `EventId`, porque tiene un dueño claro
(la ingesta acuña la llegada). No en el shared kernel: `CLAUDE.md` reserva eso para identidades que
comparten módulos que no pueden depender entre sí. Se acuña por un puerto del dueño, como el ledger
acuña `DecisionId` con `DecisionIdGenerator`.

**No entra al contrato**: el SDK no lo manda ni lo recibe (FR y suposición de la spec: el contrato de
ingesta no cambia). Es vocabulario interno, y por eso no necesita nota de dominio (ADR-008).

---

## R-06 — El índice es de cobertura, y verificarlo es parte del plan

Ya medido y registrado en la spec, se repite acá porque es lo que el plan **no debe re-deducir**: la
consulta de la historia 3 sobre 2 millones de eventos cuesta **507 ms** sin índice útil, **1 703 ms** con
`(merchant_id, type)` y **107 ms** con `(merchant_id, created_at, type)`.

Un índice equivocado fue **peor que ninguno**, por más de tres veces. Así que el plan lleva una tarea
explícita de verificar el plan de ejecución con `EXPLAIN QUERY PLAN` para cada consulta que las historias
prometen, en vez de confiar en que un índice con los campos correctos alcanza.

Los tres índices que las historias necesitan:

| Consulta                                    | Índice                                          |
| ------------------------------------------- | ----------------------------------------------- |
| los eventos de una decisión (FR-003)        | `(merchant_id, decision_id)`                    |
| los eventos de una sesión en orden (FR-013) | `(merchant_id, session_id, id)`                 |
| el volumen por merchant y tipo (FR-012)     | `(merchant_id, created_at, type)`, de cobertura |
| todas las llegadas de un evento (FR-005)    | `(merchant_id, event_id)`, **no único** (R-04)  |

---

## R-07 — Un lote rechazado puede no saber de qué sesión es

La invariante `session-visitor-mismatch` se dispara **porque** el lote mezcla sesiones o visitantes. Así
que en ese caso no hay una sesión del lote: preguntarle cuál es no tiene respuesta.

**Decisión**: en el registro, `session_id` y `visitor_id` son **del evento**, no del lote —que además es
como el contrato los define (`EventBase`)— y por lo tanto siempre existen. El lote rechazado queda
registrado evento por evento con los suyos, y el motivo del rechazo se repite en cada fila. Eso hace que
el registro pueda **mostrar la mezcla**, que es la información que el operador necesita para arreglar la
integración, en vez de esconderla detrás de un campo vacío.

---

## R-08 — La referencia al duplicado no necesita un puerto nuevo

FR-005 pide registrar la repetición «con la referencia a lo que ya se conocía». El puerto
`EventDedup.claim` devuelve **sólo el conjunto de ids que entraron primero**: la ventana sabe «visto», no
«visto en qué llegada».

**Decisión**: no se toca el puerto. La referencia **se reconstruye del propio registro**: buscar el mismo
`event_id` por su índice (R-06) devuelve todas sus llegadas ordenadas, y la primera es la original. Es
más barato y más cierto que hacer que la ventana de deduplicación lleve una referencia que hoy no tiene y
que además se le vence.

**Lo que esto cuesta, dicho**: si la llegada original cayó **fuera** del registro —se perdió en una caída
abrupta, R-10— la referencia no se puede reconstruir. Queda la repetición registrada con su motivo, sin
puntero. Es coherente con Q3: el registro no promete completitud.

---

## R-09 — El drenaje del apagado tiene presupuesto, y el grafo ya lo ordena

FR-017 encaja sin inventar nada:

- `src/composition/graph/port.ts` define `Closeable` y `compose.ts` lo dice en su comentario: «What was
  built and knows how to close, in creation order; the boot closes in **reverse**.» El puerto del
  registro se crea **después** del almacén, así que se cierra **antes**: drena, y después el almacén se
  cierra. El orden correcto sale de la construcción, no de una lista que alguien tenga que mantener.
- `src/composition/lifecycle.ts` le pone un techo: `SHUTDOWN_TIMEOUT_MS` son **10 segundos**, un tercio
  de los 30 que Kubernetes concede, y pasado ese plazo el proceso **sale con 1**.

**Lo que hay que decidir por eso**: el drenaje no puede ser ilimitado. Si la cola no se vacía dentro del
presupuesto, lo que quede se trata como lo de una caída abrupta —se declara el hueco (R-10)— y el apagado
termina. Un apagado colgado esperando la cola convertiría el remedio de FR-017 en la falla que
`lifecycle.ts` fue escrito para no tener.

---

## R-10 — Cómo se puede saber cuántos eventos se perdieron (**la parte difícil de FR-018**)

FR-018 y SC-010 piden nombrar el hueco: cuántos eventos y en qué intervalo. La dificultad es circular: si
lo encolado se pierde con el proceso, **el registro de lo que se perdió se pierde con él**.

**La salida es que ya hay una escritura durable y síncrona en ese mismo camino**: el ledger de
decisiones, desde la feature 030. Todo lote aceptado deja **exactamente una** decisión, y esa decisión
está en disco antes de que la respuesta salga (ADR-021, constitución IX).

**Decisión**: el hueco se nombra **reconciliando el ledger de decisiones contra el registro** al
arrancar. Una decisión sin sus eventos registrados es un lote que llegó y no se escribió, y su
`decidedAt` da el intervalo.

Para que el conteo sea **en eventos** y no sólo en lotes, la decisión tiene que llevar **cuántos eventos
traía su lote**: hoy `DecisionFacts` no lo tiene. Es un entero, no cambia ningún veredicto ni ninguna
respuesta, y por lo tanto no viola FR-011, que habla del comportamiento observable de la decisión.

**El límite, y hay que declararlo**: un **lote rechazado** no deja decisión, así que esta reconciliación
no lo ve. Su pérdida es nombrable sólo desde el log operativo, que registra la petición y su `422` y no
vive en la cola. El registro queda entonces con dos garantías distintas según el tramo, y eso se dice en
vez de promediarlo: **los lotes aceptados se reconcilian; los rechazados se cuentan desde el log.**

---

## Lo que esta investigación NO resolvió, y por qué

- **El costo real de la cola bajo tráfico**: se mide con la prueba de latencia que ya existe, y el
  número entra en la feature. Contra SQLite local, que es lo que hay (**D-21**).
- **El conteo agregado que se degrada** (447 ms con 1 M, 4,7 s con 10 M): la spec lo dejó como decisión
  diferida con su disparador. Este plan no lo adelanta.
- **Si un duplicado debería influir en la decisión**: medido y anotado en la spec, explícitamente no
  juzgado. Esta feature lo hace **visible**; si es un defecto, es de otra.
