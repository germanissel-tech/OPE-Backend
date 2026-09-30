# Feature Specification: Una acción administrativa y su entrada de auditoría se commitean juntas

**Feature Branch**: `034-auditoria-atomica`

**Created**: 2026-09-29

**Status**: Draft

**Input**: descripción del dueño, 2026-09-29 — cerrar **D-28** y la ventana que **ADR-034** deja abierta, con el diseño ya derivado en el research R-05 de la feature 033 y su enmienda.

## Cómo apareció, y qué queda abierto hoy

ADR-034 fue enmendado el 2026-09-23 con una regla: **una acción administrativa que no se pudo auditar no ocurre**. Lo que existe hoy es la mitad barata de esa regla: el decorador **pregunta antes** si el registro acepta escrituras y responde `503` sin ejecutar nada si no. Con eso, una acción que nace imposible de auditar no empieza.

Lo que queda abierto lo dice el propio ADR: **que el registro se caiga durante la acción**. El merchant queda creado, la configuración queda publicada, el experimento queda abierto — y nadie registró quién lo hizo. En un sistema cuya constitución dice que nada entra al reporte sin trazabilidad (principio IX), esa ventana es la diferencia entre una promesa y una promesa verificada.

La pieza que faltaba llegó con la feature 033: **el registro de administración ahora es durable**, así que la entrada y la acción escriben en el mismo almacén. Una unidad de trabajo las une.

## Lo que esta feature cierra, y lo que sale de D-28

D-28 registraba dos garantías del hito `persistence-and-resilience` como «la misma cosa». **Una de las dos no lo es**, y se verificó antes de escribir esta spec:

| Garantía                                              | Qué le falta                                                       | Mecanismo                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| La entrada de administración commiteada con la acción | unir dos escrituras **del mismo almacén**                          | una unidad de trabajo sobre el almacén ← **esta feature**      |
| La atomicidad del presupuesto por sesión              | exclusión entre dos lotes de **la misma sesión** que se intercalan | exclusión mutua por sesión dentro del proceso ← **otra deuda** |

El presupuesto por sesión no se arregla con una transacción del almacén: lo que se consume es un conteo en memoria, y para que una transacción sirviera habría que contarlo desde el ledger **dentro** de la unidad y abrir una unidad **en cada decisión** — una transacción de escritura en el camino caliente, sobre un motor con un solo escritor, que serializaría todas las decisiones del almacén. Decisión del dueño (2026-09-29): sale de D-28 a su propia deuda, con el hallazgo escrito.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - La acción y su registro son una sola cosa (Priority: P1)

Un operador de OPE crea un merchant. Mientras la acción corre, el almacén deja de aceptar escrituras. El operador recibe un error y, cuando vuelve a mirar, **el merchant no existe**: la acción no ocurrió, en vez de haber ocurrido sin que nadie sepa quién la hizo.

**Why this priority**: es la feature. Sin esto, la regla que ADR-034 declara es cierta sólo en el caso barato, y el caso caro —el que pasa en un despliegue con un disco lleno— deja el sistema con estado que nadie firmó.

**Independent Test**: se ejecuta una acción de administración con un registro que acepta y después con uno que falla al escribir la entrada, y se comprueba en el almacén que el efecto de la acción está en el primer caso y **no está** en el segundo.

**Acceptance Scenarios**:

1. **Given** un operador con alcance sobre la plataforma y un almacén sano, **When** crea un merchant, **Then** el merchant existe y el registro tiene su entrada, y las dos cosas siguen ahí después de un reinicio.
2. **Given** un almacén que falla al escribir la entrada de auditoría, **When** el operador crea un merchant, **Then** recibe `503 store-unavailable` y el merchant **no** existe ni sus orígenes quedaron reservados.
3. **Given** una acción que una regla de negocio rechaza, **When** el operador la intenta, **Then** recibe el rechazo que corresponde **y el registro tiene su entrada**: un rechazo también es algo que un operador hizo.
4. **Given** un almacén que no acepta escrituras desde antes de la acción, **When** el operador la intenta, **Then** recibe `503 store-unavailable` — la misma respuesta que hoy, aunque el momento en que se descubre sea otro.

---

### User Story 2 - El tráfico del SDK no paga la auditoría de nadie (Priority: P2)

Mientras un operador publica configuración, una tienda sigue mandando eventos. Las peticiones del SDK siguen respondiendo, ninguna decisión degrada por encontrar el almacén ocupado, y ninguna llegada al registro de eventos se pierde.

**Why this priority**: es la mitad que decide si la feature es aceptable. El principio IV prohíbe escrituras bloqueantes en el camino crítico de decisión, y una unidad de trabajo abierta por una acción de administración **hace esperar** a quien quiera escribir. Sin un criterio medido, esta feature podría cerrar una ventana de auditoría a cambio de apagar decisiones.

**Independent Test**: se manda tráfico de ingesta de forma continua mientras corren acciones de administración, y se comparan el p95 de la ingesta y los motivos de las decisiones contra la misma corrida sin acciones.

**Acceptance Scenarios**:

1. **Given** tráfico de ingesta continuo, **When** un operador ejecuta acciones de administración durante esa corrida, **Then** ninguna decisión responde `NO_OP` con motivo de almacén no disponible.
2. **Given** una acción de administración en curso, **When** el registro de eventos intenta vaciar sus llegadas pendientes, **Then** las conserva y las escribe en el intento siguiente: el conteo final de llegadas registradas es exacto.
3. **Given** dos acciones de administración simultáneas, **When** las dos escriben, **Then** cada una deja su acción y su entrada completas, y ninguna ve a medias lo que la otra escribió.

---

### User Story 3 - Un olvido no puede ser silencioso (Priority: P3)

Quien agregue un almacén durable a este sistema tiene que hacer una cosa más para que su gateway respete la unidad de trabajo. Si se la olvida, su primera prueba falla; no escribe dentro de la transacción de otro sin que nadie se entere.

**Why this priority**: la corrección de esta feature no depende de recordar algo. Un gateway que se olvide de esperar su turno rompe la atomicidad de la acción **de otro módulo**, y ese defecto es invisible: escribe bien, la acción se aplica bien, y lo único que queda mal es lo que pasa cuando algo falla. La alternativa a fallar ruidosamente es confiar en la memoria de la próxima persona.

**Independent Test**: se construye un gateway que escribe sin esperar su turno y se comprueba que la escritura falla de forma inmediata y ruidosa mientras hay una unidad abierta.

**Acceptance Scenarios**:

1. **Given** una unidad de trabajo abierta por otra petición, **When** un componente escribe sin esperar su turno, **Then** la escritura falla con un error de programación y no se aplica.
2. **Given** ninguna unidad abierta, **When** ese mismo componente escribe, **Then** funciona normalmente: la verificación no cuesta nada cuando no hay nada abierto.

---

### Edge Cases

- **El caso que la feature existe para cubrir**: el registro falla **después** de que la acción escribió. Todo se revierte.
- **Un rechazo de negocio dentro de la unidad**: la acción no cambió nada, pero su entrada se escribe y la unidad se cierra. Auditar un rechazo es parte de la regla, no una excepción a ella.
- **Un error de programación en medio de la acción**: no queda ni la acción ni la entrada, que es lo que ya pasa hoy con un `500`.
- **La semilla del arranque es una acción administrativa**: se audita, y un almacén que no acepta escrituras desde el arranque sigue impidiendo arrancar.
- **Una unidad que no cierra**: cualquier escritura posterior espera. La feature tiene que decir qué acota la vida de una unidad, porque una que quede abierta detiene todas las escrituras del proceso.
- **El despliegue en memoria**: no hay nada que componer. La garantía se declara como del despliegue durable, y el comportamiento observable de las 21 operaciones no cambia en ninguno de los dos.
- **Dos procesos**: fuera de alcance como en todo el hito (**D-21**). La unidad de trabajo es del proceso; con dos, cada uno tiene la suya.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Una acción de administración y su entrada de auditoría MUST aplicarse como una sola unidad: o las dos quedan, o ninguna.
- **FR-002**: Si la entrada de auditoría no se puede escribir, el efecto de la acción MUST NOT quedar aplicado, y el operador MUST recibir `503` con el problema de almacén no disponible.
- **FR-003**: La consulta previa de escribibilidad del registro MUST desaparecer: la garantía la da la unidad de trabajo, y dos mecanismos para la misma promesa son dos lugares donde puede fallar.
- **FR-004**: Mientras una unidad está abierta, ninguna escritura ajena MUST poder aplicarse dentro de ella.
- **FR-005**: Una escritura que llegue mientras hay una unidad abierta MUST esperar su turno y aplicarse después; MUST NOT rechazarse ni perderse por esa causa.
- **FR-006**: El registro de eventos, que no puede esperar porque su escritura no se puede esperar por diseño, MUST conservar sus llegadas pendientes y escribirlas en el intento siguiente. Ninguna llegada MUST descartarse por encontrar el almacén ocupado.
- **FR-007**: Una decisión concurrente MUST NOT degradar por encontrar el almacén ocupado: el motivo de almacén no disponible queda para un almacén que **falla**, no para uno que está ocupado.
- **FR-008**: Un componente que escriba en el almacén sin esperar su turno MUST fallar de forma inmediata y ruidosa. Ese fallo MUST ser un error de programación y no un comportamiento del que alguien tenga que enterarse en producción.
- **FR-009**: El aislamiento entre merchants MUST conservarse: una acción sobre un merchant MUST NOT revertir ni dejar a medias nada de otro merchant.
- **FR-010**: El comportamiento observable de las operaciones de administración MUST NO cambiar: los mismos códigos, los mismos cuerpos, el mismo contrato.
- **FR-011**: La semilla del arranque MUST seguir auditándose, y un registro que no acepta escrituras al arrancar MUST seguir impidiendo que el servidor arranque.
- **FR-012**: La vida de una unidad de trabajo MUST estar acotada por la acción que la abrió: ninguna acción MUST poder dejar una unidad abierta detrás de sí, ni al fallar ni al lanzar.

### Key Entities

- **Unidad de trabajo**: el ámbito durante el cual varias escrituras del almacén se aplican juntas o ninguna. Se abre, se espera, y se cierra o se revierte. La abre quien tiene algo que garantizar, no quien escribe.
- **Turno**: el permiso para tocar el almacén. Fuera de una unidad se concede de inmediato; con una unidad abierta, cuando cierra. Es lo que hace que una escritura ajena espere en vez de intercalarse.
- **Entrada de auditoría**: lo que un operador hizo, con su resultado o su rechazo. Ya existe y ya es durable; lo que cambia es **cuándo** queda commiteada.
- **Llegada pendiente**: un evento que el registro de eventos recibió y todavía no escribió. Ya existe; lo que cambia es que ahora también puede quedar pendiente porque el almacén está ocupado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **La ventana queda cerrada**: no existe ningún instante en que el efecto de una acción de administración esté aplicado y su entrada de auditoría no. Verificable haciendo fallar el registro después de que la acción escribió, y comprobando en el almacén que no queda nada de la acción.
- **SC-002**: **Lo que una acción de administración le cuesta a una decisión concurrente está medido y es aceptable.** Con tráfico de ingesta continuo y acciones de administración en paralelo, el p95 de la ingesta no empeora de forma apreciable contra la misma corrida sin acciones, medido en la misma corrida y en la misma máquina. Es la condición de aceptación de la feature.
- **SC-003**: **Ninguna llegada se pierde por un almacén ocupado**: el conteo de llegadas registradas después de una corrida con acciones de administración concurrentes es exactamente el de las llegadas aceptadas.
- **SC-004**: **Ninguna decisión degrada por esta causa**: cero decisiones con motivo de almacén no disponible en una corrida donde el almacén nunca falló.
- **SC-005**: **El olvido falla solo**: un componente que escribe sin esperar su turno falla en su primera prueba, verificado con un componente escrito para eso.
- **SC-006**: **Nada del comportamiento existente cambia**: las 21 operaciones de administración responden lo mismo, y ninguna prueba de comportamiento anterior cambia de expectativa.
- **SC-007**: **El aislamiento entre merchants sigue verificado**, con pruebas que lo comprueban a través de una acción que revierte.
- **SC-008**: **Los dos despliegues siguen respondiendo igual** en las pruebas de comportamiento; la garantía nueva se declara y se prueba sobre el durable.

## Assumptions

- **Se implementa sobre el mismo almacén que las cuatro features anteriores** (D-21: PostgreSQL y sus pruebas de concurrencia, después). Un proceso.
- **El diseño está derivado y no se re-deriva**: el research R-05 de la feature 033 y su enmienda dejaron las tres piezas y las tres alternativas descartadas con su motivo. Esta spec dice qué tiene que ser cierto; el plan cita ese diseño en vez de inventar otro.
- **El contrato no cambia.** El catálogo de problemas declara el problema de almacén no disponible como slug, estado `503` y título, sin decir cuándo se comprueba, así que mover el descubrimiento del principio al final de la acción no cambia ninguna respuesta publicada. El plan verifica que toda operación alcanzada ya declara `503`.
- **El puerto sobrevive al cambio de motor**: con PostgreSQL la unidad de trabajo es la transacción del cliente del pool y la parte que hace esperar el turno desaparece. Nada de este trabajo se tira, y por eso hacerlo antes de D-21 no es adelantar trabajo perdido.
- **Un rechazo de negocio se audita**, como hoy. La unidad de trabajo no cambia qué se audita, sólo cuándo queda firme.
- **La suite que cruza reinicios sigue siendo la única cobertura de los gateways durables**, así que es donde vive lo que sólo se ve contra un almacén de verdad.

## Lo que esta feature NO hace, con su motivo

- **La atomicidad del presupuesto por sesión.** Decisión del dueño (2026-09-29): es otro mecanismo —exclusión por sesión, no una transacción del almacén— y va a su propia deuda con el hallazgo que lo demuestra.
- **PostgreSQL** (D-21). Se implementa sobre SQLite, como las cuatro anteriores.
- **Arreglar D-29**, que dice que el registro de administración informa que importó la semilla cuando no la importó. Toca un esquema publicado del contrato y esta feature no toca HTTP.
- **Dar canal de fallo a las lecturas de los puertos durables.** Sigue siendo trabajo del hito, y esta feature no lo necesita.

## El riesgo central, dicho de frente

Esta feature **pone a esperar al camino de decisión**. Hoy un gateway durable escribe cuando quiere; después de esto, espera su turno si hay una unidad abierta. Una acción de administración dura lo que dura una escritura local, así que la espera debería ser invisible — pero «debería» es exactamente lo que el hito no acepta: por eso SC-002 es la condición de aceptación y no una métrica informativa.

Y hay una forma de equivocarse que ninguna medición encontraría: que el registro de eventos, cuya escritura **nadie puede esperar** por diseño, intente esperar su turno. Eso no sería lento, sería una regresión del principio IV metida por la puerta de al lado. Lo que tiene que hacer es lo que una cola sabe hacer: quedarse con lo pendiente y reintentar.
