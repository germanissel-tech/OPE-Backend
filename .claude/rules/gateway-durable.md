---
paths:
  - "src/interface-adapters/*/gateways/**"
  - "src/infrastructure/sqlite/**"
  - "migrations/**"
---

# Cómo se escribe un gateway durable (feature 030; ADR-021, ADR-024, ADR-038)

Un gateway durable traduce entre una entidad del dominio y una tabla. Seis cosas, y las tres
primeras son las que se equivocan.

- **El driver no se importa: llega.** El anillo de adaptadores **no puede importar
  `infrastructure/`** (ADR-013), y un gateway no importa npm ni un driver de `node:`. Lo que recibe
  por su enlace es un `SqlStore` (`interface-adapters/shared-kernel/sql-store.ts`): `all`, `run`,
  `transaction`, `close`, todo **síncrono**, porque el SQLite de la biblioteca estándar lo es. El
  gateway envuelve en `Promise` y el puerto no cambia de forma. **No** se envuelve la escritura en
  `setImmediate` para «no bloquear»: no la hace asíncrona, la hace impredecible — el orden deja de
  estar garantizado y la degradación de ADR-021 deja de observarse (ADR-038).

- **Lo que se escribe es `entidad.record()`, nunca una copia hecha acá.** Toda entidad que un
  almacén guarda tiene su `record()`, la contraparte de `rehydrate` (`Order`, `DecisionBase`,
  `Corroboration`, `CatalogSnapshot`). Listar los campos en el gateway pone la forma del dominio en
  el único lugar que no puede mantenerse al día con él: **el día que el dominio gana un campo, se
  pierde en silencio**, y lo nota la prueba que casualmente lo llevaba. Un spread de la instancia
  tampoco: pierde el prototipo, y el lint lo rechaza.

- **Al leer, toda clase anidada se rehidrata.** Es el error que se ve bien en toda lectura y falla
  en la única escritura que importa. Un `Order` cuyo `total` volvió como `{amount, currency}` no
  tiene `equals`; uno cuyo `returned` volvió como objeto plano **lanza** cuando alguien repite la
  devolución. `JSON.parse` no devuelve clases: cada parte que lo es se nombra y se rehidrata (ver
  `src/interface-adapters/outcomes/gateways/sqlite-order-ledger.ts`, que rehidrata cuatro). Las fechas sí vuelven solas —`toDocument` y
  `fromDocument` las marcan (`src/interface-adapters/shared-kernel/document.ts`), así que un campo `Date` nuevo viaja sin
  que ningún gateway se entere—. **Nada más vuelve solo.**

- **El fallo se traduce con `attempted`, y sólo en las escrituras.** Devuelve el valor o
  `LedgerUnavailable` (ADR-021), y **loguea la causa antes de tragarla**: el canal de fallo dice «no
  se registró nada», que es lo que el plano necesita para fallar cerrado y lo que no alcanza para
  diagnosticar — un disco lleno, un permiso perdido y un esquema que derivó se ven iguales salvo en
  esa línea. Sólo las escrituras pasan por ahí, porque sólo ellas tienen dónde reportar: un `find`
  devuelve el registro o nada, y si falla, lanza. Darle canal de fallo a las lecturas es cambiar
  todos los puertos, y es trabajo del hito.

- **Lo que decide primero/repetido/conflicto va en una transacción.** `01 §6`: ningún paso
  asincrónico entre comprobar y escribir. Un `SELECT` y un `INSERT` sueltos dejan un hueco; lo mismo
  `changes()`, que es por conexión y fuera de una transacción haría ver una primera confirmación
  como repetida. Y donde una clave primaria puede decidirlo sola —`ON CONFLICT … DO NOTHING`— **que
  lo decida el almacén**, no una lectura previa del llamador.

- **Su prueba va en `tests/durability/`, y no hay otra.** El proyecto `fast` corre en memoria a
  propósito (research R-06 de la 030), así que **ninguna prueba de ahí toca estos gateways**. La
  cobertura es entera de esa suite, y por eso lleva un caso por puerto y por garantía —lectura,
  idempotencia, aislamiento entre merchants, degradación— y no una muestra. Cruzar el reinicio es lo
  único que se prueba ahí: si un caso pasa sin `restart()`, va en `fast`.

## El esquema y sus migraciones

Una migración es `migrations/NNN-<nombre>.sql` y termina en `PRAGMA user_version = NNN`. Columnas
sólo para el merchant y la clave que el puerto busca; el resto es el documento. El arranque aplica
el esquema a un archivo vacío, acepta la versión que espera y **rechaza todo lo demás diciendo qué
esperaba** —incluida la versión 0 con tablas adentro, que es una base ajena en nuestra ruta—.
`migrations/README.md` tiene el detalle y el inventario.
