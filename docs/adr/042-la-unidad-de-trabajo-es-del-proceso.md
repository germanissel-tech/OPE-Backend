---
numero: 042
titulo: La unidad de trabajo es del proceso, y el turno que la hace cumplir
estado: aceptada
fecha: 2026-09-30
fuente: specs/034-auditoria-atomica/research.md (R-01 a R-05), medición del 2026-09-29
---

# ADR-042 — La unidad de trabajo es del proceso, y el turno que la hace cumplir

La feature 034 cierra la ventana que la enmienda de **ADR-034** dejó abierta y nombró: una acción
administrativa y su entrada de auditoría tienen que quedar las dos o ninguna, y hasta acá la regla se
sostenía preguntándole al registro **antes** de actuar, lo que cubre un registro que ya está
rechazando y nada más. El caso que cuesta —el registro cayéndose **durante** la acción, que deja un
merchant creado y a nadie registrado como su autor— no se podía expresar.

Con la 033 la entrada y la acción escriben en el mismo almacén, así que una transacción las une. Lo
que faltaba no era la transacción: era poder tenerla abierta a través de un `await`. `SqlStore.transaction`
es **síncrona** porque `node:sqlite` lo es, y un caso de uso es asíncrono; envolver un `await` en una
transacción síncrona no es incómodo, es inseguro — el `await` cede al bucle de eventos y otra petición
escribe adentro de la transacción abierta.

Tres decisiones de esta feature son transversales y van juntas porque son una sola cosa vista de tres
lados: qué se le permite al camino de decisión, qué pasa con quien se olvida, y qué de todo esto
sobrevive al cambio de motor.

## Decisión 1 — Una decisión puede **esperar un turno**, y es la cuarta excepción al principio IV

El almacén gana una **unidad de trabajo**: `scope(work)` abre la transacción, corre el trabajo
asincrónico adentro y la cierra o la revierte. Mientras una unidad está abierta, **toda otra escritura
y toda otra lectura del almacén esperan su turno** (`enter()`), incluidas las del camino de decisión.

Eso es una excepción al principio IV y se declara como tal. El trato es el de **ADR-038** —la
escritura durable que se quedó en el camino crítico— y el de **ADR-040** —la lectura que la decisión
espera para no olvidar un tope—: se nombra, se acota y se mide.

**Lo que la acota**: la vida de una unidad es la de la acción que la abrió (FR-012). Ninguna acción
puede dejar una abierta detrás de sí, ni al fallar ni al lanzar, y eso no es una intención sino la
forma del mecanismo — la transacción se cierra en el `finally` que libera el turno, así que un throw
la revierte y la suelta. Una acción administrativa es una escritura local de unas pocas filas.

**Lo que se midió** (`tests/durability/admin-concurrency.test.ts`, esta máquina, 2026-09-29): el
costo del turno para una ingesta concurrente fue de **3.78, 4.85 y 3.96 ms** en tres corridas, del
orden de lo que dura una escritura de administración.

Y la medición necesitó una tercera ventana para significar algo, que es el aporte de método de esta
feature: contra una ventana tranquila el delta da el doble, porque la mitad es el costo de que **haya
otra petición** en un bucle de eventos y no del turno. Así que la carga corre dos veces —como
**lecturas** de administración, que van al mismo almacén y no abren unidad, y como **escrituras**, que
sí— y lo que se le atribuye al mecanismo es la diferencia entre esas dos. Sin la ventana de control el
número informado habría sido el doble del real, y la decisión se habría tomado sobre él.

**El número no se convierte en un umbral**, igual que en ADR-038 y ADR-040: la prueba afirma un techo
—diez milisegundos, que es lo que descarta las formas de fallar del mecanismo, no lo que mide su
costo— y publica la cifra. Una laptop con SQLite y sin red (**D-21**).

**Y hay un lugar donde esperar estaba prohibido**: la cola del registro de eventos, cuya escritura
nadie puede esperar por diseño (`record` devuelve `void`, `flush` es síncrono, ADR-039). Ahí el turno
no se espera: se **pregunta** (`busy()`, sincrónico) y, si el almacén está ocupado, la cola se queda
con sus llegadas y las escribe en el intento siguiente. Ninguna llegada se descarta por esa causa
(FR-006), y la única pérdida posible —una unidad abierta cuando el proceso drena al cerrar— se
**declara** como se declara toda otra pérdida del registro (FR-018).

## Decisión 2 — Un olvido lanza, y hay una sola forma de ser atómico

Con `AsyncLocalStorage` el almacén sabe si quien lo llama está dentro de **su propia** unidad. Sobre
eso: `run`, `all` y `transaction` **lanzan** si hay una unidad abierta y el llamador no es su dueño.

Es un error de programación, y por eso se lanza y no se degrada (ADR-023). El motivo es la clase de
defecto que sería: un gateway que se olvida de esperar su turno **escribe bien**, la acción se aplica
bien, y lo único que queda mal es lo que pasa cuando algo falla — invisible hasta el día que importa.
La alternativa a fallar ruidosamente es confiar en la memoria de la próxima persona. Los tres
envoltorios del anillo (`stored`, `attempted`, `fetched`) esperan el turno en una sola línea, así que
un gateway escrito con ellos no tiene que acordarse de nada; la regla acotada de los gateways
durables lo dice para el que no los use.

**Y una sola forma de ser atómico**: `transaction` es un **savepoint**, siempre, también cuando no hay
ninguna unidad abierta. La alternativa era ramificar entre `BEGIN` y savepoint según hubiera unidad, y
se descartó por algo mejor que la prolijidad: el savepoint más externo de una conexión **se comporta
exactamente como una transacción**, así que la rama era una distinción que nada podía observar — y el
gate de mutación lo dijo sobreviviendo a los dos lados de ella. Por el mismo camino, la migración del
esquema dejó de tener su propio `BEGIN`/`COMMIT`/`ROLLBACK`: su rollback no se podía observar porque
un arranque que falla cierra la base y cerrar revierte igual, y a través del savepoint sí se observa.
Un mecanismo ejercitado por todo, en lugar de dos ejercitados a medias.

## Decisión 3 — La unidad es del proceso, y el puerto sobrevive al cambio de motor

`UnitOfWork` es un puerto del kernel de **aplicación**: `scope(work)` devuelve un `Result`, y el
trabajo recibe el `abort` con el que pide la reversión. El decorador de auditoría no sabe qué hay
detrás, y el despliegue en memoria tiene su propia implementación, que corre el trabajo y **reporta el
abort como fallo aunque no pueda revertir** — un despliegue que devolviera `201` por una acción sin
auditar diría lo contrario de lo que la regla promete.

Con PostgreSQL, `scope` es `BEGIN`/`COMMIT` sobre un cliente del pool y **el turno desaparece**: es la
mitad específica de un motor con un solo escritor y una sola conexión. Lo que no cambia es el puerto,
el decorador, ni lo que las pruebas afirman. Nada de este trabajo se tira (**D-21**).

**La unidad es del proceso**, no del sistema: con dos procesos cada uno tiene la suya, y dos acciones
administrativas simultáneas en procesos distintos no se serializan entre sí. Es la misma frontera que
el resto del hito declara (**D-21**) y no se sobrepromete.

## Consecuencias

- La ventana que ADR-034 nombró queda cerrada, y su verificación previa —`AuditTrail.writable()`—
  desaparece: dos mecanismos para la misma promesa son dos lugares donde puede fallar.
- El camino de decisión puede esperar un turno. Está medido, acotado por la acción que lo abre, y la
  cifra se publica cada vez que la prueba corre.
- Ninguna decisión degrada por un almacén **ocupado**: el motivo de almacén no disponible queda para
  un almacén que **falla**.
- Un gateway durable nuevo tiene una obligación más, y olvidarla falla en su primera prueba en vez de
  en producción.
- El comportamiento observable no cambia: los mismos códigos, los mismos cuerpos, el mismo contrato.
  Lo que cambió de lugar es **cuándo** se commitea la entrada de auditoría.
- Lo que el despliegue en memoria no puede prometer se declara en lugar de simularse, y lo que sólo se
  ve cruzando un reinicio se prueba donde vive.
