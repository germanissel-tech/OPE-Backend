# migrations/ — la forma del almacén durable, versionada

El esquema del almacén se versiona acá (feature 030, FR-007) **para que un cambio de la forma de
los datos se revise en una PR como cualquier otro cambio**. No es un detalle de despliegue: es la
única parte de la persistencia que alguien puede leer entera sin correr nada.

Un archivo es `NNN-<nombre>.sql`, y `NNN` es la **versión que el esquema tiene después de
aplicarlo**. Cada archivo fija esa versión con `PRAGMA user_version = NNN`, que es de dónde el
arranque la lee.

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
