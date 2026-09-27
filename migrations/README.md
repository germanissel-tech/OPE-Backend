# migrations/ — la forma del almacén durable, versionada

El esquema del almacén se versiona acá (feature 030, FR-007) **para que un cambio de la forma de
los datos se revise en una PR como cualquier otro cambio**. No es un detalle de despliegue: es la
única parte de la persistencia que alguien puede leer entera sin correr nada.

Un archivo es `NNN-<nombre>.sql`, y `NNN` es la **versión que el esquema tiene después de
aplicarlo**. Cada archivo fija esa versión con `PRAGMA user_version = NNN`, que es de dónde el
arranque la lee.

## La forma de hoy

En cada tabla hay columnas para **dos cosas nada más**: el merchant, que toda lectura toma y que es
de lo que está hecho el aislamiento (constitución V), y **la clave por la que el puerto busca**. Todo
lo demás viaja en `document`, tal como el dominio lo tiene.

```mermaid
erDiagram
    decisions {
        TEXT merchant_id PK "toda lectura lo toma"
        TEXT decision_id PK
        TEXT session_id "índice decisions_by_session"
        TEXT document "razonamiento, candidatos, veredicto"
    }
    exposures {
        TEXT merchant_id PK
        TEXT decision_id PK "la clave es la idempotencia"
        TEXT document "ancla e instante"
    }
    orders {
        TEXT merchant_id PK
        TEXT order_id PK
        TEXT document "total, líneas, correlación, devolución"
    }
    corroborations {
        TEXT merchant_id PK
        TEXT order_id PK
        TEXT session_id PK "el primero gana"
        TEXT document "lo que el SDK vio"
    }
    assignments {
        TEXT merchant_id PK
        TEXT experiment_id PK
        TEXT visitor_id PK "el primero gana"
        TEXT document "el brazo y su instante"
    }
    catalog_snapshots {
        TEXT merchant_id PK
        TEXT document "productos y variantes"
    }
    catalog_receipts {
        TEXT merchant_id "índice catalog_receipts_by_merchant"
        TEXT received_at "sin clave: es un append"
    }

    decisions ||--o| exposures : "se mostró de verdad"
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

**Dos cosas que no son columnas y podrían parecerlo.** El orden de inserción no lo lleva ninguna: es
el `rowid` de SQLite, así que «en el orden en que se registraron» no depende de un contador que
pueda discrepar de la realidad. Y cuántos recibos se guardan **llega con cada escritura**, porque es
política del merchant y no del esquema (constitución XI).

## Qué hace el arranque con esto

`src/infrastructure/sqlite/open-store.ts` lee este directorio y toma la versión más alta como la
que la build espera. Entonces:

- **Archivo vacío y sin tablas** → aplica todas las migraciones en orden.
- **La versión que esperaba** → arranca.
- **Cualquier otra cosa** —otra versión, o versión 0 con tablas adentro— → **no arranca, y dice qué
  esperaba** (FR-006). Un servidor que arranca sobre algo que no entiende es peor que uno que no
  arranca: falla más tarde y en otro lado.

**Hoy no hay migración de datos**: no hay nada en producción, así que la primera versión no convive
con ninguna anterior. Cuando la haya, la decisión de cómo se migra se toma entonces y queda en su
ADR; este directorio no la prejuzga.

## Cómo se agrega una

1. Un archivo nuevo, con el número siguiente, que termina en `PRAGMA user_version = NNN`.
2. Su fila en el inventario de abajo.
3. La suite de durabilidad (`npm run test:durability`), que abre un almacén vacío y verifica que el
   esquema que queda es el que la build espera.

## Inventario

| Entrada                      | Qué es                                                                                                                                               | Versión que deja | Fuente o derivado | Quién lo lee                                       | Verificación                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- | -------------------------------------------------- | -------------------------------- |
| `001-ledger-and-catalog.sql` | La primera forma: una tabla por entidad del ledger —decisiones, exposiciones, órdenes, corroboraciones, asignaciones— más el catálogo y sus recibos. | 1                | fuente            | `src/infrastructure/sqlite/open-store.ts` al abrir | `tests/durability/store.test.ts` |
