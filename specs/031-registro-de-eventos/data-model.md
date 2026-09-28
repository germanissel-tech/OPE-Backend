# Modelo de datos — Fase 1: el registro de eventos

**Feature**: `031-registro-de-eventos` | **Fecha**: 2026-09-27 | **Plan**: [plan.md](./plan.md)

Las dos reglas de arquitectura del dueño (2026-09-27) valen para **toda** tabla que esta feature cree o
modifique: clave primaria autoincremental propia, y `created_at` / `updated_at` iguales al crear.

---

## La entidad: una llegada registrada

> **Corregido durante la implementación (2026-09-28).** Esta sección decía «una **clase** porque tiene
> reglas», con `of`/`rehydrate`/`record` y tres invariantes de runtime. Dos gates lo rechazaron por el
> mismo motivo: una clase necesita un error, y **un error del dominio tiene que figurar en el catálogo
> público de tipos de problema**, mientras que éste no lo emitiría ningún endpoint porque no es un error
> de negocio sino de programación. ADR-024 pide hacer el estado ilegal **irrepresentable** antes de
> pedir una regla, así que es una **unión discriminada de tipos**: las dos reglas que importaban son
> errores de compilación, no queda nada que validar, y el contrato sigue sin tocarse. Lo que sigue
> describe el diseño que quedó; el párrafo tachado se conserva porque el motivo del cambio vale más que
> la versión limpia.

`RecordedEvent` — un evento **tal como llegó**, en una llegada concreta. Es
`DecidedArrival | RejectedArrival`, un valor **sin reglas**, como `Exposure` y `Assignment`: ADR-024 dice
no envolverlo por uniformidad. Quien lo lee lo estrecha por `disposition`, que es para lo que existe una
unión discriminada, y no hay función auxiliar porque el dominio no exporta funciones sueltas.

Lo que la distingue de `Event`, que ya existe en el dominio de ingesta: `Event` es lo que el contrato
declara; `RecordedEvent` es **un hecho de recepción** — el mismo evento puede tener varias, y cada una es
una fila.

| Campo         | Tipo                                      | Regla                                                                                             |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `batchId`     | `BatchId`                                 | la llegada. Acuñada por OPE al recibir, nunca por el SDK (research R-05)                          |
| `position`    | entero ≥ 0                                | la posición del evento dentro de la llegada. Con `batchId`, identifica la fila                    |
| `event`       | `Event`                                   | el evento como el contrato lo admite. **No gana campos** (FR-010)                                 |
| `receivedAt`  | `Date`                                    | cuándo OPE lo recibió, distinto del instante que declara el cliente (FR-002)                      |
| `disposition` | `"accepted" \| "duplicate" \| "rejected"` | qué pasó con él                                                                                   |
| `rejectedBy`  | `string \| undefined`                     | el `code` de la invariante, presente sólo si `disposition` es `rejected`                          |
| `decisionId`  | `DecisionId \| undefined`                 | ausente **sólo** cuando el lote fue rechazado, porque entonces no hubo decisión                   |
| `arm`         | `Arm \| undefined`                        | `CONTROL` o `TREATMENT`; ausente cuando no había experimento activo — **no se inventa `CONTROL`** |

### Lo que el compilador impide, y que eran las invariantes

Las dos ramas de la unión son lo que cierra cada forma de escribir una mentira, y no compila ninguna:

1. **Una fila rechazada no puede nombrar una decisión**, ni una decidida nombrar una invariante. Es la
   que más importa: decir «rechazado» y a la vez nombrar una decisión es un dato falso sobre por qué el
   tráfico no intervino, que es justamente la pregunta que el registro existe para responder.
2. **Una fila decidida no puede omitir su decisión**: el plano siempre responde una, degradada a
   `NO_OP ledger-unavailable` si el ledger no puede registrar (ADR-021), pero responde.
3. **El brazo sólo existe en la rama que tiene decisión**, porque el brazo lo conoce la decisión.

Y como no hay `of(...)`, tampoco hay `rehydrate` que pudiera re-juzgar: **leer no valida nada**, que es
lo que la feature necesitaba para que un cambio de reglas no rompa la lectura de un histórico que promete
conservar entero (Q2). Lo que antes era una decisión de diseño la da ahora la forma del tipo.

---

## La tabla

```sql
CREATE TABLE received_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id  TEXT NOT NULL,
  batch_id     TEXT NOT NULL,
  position     INTEGER NOT NULL,
  event_id     TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  type         TEXT NOT NULL,
  received_at  TEXT NOT NULL,
  disposition  TEXT NOT NULL,
  decision_id  TEXT,
  document     TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX received_events_arrival   ON received_events (merchant_id, batch_id, position);
CREATE INDEX received_events_by_decision      ON received_events (merchant_id, decision_id);
CREATE INDEX received_events_by_session       ON received_events (merchant_id, session_id, id);
CREATE INDEX received_events_by_event         ON received_events (merchant_id, event_id);
CREATE INDEX received_events_volume           ON received_events (merchant_id, created_at, type);
```

### Por qué cada columna está afuera del `document`

La 030 fijó el criterio: columnas para el merchant y para la clave por la que el puerto busca; todo lo
demás viaja en `document`. Cada columna de acá tiene su consulta:

| Columna                | Qué consulta la pide                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `merchant_id`          | el aislamiento, que es el predicado de todas (FR-008)                                                                                  |
| `batch_id`, `position` | la unicidad de la llegada — la idempotencia de la escritura (research R-04)                                                            |
| `decision_id`          | los eventos de una decisión y la decisión de un evento (FR-003)                                                                        |
| `session_id`           | los eventos de una sesión en orden (FR-013), el insumo de la 032                                                                       |
| `event_id`             | todas las llegadas de un evento: es lo que reconstruye la referencia al duplicado sin tocar el puerto de deduplicación (research R-08) |
| `type`, `created_at`   | el volumen por merchant y tipo, con índice de cobertura (FR-012)                                                                       |
| `received_at`          | FR-002, y con `created_at` mide el atraso de la cola (FR-015)                                                                          |
| `disposition`          | distinguir aceptado, duplicado y rechazado sin abrir el documento                                                                      |

`visitor_id`, `page`, `dwellMs` y el resto del evento van en `document`: ninguna consulta de las historias
busca por ellos, y sacarlos a columnas obligaría a mantener dos formas del mismo dominio en paso, que es la
duplicación que ADR-024 evita.

**`rejectedBy` va en el `document`** y no en columna: no hay consulta que busque por invariante, y
`disposition = 'rejected'` ya separa el tramo.

### La clave que **no** es única, y por qué eso es el diseño

`(merchant_id, event_id)` **no** es único: un reintento del SDK trae el mismo `eventId` y **cada llegada es
un hecho**. Si fuera único, registrar el duplicado —FR-005, la mitad forense de la feature— sería imposible.
Lo único de este registro es la llegada, no el evento (research R-04).

### Los dos timestamps, que acá son información y no burocracia

`received_at` es cuándo llegó; `created_at` es cuándo la cola lo escribió. **Su diferencia es el atraso de
la cola** (FR-015), medible sin instrumentar nada. `updated_at` es igual a `created_at` al crear, y este
registro **no actualiza filas**, así que una fila con los dos distintos sería una anomalía que vale la pena
poder detectar.

---

## Lo que cambia de lo que ya existe

### Los hechos de la decisión ganan un entero

`DecisionFacts` (`src/domain/ledger/decision.ts`) gana **cuántos eventos traía el lote**. Es lo que permite
nombrar el hueco de una caída abrupta en eventos y no sólo en lotes (research R-10, SC-010). No cambia
ningún veredicto ni ninguna respuesta, así que no viola FR-011.

### Las siete tablas de la 030 se reforman

`decisions`, `exposures`, `orders`, `corroborations`, `assignments`, `catalog_snapshots` y
`catalog_receipts` pasan a las dos reglas (FR-016). Lo que eso implica de verdad:

- **Es una reconstrucción de tabla, no un `ALTER`.** SQLite no admite agregar una `PRIMARY KEY` ni una
  columna `NOT NULL` con default no constante: crear, copiar, borrar, renombrar (research R-03).
- **Lo que hoy es clave primaria pasa a índice UNIQUE.** `PRIMARY KEY (merchant_id, decision_id)` se
  vuelve `UNIQUE (merchant_id, decision_id)`, y la clave primaria es el `id`. La garantía de unicidad no
  cambia; cambia quién la lleva.
- **Los timestamps de las filas que ya existan valen el instante de la migración**, porque su instante real
  **no existe** e inventarle otro sería escribir un dato falso en un registro de auditoría. La migración lo
  dice en su comentario.
- **Y salda una deuda de D-21**: el orden de inserción hoy se lee del `rowid` implícito de SQLite, que en
  PostgreSQL no existe. Una columna autoincremental sí.

### El puerto del registro

```ts
export interface EventLog {
  /** Enqueues an arrival. Returns immediately: it never waits for the write (FR-007). */
  record(arrival: readonly RecordedEvent[]): void;
  /** Everything recorded for a decision, in arrival order. */
  byDecision(merchantId: MerchantId, decisionId: DecisionId): Promise<readonly RecordedEvent[]>;
  /** Everything recorded for a session, in arrival order: what the 032 rebuilds signals from. */
  bySession(merchantId: MerchantId, sessionId: SessionId): Promise<readonly RecordedEvent[]>;
  /** Every arrival of one event id, oldest first: the first is the original of a duplicate. */
  byEvent(merchantId: MerchantId, eventId: EventId): Promise<readonly RecordedEvent[]>;
  /** How many events of each type, per merchant, within a window. */
  volume(merchantId: MerchantId, window: { from: Date; to: Date }): Promise<readonly TypeCount[]>;
}
```

**`record` devuelve `void` y no `Promise`**, y es deliberado: un tipo que se puede esperar invita a
esperarlo, y ahí se pierde la garantía de FR-007. La firma es la que hace que el requisito no se pueda
violar por descuido.

**No hay canal de fallo en `record`**, tampoco deliberado: no hay nada que el llamador pueda hacer con un
fallo que no debe esperar. Lo que se pierde se cuenta al arrancar (FR-018), que es donde la información
sirve.

---

## Las entidades que este modelo NO crea

- **No hay tabla de lotes.** Q1 lo decidió con mediciones: el lote es lo que **dispara** una decisión, no
  aquello sobre lo que se decide, y reducido a disparador no necesita tabla. El motivo de rechazo se repite
  en cada fila, repetición que no cuesta porque el almacenamiento no es criterio.
- **No hay tabla de huecos.** El hueco se **deriva** reconciliando el ledger contra el registro; guardarlo
  sería un tercer lugar que puede discrepar con los otros dos.
- **No hay tabla de agregados.** La spec lo dejó como decisión diferida con su disparador (el conteo pasa
  de segundos); anticiparla es inventar una política de ventana que nadie pidió.
