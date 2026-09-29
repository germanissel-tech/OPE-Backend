# Modelo de datos — Fase 1

**Feature**: `033-configuracion-durable` | **Fecha**: 2026-09-29 | **Plan**: [plan.md](./plan.md)

**Ninguna entidad nueva y ninguna que cambie de forma.** Las seis que se guardan ya existen, ya tienen su `record()` y su `rehydrate` (ADR-024), y el dominio ya estaba listo para que alguien las guardara. Lo que este documento fija es **la forma de las tablas**, **qué se rehidrata al leer** y **las dos piezas que no son una tabla**: el índice en memoria y la reconstrucción de la ventana.

---

## Las siete tablas, para seis almacenes

La convención es la de `migrations/README.md`: clave propia autoincremental, `created_at` y `updated_at` con su default, el merchant, **la clave por la que el puerto busca**, y todo lo demás en `document`. Lo que sigue es sólo lo que se sale de eso o lo que hay que elegir.

### `merchants`

```sql
CREATE TABLE merchants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX merchants_key ON merchants (merchant_id);
```

`status` es columna porque `list` pagina merchants y el estado es lo primero que un panel filtra; el resto —orígenes, credenciales, `createdAt`— va en el documento, que es `merchant.record()`.

**Y no hay índice por huella de credencial**, que es lo que se esperaría de la resolución en el borde de autenticación. El motivo es el índice en memoria de más abajo: esa búsqueda **no toca el almacén**. Un índice para nadie es peso en cada escritura y una promesa falsa sobre por dónde se busca.

### `merchant_origins`

```sql
CREATE TABLE merchant_origins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  origin      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX merchant_origins_origin ON merchant_origins (origin);
CREATE INDEX merchant_origins_by_merchant ON merchant_origins (merchant_id);
```

**Es la única tabla que saca algo del documento, y el motivo vale escribirlo.** Un origen pertenece a **un solo merchant, desactivados incluidos** (invariante `origin-already-registered`), y eso es una unicidad **entre** merchants. Dentro de un documento no hay índice que la garantice, y garantizarla leyendo antes de escribir es exactamente la carrera entre comprobación y escritura que `01 §6` prohíbe. Con el índice único, **lo decide el almacén**.

Los orígenes están **además** en el documento del merchant, porque el documento es `record()` y el `record()` los lleva. No son dos verdades: la tabla existe para que un índice haga cumplir la unicidad, y se escribe en la misma transacción que el merchant.

### `merchant_configurations`

```sql
CREATE UNIQUE INDEX merchant_configurations_key ON merchant_configurations (merchant_id, version);
```

`version` es un entero por merchant, y **la efectiva es la de versión máxima** — no hay bandera de «vigente», que sería un segundo lugar donde decir lo mismo y podría discrepar. `versionsOf` pagina por `version` descendente.

### `experiments`

```sql
CREATE UNIQUE INDEX experiments_key ON experiments (merchant_id, experiment_id);
CREATE INDEX experiments_by_merchant ON experiments (merchant_id, id);
```

El ciclo de vida, el reparto, la semilla, la muestra, los cortes y los reinicios de ventana van en el documento: nadie busca por ellos. El estado **no** es columna por eso mismo — `listOf` trae los del merchant y quien filtra es el llamador.

### `admin_entries`

```sql
CREATE INDEX admin_entries_recent ON admin_entries (id);
CREATE INDEX admin_entries_by_merchant ON admin_entries (merchant_id, id);
```

**Sin clave de negocio y sin índice único**: dos acciones idénticas del mismo operador en el mismo instante son dos acciones, igual que en `received_events` dos llegadas del mismo evento son dos llegadas. Append-only y **sin poda** (FR-009): la retención es permanente y queda declarada.

`merchant_id` es nulo en las entradas que no nombran un merchant —`importMerchants`, `listMerchants`—, y es la primera columna nullable de este esquema. Lo es porque la ausencia **significa** algo: una acción de plataforma, no de un merchant. `listOf` filtra por igualdad y nunca las trae.

### `anchor_diagnostics`

```sql
CREATE UNIQUE INDEX anchor_diagnostics_key ON anchor_diagnostics (merchant_id, anchor, surface);
```

La clave es la del `upsert`: acumula un conteo sobre `(merchant, anclaje, superficie)`. **El conteo es columna y no documento**, y es la única vez que un contador sale del documento en este esquema: el `upsert` tiene que incrementarlo en el almacén (`ON CONFLICT … DO UPDATE SET count = count + 1`), porque hacerlo leyendo y escribiendo es otra carrera.

El tope por merchant (`anchorDiagnosticsKept`, nivel 1) se aplica al escribir, como el de los recibos del catálogo: **llega con cada escritura**, porque es política y no esquema (constitución XI).

### `unmapped_values`

```sql
CREATE INDEX unmapped_values_by_merchant ON unmapped_values (merchant_id, id);
```

`replace(merchantId, seen, at)` reemplaza el conjunto del merchant: borra sus filas y escribe las nuevas, **en una transacción**, porque un reemplazo a medias deja un conjunto que nunca existió.

---

## Qué se rehidrata al leer, y es donde esto se rompe

La regla de `gateway-durable.md` lo dice y esta feature tiene un caso claro: **`JSON.parse` no devuelve clases**, y lo que vuelve como objeto plano falla en la única escritura que importa.

| Al leer un merchant           | Qué es                                   | Qué pasa si no se rehidrata                                                                                                            |
| ----------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `origins`                     | **`Origin` es una clase** con `equals`   | `merchant.allowsOrigin(...)` compara con `equals` y **lanza**: el borde de CORS deja de funcionar para todo merchant leído del almacén |
| `credentials`                 | `Credential` es un **tipo**, sin métodos | vuelve solo                                                                                                                            |
| `expiresAt` de una credencial | `Date`                                   | vuelve solo: `toDocument` marca las fechas (`$date`) y un campo `Date` nuevo viaja sin que ningún gateway se entere                    |
| `createdAt`                   | `Date`                                   | vuelve solo, por lo mismo                                                                                                              |

**Un solo lugar que rehidratar y es el que más duele**, porque el síntoma no es un error al leer: es un merchant que existe, se lista bien, se ve bien en el panel, y no autentica ninguna petición. Igual que los cuatro de `sqlite-order-ledger.ts`.

Lo mismo hay que revisar en `Experiment`: si alguna parte de su documento es una clase, se nombra y se rehidrata.

---

## El índice en memoria, que no es una tabla

**Lo que resuelve**: la resolución del merchant por la huella de su credencial y por su origen ocurre en **cada** petición, antes de validar el cuerpo. Ir al almacén ahí es un `SELECT` hoy y un viaje de red el día de PostgreSQL (R-02).

**La forma**: el gateway durable del merchant mantiene, además de la tabla, tres mapas en memoria — por identificador, por huella de credencial y por origen. Se llenan **una vez al abrir** leyendo todos los merchants, y se actualizan **en la misma llamada** que escribe.

```
create / update  →  escribe la tabla  →  si la escritura salió bien, actualiza los mapas
get / list / ownerOfOrigin / findBy*Key  →  los mapas
isEmpty  →  los mapas
```

**Por qué no puede divergir, y exactamente cuándo sí.** No puede porque **hay un solo camino de escritura y un solo proceso**: los mapas se tocan después de una escritura exitosa y nunca antes. Diverge en cuanto hay **dos procesos** — el índice de A no ve el alta de B, y un merchant recién creado autenticaría en un nodo y no en el otro.

Eso no es una sorpresa que descubrir después: es lo mismo que **D-21** ya declara del resto de las garantías, y va escrito **en el gateway**, no sólo acá. La feature de PostgreSQL tiene que resolverlo, con invalidación o consultando.

**Y no es «escribir dos veces»**, que es lo que la feature 032 rechazó. Ahí había dos verdades que podían discrepar sobre el mismo hecho; acá hay **una** —la tabla— y el índice es una vista de esa verdad mantenida por la misma operación que la cambia. La diferencia se prueba: si pudieran discrepar, habría dos caminos de escritura, y no los hay.

**El tamaño está acotado por la cantidad de merchants, no por el tráfico**, que es lo que lo vuelve aceptable. Un piloto tiene decenas.

---

## La ventana de deduplicación, que se reconstruye

**Decisión del dueño**: recuperable, no durable. El `claim` se sigue respondiendo en memoria.

**La forma**: un envoltorio sobre la deduplicación en memoria, como `queuedEventLog` envuelve el registro. La primera vez que un merchant pide un `claim` desde que el proceso arrancó, su ventana se llena de lo durable; desde ahí, todo en memoria.

```
claim(merchant, ids)
  ├── ¿es la primera vez de este merchant en este arranque?
  │     sí → leer del registro los ids del merchant dentro de la ventana, hasta el tope
  └── responder en memoria, como hoy
```

**Lo que hace falta y no existe**: el registro de eventos no tiene una lectura que devuelva los identificadores de un merchant dentro de una ventana. Tiene `bySession`, `byDecision`, `byEvent` y `volume` —conteos por tipo, no ids—. La lectura nueva es del puerto del registro, y **el índice que necesita ya existe**: `received_events_volume (merchant_id, received_at, type)` sirve por su prefijo `(merchant_id, received_at)`.

**Tres cosas que tienen que salir bien:**

1. **El tope se respeta.** La ventana guarda hasta `maxIds` por merchant, los más recientes. Una ventana reconstruida más grande que la que el sistema promete sería otra promesa.
2. **Se reconstruye una vez por merchant y por arranque**, no una vez por lote. El segundo lote no paga nada, y **SC-006 lo vigila**: el primer lote tras el reinicio no tarda apreciablemente más que el siguiente.
3. **Si la lectura falla, el `claim` sigue respondiendo.** La deduplicación cae del lado de la medición: un duplicado contado dos veces ensucia una cifra, no gasta un cupo. Degradar la ingesta porque una reconstrucción de medición falló sería la mezcla que `01 §P9` existe para evitar — la misma asimetría que ADR-040 ya declaró.

---

## Lo que este modelo NO cambia

- **Ninguna entidad.** Ni una gana un campo, ni una cambia de forma. Esta feature es de infraestructura y de arranque.
- **Ningún puerto cambia de forma**, salvo el del registro de eventos, que gana una lectura — y es el dueño de ese puerto quien la gana.
- **Ninguna política.** El tope de la ventana, su TTL y el tope de diagnósticos siguen siendo del nivel 1; los gateways los **reciben**, como `memoryEventDedup` ya hace.
- **El contrato.** Las 21 operaciones responden lo mismo.
