---
paths:
  - "src/interface-adapters/*/gateways/**"
  - "src/infrastructure/sqlite/**"
  - "migrations/**"
---

# Cómo se escribe un gateway durable (features 030 y 034; ADR-021, ADR-024, ADR-038)

Un gateway durable traduce entre una entidad del dominio y una tabla. Siete cosas, y las cuatro
primeras son las que se equivocan.

- **El driver no se importa: llega.** El anillo de adaptadores **no puede importar
  `infrastructure/`** (ADR-013), y un gateway no importa npm ni un driver de `node:`. Lo que recibe
  por su enlace es un `SqlStore` (`interface-adapters/shared-kernel/sql-store.ts`): `all`, `run`,
  `transaction`, `close`, todo **síncrono**, porque el SQLite de la biblioteca estándar lo es. El
  gateway envuelve en `Promise` y el puerto no cambia de forma. **No** se envuelve la escritura en
  `setImmediate` para «no bloquear»: no la hace asíncrona, la hace impredecible — el orden deja de
  estar garantizado y la degradación de ADR-021 deja de observarse (ADR-038).

- **El turno se espera, y no esperarlo lanza** (feature 034). Antes de tocar el almacén va
  `await store.enter()`. Mientras hay una **unidad de trabajo ajena** abierta —una acción de
  administración escribiendo su efecto y su entrada de auditoría juntos—, `run`, `all` y
  `transaction` **lanzan** (`did not wait its turn`), y eso es a propósito: escribir dentro de la
  transacción de otro no rompe nada visible hasta que algo falla, así que el olvido tiene que fallar
  en la primera prueba y no en producción (es un error de programación, ADR-023). Fuera de una unidad
  el turno está concedido y cuesta una microtarea.
  **Los tres envoltorios ya lo hacen**: `stored`, `attempted` y `fetched` desembocan en una sola
  línea de `src/interface-adapters/shared-kernel/durable-store.ts`, así que un gateway escrito con
  ellos no tiene que acordarse de nada;
  el que llama a `store.run` o `store.all` a mano, sí. Y un gateway **no abre** una unidad: la abre
  quien tiene algo que garantizar, por el puerto `UnitOfWork` (ADR-023, casos de uso). Los dos
  gateways de `tests/durability/unit-of-work.test.ts` —idénticos salvo esa línea— son el caso que lo
  fija.

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
sólo para el merchant y la clave que el puerto busca; el resto es el documento.

El arranque tiene cuatro salidas y conviene saber cuál es cuál: aplica **todo** el esquema a un
archivo vacío; aplica **sólo lo pendiente** a un archivo entre 1 y la versión esperada, cada
migración en su transacción (feature 031); usa el que ya está en la esperada; y **rechaza todo lo
demás diciendo qué esperaba** —una versión mayor que la que el build conoce, y la versión 0 con
tablas adentro, que es una base ajena en nuestra ruta—.

Por eso una migración que **reconstruye** una tabla —crear, copiar, borrar, renombrar, que es lo que
SQLite obliga para agregar una clave primaria— es segura contra un almacén con datos: la transacción
la hace entera o ninguna. Sin ella el almacén quedaría en una forma que no es ni la vieja ni la
nueva, con `user_version` diciendo la vieja, y el arranque siguiente correría la misma migración
sobre los restos. `migrations/README.md` tiene el detalle y el inventario.
