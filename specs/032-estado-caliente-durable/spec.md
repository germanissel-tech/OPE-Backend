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
  **24 horas**. Es lo que evita mostrarle lo mismo a la misma persona todo el día.

Los dos son _hot, bounded state_ detrás de un puerto, y los dos dicen lo mismo en su comentario: **«a
forgotten visitor starts over»**.

**Eso significa que cada despliegue le devuelve el cupo diario a todos los visitantes.** Alguien que
ya recibió las intervenciones que la política le permite, después de un deploy vuelve a estar
disponible para todas otra vez. Pasa hoy, en cada despliegue, y **no aparece en ninguna deuda ni en
ninguna métrica**: no hay forma de enterarse.

Hay una segunda pérdida, más chica: las señales de las sesiones activas. Decidir con menos señales
de las que hubo lleva a `NO_OP`, que es el estado por defecto del sistema — molesta menos que
intervenir de más.

**Lo que hace esto reparable ahora**: una intervención **es** una decisión con veredicto `INTERVENE`
y su instante, y las decisiones son durables desde la feature 030. El dato está; lo que falta es
poder buscarlo por visitante.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El cupo del visitante sobrevive al despliegue (Priority: P1)

Un visitante recibió durante la mañana las intervenciones que su merchant permite por día. Al
mediodía hay un deploy. Hoy, a la tarde, vuelve a recibirlas todas de nuevo: para el sistema es un
visitante que nunca vio nada.

Después de esta historia sigue agotado, porque el sistema lo reconstruye de lo que registró.

**Why this priority**: es el daño real y es comercial. Intervenir de más es lo que la política
existe para impedir, y hoy un despliegue la anula sin dejar rastro.

**Independent Test**: agotar el cupo de un visitante, reiniciar el servicio y comprobar que la
siguiente decisión sigue siendo `NO_OP` por fatiga.

**Acceptance Scenarios**:

1. **Given** un visitante que agotó su cupo diario, **When** el servicio se reinicia, **Then** la
   siguiente decisión sigue degradando por fatiga y no interviene.
2. **Given** una sesión que ya alcanzó su tope de intervenciones, **When** el servicio se reinicia,
   **Then** el tope se respeta y no vuelve a cero.
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

- **El durable no responde al reconstruir** → la decisión no puede esperar para siempre. Qué se
  hace es la pregunta abierta **Q1** de esta spec.
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
- **FR-007**: La fatiga por visitante DEBE sobrevivir a un reinicio dentro de su ventana de 24 horas.
- **FR-008**: El aislamiento entre merchants DEBE valer en la reconstrucción: ninguna lectura devuelve
  nada de otro merchant.
- **FR-009**: El comportamiento observable NO DEBE cambiar cuando el estado **sí** está en memoria:
  esta feature sólo cambia qué pasa cuando no está.
- **FR-010**: Toda tabla que esta feature cree o modifique DEBE cumplir las dos reglas de
  arquitectura del dueño: clave primaria autoincremental con índice UNIQUE donde hoy hay clave de
  negocio, y `created_at` / `updated_at` iguales al crear.

### Key Entities

- **Estado de sesión**: las señales acumuladas de una visita y sus intervenciones. Caliente,
  acotado, **no es fuente de verdad**.
- **Estado de visitante**: los instantes de las intervenciones aceptadas en su ventana. Igual.
- **Reconstrucción**: leer lo durable para volver a tener un estado caliente que se perdió.

## Success Criteria _(mandatory)_

- **SC-001**: Después de un reinicio, un visitante que agotó su cupo diario **sigue agotado** — que
  hoy no ocurre y nadie mide.
- **SC-002**: Una sesión que sale de memoria y vuelve produce **la misma decisión** que si no hubiera
  salido.
- **SC-003**: En memoria están las sesiones con actividad y no las inactivas.
- **SC-004**: El comportamiento con el estado en memoria no cambia en nada.
- **SC-005**: El costo de una decisión que tuvo que reconstruir **está medido y publicado**, contra
  el motor real y no contra el perfil de desarrollo.

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

## Lo abierto

### Q1 — ¿Qué pasa si la reconstrucción falla o tarda demasiado?

La decisión espera, pero no puede esperar para siempre. Si el durable no responde, hay dos caminos y
ninguno es obviamente correcto:

- **Decidir con estado vacío**: el visitante podría recibir de más, que es justo lo que esta feature
  vino a evitar.
- **Degradar a `NO_OP`**: no interviene, que es el estado por defecto del sistema y falla cerrado
  (constitución II) — al precio de no intervenir cuando quizás correspondía.

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
