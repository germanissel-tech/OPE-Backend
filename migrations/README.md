# migrations/ — la forma del almacén durable, versionada

El esquema del almacén se versiona acá (feature 030, FR-007) **para que un cambio de la forma de
los datos se revise en una PR como cualquier otro cambio**. No es un detalle de despliegue: es la
única parte de la persistencia que alguien puede leer entera sin correr nada.

Un archivo es `NNN-<nombre>.sql`, y `NNN` es la **versión que el esquema tiene después de
aplicarlo**. Cada archivo fija esa versión con `PRAGMA user_version = NNN`, que es de dónde el
arranque la lee.

## La forma de hoy

Toda tabla lleva **su propia clave primaria autoincremental** y **`created_at` / `updated_at`**, las
dos reglas de arquitectura del dueño (2026-09-27, migración `002`); lo que era clave de negocio es
ahora un **índice UNIQUE**, que garantiza lo mismo sin ser la identidad de la fila. Fuera de eso hay
columnas para **dos cosas nada más**: el merchant, que toda lectura toma y que es de lo que está hecho
el aislamiento (constitución V), y **la clave o el campo por el que el puerto busca**. Todo lo demás
viaja en `document`, tal como el dominio lo tiene.

Para no repetir cinco columnas iguales en cada caja, el diagrama las omite: **todas las tablas tienen
`id`, `created_at` y `updated_at`**, y lo que se dibuja es lo que las distingue.

```mermaid
erDiagram
    decisions {
        TEXT merchant_id UK "toda lectura lo toma"
        TEXT decision_id UK "repetirla se rechaza: no se sobrescribe"
        TEXT session_id "índice decisions_by_session, ordenado por id"
        TEXT document "razonamiento, candidatos, veredicto"
    }
    exposures {
        TEXT merchant_id UK
        TEXT decision_id UK "el índice único es la idempotencia"
        TEXT document "ancla e instante"
    }
    orders {
        TEXT merchant_id UK
        TEXT order_id UK
        TEXT document "total, líneas, correlación, devolución"
    }
    corroborations {
        TEXT merchant_id UK
        TEXT order_id UK
        TEXT session_id UK "el primero gana"
        TEXT document "lo que el SDK vio"
    }
    assignments {
        TEXT merchant_id UK
        TEXT experiment_id UK
        TEXT visitor_id UK "el primero gana"
        TEXT document "el brazo y su instante"
    }
    catalog_snapshots {
        TEXT merchant_id UK "una fila por merchant"
        TEXT document "productos y variantes"
    }
    catalog_receipts {
        TEXT merchant_id "índice catalog_receipts_by_merchant"
        TEXT received_at "sin índice único: dos recibos iguales son dos recibos"
    }
    received_events {
        TEXT merchant_id UK "el aislamiento, también acá"
        TEXT batch_id UK "la llegada, acuñada por OPE al recibir"
        INTEGER position UK "su lugar en la llegada: esto es lo único"
        TEXT event_id "índice NO único: cada llegada es un hecho"
        TEXT session_id "índice por sesión, lo que lee la feature 032"
        TEXT type "índice de cobertura con received_at"
        TEXT received_at "cuándo llegó; su resta con created_at es el atraso de la cola"
        TEXT disposition "accepted · duplicate · rejected"
        TEXT decision_id "ausente sólo si el lote fue rechazado"
        TEXT document "el evento como el contrato lo admite"
    }

    decisions ||--o| exposures : "se mostró de verdad"
    decisions ||--o{ received_events : "con qué llegó"
    orders ||--o{ corroborations : "la sostienen"
    catalog_snapshots ||--o{ catalog_receipts : "cuándo llegó cada una"
```

**Ninguna de esas líneas es una clave foránea**, y el diagrama las dibuja igual porque es lo que un
ER sabe dibujar: son las que unen **columna con columna**, y el motor no las vigila. La cadena de
evidencia entera se une por identificadores, y varios de ellos viven dentro del documento:

```mermaid
flowchart LR
    A["assignments<br/><i>en qué brazo cayó</i>"] -->|"visitor_id · en el documento de la decisión"| D
    D["decisions<br/><i>qué decidió y por qué</i>"] -->|"decision_id · columna en las dos"| E["exposures<br/><i>que se mostró</i>"]
    D -->|"session_id · columna acá, documento en la orden"| O["orders<br/><i>la cifra económica</i>"]
    O -->|"order_id · columna en las dos"| C["corroborations<br/><i>lo que el SDK vio</i>"]
    O -.->|"la misma fila, actualizada"| R["la devolución<br/><i>dentro del documento de la orden</i>"]
```

**Por qué no se desarma cada entidad en columnas**: el ledger es inmutable y append-only, así que no
hay actualizaciones parciales que lo justifiquen, y desarmarlo obligaría a mantener **dos formas del
mismo dominio** en paso — la duplicación que ADR-024 evita en el código. La excepción es `orders`,
que una devolución sí actualiza: eso es la máquina de estados de ADR-028, no una edición de lo que la
plataforma mandó.

**Dos cosas sobre el orden y la política.** «En el orden en que se registraron» lo da el `id`, que es
monotónico por inserción, así que ninguna columna tiene que llevar un contador que pueda discrepar de
la realidad. Antes lo daba el `rowid` **implícito** de SQLite, que PostgreSQL no tiene: una de las
tres cosas que la deuda **D-21** dejó apoyadas en el motor, y que la migración `002` saldó. Y cuántos
recibos se guardan **llega con cada escritura**, porque es política del merchant y no del esquema
(constitución XI).

**Y una sobre los dos timestamps.** Vienen del almacén, como `DEFAULT` del esquema, no del reloj
inyectado — y ahí está la línea entre las dos clases de tiempo. Un instante que el **dominio**
significa (`decidedAt`, `confirmedAt`, el `received_at` de un evento) llega por el puerto `Clock` y
vive donde el dominio lo pone, porque una prueba tiene que poder decidirlo. `created_at` y
`updated_at` dicen cuándo se escribió **la fila**, que sólo el almacén sabe; como defaults, ningún
gateway puede olvidarlos y la regla de que son iguales al crear se cumple **por construcción**. Los
dos únicos lugares que actualizan una fila —la devolución de una orden y una instantánea
republicada— mueven `updated_at` ellos mismos, porque un `DEFAULT` no se dispara en un `UPDATE`.

## Qué hace el arranque con esto

`src/infrastructure/sqlite/open-store.ts` lee este directorio y **pide las versiones en orden —1, 2,
3— en vez de ordenar lo que encuentra**. `readdirSync` no promete ningún orden (ext4 responde en
orden de hash), así que ordenar sería lo único entre una aplicación correcta y una silenciosa, y
ninguna prueba puede desordenar un listado de directorio para demostrar que funciona. Pedirlas en
turno no necesita comparador y encuentra gratis el otro error: **un hueco**, que es lo que parece una
migración perdida en un merge. La última que pide es la versión que la build espera.

Entonces:

- **Archivo vacío y sin tablas** → aplica todas, en ese orden.
- **Una versión entre 1 y la esperada** → aplica **sólo las pendientes**, cada una en su transacción.
  Estar al día no es un caso especial: es ese mismo recorrido sin encontrar nada que hacer.
- **Un hueco en la numeración** (001 y 003, sin 002) → **no arranca**, nombrando la que falta.
- **Cualquier otra cosa** —una versión mayor que la que la build conoce, o versión 0 con tablas
  adentro— → **no arranca, y dice qué esperaba** (FR-006). Un servidor que arranca sobre algo que no
  entiende es peor que uno que no arranca: falla más tarde y en otro lado.

Un arranque rechazado **cierra la base que había abierto**; no deja la conexión detrás.

**Cada migración va en su propia transacción**, y eso es lo que vuelve segura una que **reconstruye**
una tabla —crear, copiar, borrar, renombrar, que es lo que SQLite obliga para agregar una clave
primaria—: se aplica entera o ninguna. Sin la transacción, un fallo a mitad dejaría el almacén en una
forma que no es ni la vieja ni la nueva, con `user_version` diciendo la vieja, y el arranque
siguiente correría la misma migración sobre los restos.

**La migración hacia adelante llegó en la feature 031.** La 030 la había dejado afuera con su motivo
—no había datos en ninguna parte, así que un almacén sólo podía estar vacío o al día— y la segunda
migración del repositorio volvió ordinario el caso de un almacén una versión atrás.

## Qué hace cada clave cuando la escritura se repite

No es un detalle de implementación: es lo que hace de esto un ledger y no una tabla cualquiera, y
cada tabla lo decide con su clave primaria, no con una lectura previa del llamador.

| Tabla               | Una segunda escritura con la misma clave                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decisions`         | **se rechaza**: el ledger no se sobrescribe, y la escritura degrada a `NO_OP ledger-unavailable`                                                                                     |
| `exposures`         | no hace nada y responde `already-recorded`: es la idempotencia de la confirmación                                                                                                    |
| `corroborations`    | no hace nada y responde `repeated`: el primero gana                                                                                                                                  |
| `assignments`       | no hace nada: el primer brazo gana, y por eso el visitante vuelve al mismo                                                                                                           |
| `orders`            | la decide el puerto dentro de una transacción: primero, repetido o **conflicto**, sin pisar nada                                                                                     |
| `catalog_snapshots` | reemplaza: una publicación supersede a la anterior, que es lo que una instantánea significa                                                                                          |
| `catalog_receipts`  | no aplica: no tiene clave, es un append que se poda al tope que el merchant fija                                                                                                     |
| `received_events`   | **la clave no es el evento sino la llegada**: el mismo `event_id` dos veces son dos filas, y eso es lo que hace forense al registro; lo que se rechaza es la misma llegada dos veces |

`decisions` rechaza en vez de conservar en silencio porque un identificador repetido ahí no es una
repetición: es un generador roto, y perder la evidencia de la primera decisión sería la peor forma
de enterarse.

`received_events` es la excepción deliberada de esta tabla, y por el motivo contrario: un reintento
del SDK trae el mismo `event_id`, y **cada llegada es un hecho** que el registro existe para
conservar. Si el evento fuera único no se podría registrar un duplicado, que es la mitad de lo que
hace útil al registro (feature 031, FR-005). Lo único es `(merchant_id, batch_id, position)`, que es
la identidad de una llegada y la idempotencia de su escritura.

## Cómo se agrega una

1. Un archivo nuevo, con **el número siguiente sin saltear ninguno**, que termina en
   `PRAGMA user_version = NNN`. El arranque rechaza un hueco.
2. Su fila en el inventario de abajo.
3. La suite de durabilidad (`npm run test:durability`), que abre un almacén vacío y verifica que el
   esquema que queda es el que la build espera — y que la versión que el archivo fija es la que su
   nombre anuncia.

## Inventario

| Entrada                                      | Qué es                                                                                                                                                                                                                                               | Versión que deja | Fuente o derivado | Quién lo lee                                       | Verificación                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- | -------------------------------------------------- | -------------------------------- |
| `001-ledger-and-catalog.sql`                 | La primera forma: una tabla por entidad del ledger —decisiones, exposiciones, órdenes, corroboraciones, asignaciones— más el catálogo y sus recibos.                                                                                                 | 1                | fuente            | `src/infrastructure/sqlite/open-store.ts` al abrir | `tests/durability/store.test.ts` |
| `002-received-events-and-surrogate-keys.sql` | El registro de lo que el SDK manda (`received_events`, una fila por evento y por llegada), y las dos reglas de arquitectura del dueño aplicadas a las siete tablas anteriores: clave primaria autoincremental propia, y `created_at` / `updated_at`. | 2                | fuente            | `src/infrastructure/sqlite/open-store.ts` al abrir | `tests/durability/store.test.ts` |
