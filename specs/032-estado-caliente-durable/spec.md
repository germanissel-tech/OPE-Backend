# Feature Specification: Un reinicio deja de reiniciar los topes

**Feature Branch**: `032-estado-caliente-durable`

**Created**: 2026-09-27

**Status**: Draft

**Input**: Separada de la feature 031 el 2026-09-27, por decisión del dueño, cuando al tensionar
aquella spec quedó claro que se había comido esta. Las decisiones tomadas en esa conversación valen
y no se rediscuten; acá se registran con su fecha.

**Depende de**: la **031**, que entrega el registro de eventos del que esta feature reconstruye las
señales.

## Contexto: cada despliegue le devuelve el cupo a todo el mundo

El plano de decisión recuerda dos cosas entre un lote y el siguiente, y las dos viven **en memoria**:

- **El estado de la sesión**: las señales acumuladas —cuántas veces ocurrió cada tipo de evento,
  cuánto se demoró en cada bloque, en qué orden—, cuántas intervenciones ya recibió y cuándo fue la
  última.
- **El estado del visitante**: los instantes de las intervenciones aceptadas dentro de una ventana de
  **24 horas**.

Los dos son _hot, bounded state_ detrás de un puerto, y los dos dicen lo mismo en su comentario: **«a
forgotten visitor starts over»**.

**Eso significa que cada despliegue le devuelve el cupo a todo el mundo**, y pasa hoy, en cada
despliegue, sin aparecer en ninguna métrica: no hay forma de enterarse.

### Cuál de los dos topes muerde, que no es el que parece

La política comercial (`01 §4.5`, ADR-027) aplica los dos límites, pero con los valores vigentes
—`interventionsPerSession: 1`, `cooldownSeconds: 0`, `interventionsPerVisitorPerDay: 3`— **el que
bloquea en casi todo el tráfico es el de sesión**: una sola intervención por visita.

Para que el tope diario llegue a disparar, la misma persona tiene que abrir **cuatro visitas
separadas en un día**. Es el techo de un caso raro, y su valor es además un default que ninguna
medición respalda (**D-24**).

Entonces el daño de un reinicio entra sobre todo por el estado de **sesión**: el visitante que ya
recibió su única intervención de la visita puede recibir otra en el siguiente lote, porque el
presupuesto volvió a cero. Eso le pasa a cualquier visitante activo, no al que vuelve cuatro veces.

El estado de visitante importa igual, y por otra cosa: es el único tope que cruza visitas, así que sin
él **una cadena de despliegues no tiene techo alguno** — cada uno devuelve el cupo diario completo.

Hay una tercera pérdida, la más chica: las señales de las sesiones activas. Decidir con menos señales
de las que hubo lleva a `NO_OP`, que es el estado por defecto del sistema — molesta menos que
intervenir de más.

**Lo que hace esto reparable ahora**: una intervención **es** una decisión con veredicto `INTERVENE`
y su instante, y las decisiones son durables desde la feature 030. El dato está entero.

Y para la mitad que más muerde, **ya se puede buscar**: el ledger indexa las decisiones por sesión,
así que las intervenciones de una sesión son una consulta que hoy existe. Lo único que falta es el
índice por visitante, para el tope que cruza visitas (FR-006).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Los topes de intervención sobreviven al despliegue (Priority: P1)

Un visitante está navegando y ya recibió la intervención que le corresponde en esta visita. Al
minuto siguiente hay un deploy. Su próximo lote de eventos llega a un sistema que no sabe que ya
intervino, y el presupuesto de la sesión volvió a cero: puede recibir otra en la misma visita.

Ése es el caso frecuente. El otro, más raro pero sin techo: el visitante que agotó su cupo del día
vuelve a tenerlo entero después de cada despliegue, y con varios despliegues en un día no hay
límite que lo pare.

Después de esta historia los dos topes se respetan, porque el sistema los reconstruye de lo que
registró.

**Why this priority**: es el daño real y es comercial. Una intervención puede llevar incentivo, y
`01 §4.5` bloquea lo que destruye contribución aunque convierta; hoy un despliegue anula ese bloqueo
sin dejar rastro.

**Independent Test**: agotar el presupuesto de una sesión, reiniciar el servicio y comprobar que la
siguiente decisión sigue siendo `NO_OP` por presupuesto agotado y no una segunda intervención.

**Acceptance Scenarios**:

1. **Given** una sesión que ya alcanzó su presupuesto de intervenciones, **When** el servicio se
   reinicia, **Then** la siguiente decisión degrada por presupuesto agotado y no interviene.
2. **Given** un visitante que agotó su cupo diario, **When** el servicio se reinicia, **Then** la
   siguiente decisión sigue degradando por fatiga y el cupo no vuelve a cero.
3. **Given** dos merchants con actividad, **When** cualquiera reconstruye su estado, **Then** no lee
   nada del otro.

---

### User Story 2 - Una sesión que vuelve, vuelve como estaba (Priority: P2)

Una sesión deja de estar en memoria: la desalojó la expiración por inactividad, o hubo un reinicio.
Llega un evento suyo. Hoy arranca de cero y el plano decide como si el visitante recién llegara.

Después de esta historia, las señales se reconstruyen de los eventos registrados y la decisión se
toma con lo que realmente pasó.

**Why this priority**: mejora la calidad de la decisión, pero su falla lleva a `NO_OP` y no a
intervenir de más — por eso va después de US1.

**Independent Test**: acumular señales en una sesión, forzar que salga de memoria, y comprobar que
la decisión siguiente es la misma que habría sido sin el desalojo.

**Acceptance Scenarios**:

1. **Given** una sesión con señales acumuladas, **When** sale de memoria y llega un evento nuevo,
   **Then** la decisión es la misma que si nunca hubiera salido.
2. **Given** una sesión que nunca existió, **When** llega su primer evento, **Then** se crea vacía
   sin buscar nada que no está.

---

### User Story 3 - En memoria está lo que está pasando (Priority: P3)

La memoria del proceso es un recurso acotado y compartido: hoy un único tope de identidades lo
reparten los identificadores de evento, las sesiones y los visitantes. Guardar 24 horas de todo
desperdicia ese lugar en sesiones que nadie está usando.

Después de esta historia, en memoria están las sesiones **con actividad**, y las que se quedaron
quietas dejan lugar — sin perderse, porque se recuperan.

**Why this priority**: es eficiencia, no corrección. Hace falta antes de tener mucho tráfico, no
antes de la primera decisión correcta.

**Acceptance Scenarios**:

1. **Given** una sesión sin actividad durante el tiempo de expiración, **When** hace falta lugar,
   **Then** sale de memoria y su siguiente evento la recupera.

---

### Edge Cases

- **El durable no responde al reconstruir** → resuelto (2026-09-27): los topes son obligatorios y las
  señales best-effort. Ver «Qué pasa si la reconstrucción falla», más abajo.
- **El durable contesta que no hay nada** → es el caso más común y **no es una falla**: el visitante
  llega por primera vez. Se arranca vacío. Distinguirlo de una falla es FR-011.
- **Arranque en frío con mucho tráfico** → todas las sesiones activas piden reconstrucción a la vez.
- **Una sesión más vieja que su duración** → no se reconstruye: es otra visita, y el SDK debería
  haberle dado otro identificador. Que llegue es señal de un SDK que no cumple, y se registra.
- **Un visitante sin intervenciones previas** → la reconstrucción devuelve vacío, que es un
  resultado válido y no un error.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La **duración de una sesión** la DEBE definir el backend —**30 minutos de
  inactividad**— y DEBE viajar al SDK en la configuración que ya recibe, para que deje de ser una
  suposición del backend sobre algo que decide el cliente.
- **FR-002**: El estado caliente DEBE guardar **sólo las sesiones con actividad**, con expiración por
  inactividad.
- **FR-003**: Una sesión desalojada o perdida NO DEBE quedar perdida: DEBE reconstruirse del durable
  cuando llega un evento suyo.
- **FR-004**: La reconstrucción DEBE recuperar **las señales** (de los eventos registrados por la 031) **y las intervenciones** (del ledger de decisiones).
- **FR-005**: La decisión DEBE esperar a que la reconstrucción termine, para que el resultado sea el
  mismo que sin el desalojo.
- **FR-006**: Las intervenciones de un visitante DEBEN poder buscarse **por visitante** en el ledger
  de decisiones, que hoy sólo se indexa por decisión y por sesión.
- **FR-007**: **Los dos topes DEBEN sobrevivir a un reinicio**: el presupuesto de intervenciones de la
  sesión —que es el que bloquea en casi todo el tráfico— y la fatiga por visitante dentro de su
  ventana de 24 horas, que es el único que cruza visitas.
- **FR-008**: El aislamiento entre merchants DEBE valer en la reconstrucción: ninguna lectura devuelve
  nada de otro merchant.
- **FR-009**: El comportamiento observable NO DEBE cambiar cuando el estado **sí** está en memoria:
  esta feature sólo cambia qué pasa cuando no está.
- **FR-010**: Toda tabla que esta feature cree o modifique DEBE cumplir las dos reglas de
  arquitectura del dueño: clave primaria autoincremental con índice UNIQUE donde hoy hay clave de
  negocio, y `created_at` / `updated_at` iguales al crear.
- **FR-011**: Los puertos del estado caliente DEBEN poder decir **«no se pudo determinar»**, distinto
  de «no lo recuerdo». Hoy los dos son el mismo `undefined`, y eso hace que una falla del almacén se
  lea como un visitante nuevo — el daño que esta feature vino a impedir, por otra puerta.
- **FR-012**: Cuando no se puedan leer **las intervenciones** —de la sesión o del visitante—, la
  decisión DEBE degradar a `NO_OP` con un motivo propio, emitiendo y registrando la decisión. NO DEBE
  responder un error HTTP: en este sistema un 500 significa un defecto, y una degradación se registra
  (precedente de `ledger-unavailable`, `01 §4.7`).
- **FR-013**: El motivo nuevo DEBE ser propio y NO DEBE reusar `barrier-unclear`, que significa «no
  había evidencia suficiente»: confundirlos convertiría una falla de infraestructura en un dato falso
  del piloto. Se agrega a `contracts/no-op-reasons.yaml`, que es la fuente, y es un cambio compatible
  (ADR-014).
- **FR-014**: Cuando no se puedan leer **las señales**, la decisión DEBE tomarse con las del lote
  actual —que es lo que el sistema hace hoy en toda sesión— y la decisión DEBE registrar que las
  señales quedaron incompletas, para que el análisis no las cuente como una sesión sin actividad.
- **FR-015**: «No contestó» DEBE tener una definición: un plazo, que es **una entrada de configuración
  de plataforma y no una constante** (constitución XI, ADR-031). Su valor no se puede fijar con
  evidencia todavía (**D-21**), así que entra con un default declarado como tal y se ajusta al medir.

### Key Entities

- **Estado de sesión**: las señales acumuladas de una visita y sus intervenciones. Caliente,
  acotado, **no es fuente de verdad**.
- **Estado de visitante**: los instantes de las intervenciones aceptadas en su ventana. Igual.
- **Reconstrucción**: leer lo durable para volver a tener un estado caliente que se perdió.

## Success Criteria _(mandatory)_

- **SC-001**: Después de un reinicio, una sesión que agotó su presupuesto **sigue agotada** y un
  visitante que agotó su cupo del día **sigue agotado** — ninguna de las dos cosas ocurre hoy, y
  nadie las mide.
- **SC-002**: Una sesión que sale de memoria y vuelve produce **la misma decisión** que si no hubiera
  salido.
- **SC-003**: En memoria están las sesiones con actividad y no las inactivas.
- **SC-004**: El comportamiento con el estado en memoria no cambia en nada.
- **SC-005**: El costo de una decisión que tuvo que reconstruir **está medido y publicado**, contra
  el motor real y no contra el perfil de desarrollo.
- **SC-006**: Con el durable caído, **ninguna decisión interviene sin saber los topes** y **ninguna
  responde un error**: todas quedan registradas con su motivo.
- **SC-007**: Una falla de la reconstrucción **se distingue en el ledger** de una sesión sin barrera
  clara y de un visitante nuevo. Es lo que permite que las cifras del piloto no mezclen las tres.

## Assumptions

- **El registro de eventos de la 031 existe** y permite leer los eventos de una sesión en orden.
- **Las intervenciones son decisiones durables** desde la 030: no hay que registrarlas de nuevo, hay
  que poder buscarlas por visitante.
- **El SDK obedece la duración de sesión** que el backend declara. Que no lo haga es observable con
  el registro de la 031, y se trata como un SDK que no cumple.
- **Un solo proceso** contra el estado caliente, como el resto del almacén (**D-21**).

## La decisión que hay que declarar, y por qué

**Esperar la reconstrucción es una excepción a una regla de la constitución**: «Plano de decisión:
síncrono, acotado, **sin I/O de red saliente y sin escrituras** bloqueantes».

Cuando el estado caliente no tiene el dato, reconstruirlo es ir al durable — y en producción eso es
I/O de red en el camino de decisión. El dueño decidió (2026-09-27) que **la decisión espera**, para
que un reinicio deje de ser observable.

Eso se trata como se trató la escritura del ledger en la feature 030: **se declara en un ADR, se
mide y se acota**. Acotarla significa que ocurre sólo cuando el estado caliente no tiene el dato, y
que en producción el estado caliente vive fuera del proceso, así que un reinicio del backend no lo
pierde.

**Lo que este plan no puede verificar todavía**: cuánto cuesta realmente esa espera. Medirlo contra
SQLite local no sirve —no hay red— y el motor real no está disponible (**D-21**). El número se toma
cuando exista, y hasta entonces la excepción está declarada pero no cuantificada.

## Qué pasa si la reconstrucción falla

Decidido por el dueño el **2026-09-27**: **los topes son obligatorios, las señales best-effort.**

### Lo que la pregunta descubrió, y que no era una opción

Los puertos del estado caliente devuelven hoy `Promise<State | undefined>`. `undefined` significa «no
lo recuerdo», y es el caso normal: el primer evento de una visita. Cuando ese `load` empiece a leer del
durable, **una falla y un visitante nuevo darían el mismo valor** — y el sistema trataría la falla como
un visitante nuevo, devolviéndole el cupo entero. Es el daño de esta feature reapareciendo por la puerta
de atrás, y ninguna respuesta a la pregunta es aplicable sin arreglarlo primero (**FR-011**).

Y hoy, si el almacén lanza, la excepción llega hasta el borde HTTP y el SDK recibe un **500** por todo
el lote: sin decisión y sin fila en el ledger. Eso queda descartado por precedente, no por gusto — un
500 en este sistema significa un defecto, y una degradación se registra (**FR-012**).

### Por qué las dos mitades no son simétricas

| Lectura                                     | Qué protege                                   | Si falla                                                                                      |
| ------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Las intervenciones** (sesión y visitante) | la garantía **nueva** que esta feature agrega | nada la supla: hay que degradar                                                               |
| **Las señales**                             | la **mejora** de la calidad de la decisión    | la sesión igual absorbe las del lote actual, que es lo que el sistema hace hoy en toda sesión |

Ahí está el motivo de la asimetría, y es el único argumento que importa: **sin los topes, el sistema
hace algo que nunca hizo y que no queremos. Sin las señales, hace lo que viene haciendo en producción.**
Degradar por señales faltantes no compra corrección, cuesta intervenciones que hoy sí se emiten.

### Lo que cuesta, dicho de frente

Dos semánticas de falla en la misma reconstrucción, y un campo nuevo en la decisión para declarar que
las señales quedaron incompletas. Es más código y más superficie de prueba que una regla única, y se
paga a cambio de no apagar intervenciones por la mitad que no protege nada.

## Lo abierto

### Q2 — ¿La ventana caliente es parámetro por merchant?

Quedó abierta en la conversación del 2026-09-27. Hoy es de plataforma porque la memoria del proceso
es **un único límite compartido** entre identificadores de evento, sesiones y visitantes: un valor
por merchant sobre un recurso compartido permite que uno consuma lo de los demás, y el que se queda
afuera no se entera.

El propio código anticipó la salida: «el día que el estado caliente salga del proceso, separarlos es
un campo nuevo de este nivel, no un cambio de forma». Si esta feature saca el estado del proceso, la
pregunta se puede responder; si no, conviene dejarla donde está.

## Lo que esta feature NO hace, y por qué

- **No registra eventos**: eso es la **031**, de la que depende.
- **No cambia el plano de decisión** cuando el estado está en memoria, que es el caso normal.
- **No resuelve el commit conjunto de la entrada de administración** (ADR-034), que sigue siendo del
  hito.
- **No hace durable la configuración publicada**, que es la otra que le queda al hito.
- **PostgreSQL ni Redis** como tales: esta feature define los puertos y sus garantías; qué tecnología
  los sirve es del despliegue, como la 030 resolvió el ledger (**D-21**).
