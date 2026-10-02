---
numero: 043
titulo: La costura entre motores es el puerto, y lo que no se abstrae del almacén
estado: aceptada
fecha: 2026-10-02
fuente: specs/037-registros-honestos/spec.md y research.md; evaluación de la persistencia con el dueño, 2026-10-02
---

# ADR-043 — La costura entre motores es el puerto, y lo que no se abstrae del almacén

El 2026-10-02 se evaluó la persistencia del anillo de adaptadores con una pregunta concreta: si había
una forma mejor de modelar los gateways en memoria y en SQLite, pensando en el PostgreSQL de D-21. Se
propusieron cinco cambios y se tensionó cada uno contra el contrato, los ADR y el modelo de concurrencia
del motor. Cuatro no sobrevivieron y uno se partió en dos: un defecto de tipos que se corrigió en la
feature 037, y lo que este ADR fija, que es **lo que ninguna decisión anterior decía** y que, sin estar
escrito, volvería a proponerse.

## Contexto

Hay un vocabulario de almacén en el anillo de adaptadores, `SqlStore`
(`src/interface-adapters/shared-kernel/sql-store.ts`), que todo gateway durable recibe por su enlace
y que sólo `src/infrastructure/sqlite/open-store.ts` implementa (ADR-013). ADR-038 dice por qué la
escritura queda en el camino crítico y ADR-042 por qué hay un turno; ninguno dice **qué es** esa
abstracción ni dónde empieza lo que un motor nuevo tendría que reescribir. Leída de afuera, parece una
interfaz entre motores. No lo es, y eso fue lo que la evaluación encontró primero.

## Decisión 1 — `SqlStore` es el vocabulario del motor SQLite, no una abstracción entre motores

Es síncrono porque el driver de la biblioteca estándar, `node:sqlite`, lo es: la documentación de Node
dice que todas sus APIs ejecutan de forma síncrona, y se eligió para no agregar ninguna dependencia
(feature 030). La librería SQLite no es síncrona por naturaleza —bloquea al hilo que la llama, y otros
drivers la vuelven asíncrona en un hilo aparte—; lo síncrono es una propiedad del driver elegido. `enter`,
`busy` y `committed` existen por el escritor único y el contexto asincrónico del proceso (ADR-042).

**Consecuencia**: un gateway escrito contra `SqlStore` es un gateway de SQLite. Nombrarlo distinto no
cambia eso; lo que cambia es que ahora está dicho.

**Se revisa** si Node publica la API asíncrona de `node:sqlite` y el repo la adopta, o si SQLite pasara a
recibir tráfico real en vez de ser el almacén de desarrollo y piloto. En cualquiera de los dos casos la
atomicidad por construcción de la decisión 3 deja de ser gratis y hay que volver a medir.

## Decisión 2 — La costura para un motor nuevo es el puerto de aplicación

Un motor nuevo implementa los puertos de `src/application/*/ports/` con sus propios gateways, no una
versión de `SqlStore`. Lo que se reutiliza es lo que está **encima** del puerto —casos de uso, servicios,
dominio— y lo que está **al lado**: el códec de documento (`document.ts`), `record()`/`rehydrate` de cada
entidad, las suites de durabilidad, que prueban puertos y no SQL.

**Por qué no una interfaz asíncrona común.** Se evaluó y se descartó por algo más fuerte que la
prolijidad: lo que impide portar las transacciones no es la firma síncrona, es el modelo de concurrencia
(decisión 3). Una interfaz común haría que ese código **corra** en PostgreSQL sin ser correcto bajo dos
escritores, y le quitaría a SQLite la atomicidad que hoy le da el lenguaje.

## Decisión 3 — Las transacciones con invariantes se escriben por motor, con sus pruebas de concurrencia

Siete transacciones leen antes de escribir, y su corrección descansa en que SQLite tiene **un solo
escritor** (su documentación: sólo un proceso puede modificar la base en un momento dado) y en que, con
el driver síncrono, nada se intercala entre la lectura y la escritura. Con dos escritores esa garantía no
existe, y lo que protege a cada una es distinto:

| Transacción                                                | Dónde                                                  | Con dos escritores la protege      | Si no, pasa                                          |
| ---------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------- |
| Pedido: primero, repetido o conflicto                      | `outcomes/gateways/sqlite-order-ledger.ts`             | la clave única                     | un repetido contesta `503` en vez de «repetido»      |
| Devolución: primera o repetida                             | el mismo                                               | nada                               | dos devoluciones del mismo pedido                    |
| Versión de configuración de merchant: `MAX(version) + 1`   | `configuration/gateways/sqlite-configuration-store.ts` | el índice único                    | una publicación rechazada sin motivo visible         |
| Versión de nivel: `MAX(version) + 1`                       | `configuration/gateways/sqlite-level-store.ts`         | el índice único                    | ídem                                                 |
| Abrir un experimento: «a lo sumo uno abierto por merchant» | `experiment/gateways/sqlite-experiment-store.ts`       | **nada**: ningún índice lo expresa | dos abiertos, en silencio                            |
| Valores sin mapear: conservar la primera vez vista         | `admin/gateways/sqlite-unmapped-value-log.ts`          | nada                               | se pierde el dato que el reporte existe para mostrar |
| Exposición: `changes()` tras `ON CONFLICT DO NOTHING`      | `ledger/gateways/sqlite-exposure-ledger.ts`            | es de SQLite                       | no existe en otro motor                              |

Cada motor escribe las suyas con el mecanismo que ese motor tiene —un índice que falte, `SELECT … FOR
UPDATE`, aislamiento serializable— y con **pruebas de concurrencia entre procesos**, que la suite de
durabilidad de hoy no tiene porque hay un proceso (D-21). La lista de arriba es la lista de lo que
PostgreSQL tiene que resolver, y vive también en D-21.

## Decisión 4 — Los gateways quedan planos, con prefijo de motor

`src/interface-adapters/<módulo>/gateways/memory-*.ts` y `sqlite-*.ts`, en una sola carpeta, con los
archivos que no pertenecen a ningún motor al lado (generadores de ids, huellas, vistas sobre la
configuración, decoradores). Se evaluó una subcarpeta por motor y se descartó: más de un tercio de los
archivos no es de ningún motor y quedaría suelto; el prefijo ya agrupa en cualquier listado; lo que se
edita junto es un puerto con sus dos implementaciones, no un motor; y la prueba de inventario de
almacenes (`tests/architecture/storage-inventory.test.ts`) define qué es un almacén por ese prefijo.

**Se revisa** cuando exista un tercer motor: ahí las carpetas más grandes del anillo duplican su tamaño
y una carpeta ausente mostraría qué módulo falta portar, aunque el grafo de composición ya lo diga al no
compilar.

## Lo que se evaluó y se descartó, para que no se vuelva a proponer sin leer esto

- **Un solo nombre de fallo para todo almacén.** `ledger-unavailable`, `store-unavailable` y
  `state-unavailable` son tipos de problema publicados en el contrato y dos son motivos de `NO_OP`
  (ADR-021). Fundirlos es un cambio incompatible. Los tres envoltorios del anillo ya son una sola
  función con dos alias.
- **El índice en memoria como decorador** (ADR-041). La mitad durable de esos dos gateways no implementa
  las lecturas del camino caliente; escribirlas en SQL sería repetir reglas del dominio (`Merchant.owns`)
  para código que ningún despliegue ejecuta. Lo único duplicado es la regla de orden, y son dos casos.
- **El almacén asíncrono.** Decisiones 1 a 3.
- **La tabla de documentos genérica.** Sin la costura entre motores sólo ahorra líneas; casi ningún
  gateway es pura convención, y el SQL a mano es lo que la suite de planes de consulta verifica.

## Consecuencias

- La regla acotada de gateways durables dice qué no se abstrae y por qué; la de entidades, cómo declara
  un registro sus partes que son clases (feature 037, ADR-024).
- D-21 carga la lista de la decisión 3 y la pregunta que esta evaluación dejó abierta: si SQLite se
  queda cuando llegue PostgreSQL. Si se retira, siempre hay dos juegos de gateways, memoria y el motor
  durable, y los de hoy son la plantilla; si se queda, son tres y ese costo se acepta sabiéndolo.
- Una lectura durable que falla sigue respondiendo un error interno en vez de «servicio no disponible»
  con reintento: es deuda registrada (D-33), fuera de la feature 037 porque toca el contrato.
