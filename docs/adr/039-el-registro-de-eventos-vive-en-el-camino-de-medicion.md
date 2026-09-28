---
numero: 039
titulo: El registro de eventos vive en el camino de medición, y lo que eso arrastró
estado: aceptada
fecha: 2026-09-28
fuente: feature 031 (research R-01, R-02, R-05), medición del 2026-09-28
---

# ADR-039 — El registro de eventos vive en el camino de medición, y lo que eso arrastró

La feature 031 hace durable lo que el SDK manda. Tres decisiones de esta feature son transversales
—alcanzan a más de un módulo o cambian una regla del repositorio— y van juntas porque salen del mismo
razonamiento: **el registro está del otro lado de la línea que `01 §P9` traza**, y ponerlo ahí obligó a
lo demás.

## Contexto

`01 §P9`: «Dos caminos separados. Decisión: **síncrono, acotado, sin I/O de red**. Medición:
**asíncrono, durable**, auditable. No se mezclan, no comparten garantías y no comparten presupuesto de
latencia.»

Hasta esta feature el sistema no tenía ningún componente del lado de medición. ADR-038 dejó la
escritura del ledger de decisiones **en el camino síncrono** y explicó por qué: si el ledger no acepta,
la decisión degrada a `NO_OP ledger-unavailable` (ADR-021), porque nada entra al reporte sin
trazabilidad (constitución **IX**). El principio IX es lo que impedía desacoplar ahí.

El registro de eventos no tiene esa tensión. Nadie interviene por lo que el registro diga, y **degradar
una decisión porque una medición no se pudo escribir sería exactamente la mezcla que P9 existe para
evitar**. Así que es el primer componente que cae naturalmente del lado asíncrono — y la primera vez
que ese principio se cumple entero.

## Decisión 1 — El registro se encola, y su puerto hace incumplible la espera

**El tipo es la garantía.** `EventLog.record(...)` devuelve `void` —no `Promise`— y **no tiene canal de
fallo**, y las dos cosas son deliberadas:

- Un tipo que se puede esperar invita a esperarlo, y ahí se pierde FR-007. Un `void` no se puede
  convertir en espera por descuido.
- No hay nada que un llamador pueda hacer con un fallo que no debe esperar. Todo otro puerto durable
  responde `LedgerUnavailable` porque el plano de decisión necesita fallar cerrado (ADR-021); acá fallar
  cerrado significaría degradar una decisión por una medición.

Lo que se pierde **se cuenta al arrancar** y se loguea donde pasó. Y el registro **no promete
completitud: promete saber dónde no la tiene** (decisión del dueño, Q3 de la spec).

**La asimetría que esto deja, declarada y no promediada**: un lote **aceptado** deja una decisión —
escritura síncrona—, así que su pérdida se reconcilia comparando el ledger contra el registro. Un lote
que una invariante **rechazó** no deja decisión (es el punto de FR-006), así que nada durable dice que
llegó, y lo que nombra esa mitad es el log operativo.

## Decisión 2 — Una quinta identidad: `BatchId`

La constitución **VI** fija cuatro identidades con un propósito único cada una y avisa que «colapsarlas
es la fuente de errores más cara del sistema». Esta feature agrega una, y el motivo es que ninguna de
las cuatro sirve:

| Por qué no   |                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventId`    | identifica un **evento**, no una llegada, y se repite legítimamente entre llegadas: un reintento manda el mismo, y el registro conserva las dos porque **cada llegada es un hecho** |
| `sessionId`  | una sesión tiene muchas llegadas                                                                                                                                                    |
| `decisionId` | sería lo más barato y **no funciona**: un lote rechazado por invariante **no produce decisión**, y ése es justamente el tráfico que el registro vino a hacer visible                |
| `orderId`    | no tiene nada que ver                                                                                                                                                               |

`BatchId` identifica **una llegada** — un `POST` del SDK. La acuña OPE al recibir, por un puerto del
módulo dueño, y **no viaja al SDK**: el contrato de ingesta no cambia por esta feature.

Su consecuencia en el esquema es la que importa: la clave única del registro es
`(merchant_id, batch_id, position)`, **no el evento**. Si el evento fuera único no se podría registrar un
duplicado, que es la mitad de lo que hace forense al registro.

## Decisión 3 — El arranque aplica las migraciones pendientes

La feature 030 declaró «nada que migrar» con su motivo —no había datos en ninguna parte, así que un
almacén sólo podía estar vacío o al día— y el arranque **rechazaba todo lo demás**. La segunda migración
del repositorio vuelve ordinario el caso de un almacén una versión atrás: sin este cambio, el
`data/ope.db` de cualquiera que hubiese corrido la 030 dejaría de arrancar.

El arranque tiene ahora **cuatro salidas**: aplica todo a un archivo vacío; aplica **sólo lo pendiente**
a uno entre 1 y la versión esperada, **cada migración en su transacción**; usa el que ya está al día; y
rechaza lo demás diciendo qué esperaba.

La transacción no es adorno: una migración que **reconstruye** una tabla —lo que SQLite obliga para
agregar una clave primaria— sin ella dejaría el almacén en una forma que no es ni la vieja ni la nueva,
con `user_version` diciendo la vieja, y el arranque siguiente correría la misma migración sobre los
restos.

**Alternativa descartada**: un comando aparte (`npm run migrate`). El almacén es de un solo proceso
(**D-21**) y el arranque ya es el único momento en que alguien lo abre; un paso manual extra es una forma
de que producción corra sobre un esquema viejo sin que nada lo diga.

## Lo medido (2026-09-28, Node 24.21.0, tres corridas, 200 lotes × 20 eventos)

La misma prueba que ADR-038 usó, con el registro enganchado. Los dos perfiles en la misma corrida,
porque lo que decide es la diferencia y sólo es comparable con la misma máquina y la misma carga.

| Perfil  | p95 con el registro | p95 de ADR-038 (línea base) |
| ------- | ------------------- | --------------------------- |
| memoria | 0,97–1,36 ms        | 0,90–1,35 ms                |
| SQLite  | 1,91–2,25 ms        | 1,94–2,72 ms                |

**SC-004 se cumple: el p95 de la ingesta no empeoró de forma apreciable.** Es lo que FR-007 predecía —
lo único que el registro agrega al camino crítico es un `push` a un arreglo en memoria.

La cifra de SQLite cae en el extremo bajo del rango de la 030. **No se lee como una mejora**: es ruido
entre corridas, y decir otra cosa sería atribuir a esta feature algo que no hizo.

## Lo que estos números no dicen

- **Nada sobre producción.** Están medidos contra SQLite local, donde no hay red. Con PostgreSQL la
  escritura del registro pasa a ser I/O de red — del lado asíncrono, que es donde tiene que estar, pero
  con otro orden de magnitud. Se mide cuando el motor exista (**D-21**).
- **Nada sobre el atraso de la cola.** El registro mide su propio atraso restando `received_at` de
  `created_at`, y nadie avisa todavía cuando crece.
- **Nada sobre el costo de la reconciliación.** Es un recorrido completo de las decisiones, una vez, al
  arrancar. Acotarlo requeriría una columna de instante en `decisions`, y el número es lo que debería
  pedirla.
