# Feature Specification: Lo que un operador configura sobrevive al despliegue

**Feature Branch**: `033-configuracion-durable`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Prueba de la API de administración contra el servidor real (2026-09-28) y la tercera feature del hito `persistence-and-resilience`.

## Cómo apareció

Probando la API de administración contra el servidor real: alta de un merchant por `POST /v1/admin/merchants`, un experimento, su configuración publicada. Reinicio. `404 merchant-not-found`.

La superficie de administración está completa y probada —21 operaciones, todas `built`— y lo que falta no es una operación: es que lo que esas operaciones escriben dure. Hoy la fuente de verdad de los merchants es `config/*-merchants.json`, así que **cualquier panel de administración es una consola sobre un estado que se pierde en cada deploy**.

Es la tercera feature del hito, y la única que le queda a su parte de configuración.

## Lo que ya es durable, y lo que no

| Durable desde | Qué                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------- |
| 030           | decisiones, exposiciones, órdenes, corroboraciones, **asignaciones**, catálogo y sus recibos |
| 031           | el registro de eventos                                                                       |
| 032           | nada nuevo (el estado caliente se volvió **recuperable**, no durable)                        |

**En memoria, y es el alcance de esta feature**: el merchant con sus orígenes y las huellas de sus credenciales, la configuración publicada de cada merchant con todas sus versiones, la definición de sus experimentos, y el registro de qué hizo cada operador.

**Y hay una inconsistencia que esto arregla de paso.** Las asignaciones son durables y la definición del experimento no, así que un experimento creado por la API deja, después de un reinicio, asignaciones que apuntan a un experimento que ya no existe. Para los merchants de la semilla no se nota, porque el archivo vuelve a traer los mismos identificadores; para los creados por API, el identificador acuñado se perdió.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un merchant dado de alta sigue existiendo (Priority: P1)

Una persona de operaciones da de alta un merchant por la API: recibe su identificador acuñado y sus tres credenciales. El merchant queda sirviendo tráfico. Días después hay un despliegue, y el merchant sigue ahí — con sus mismos orígenes, sus mismas credenciales y su mismo estado.

**Why this priority**: es el mínimo entregable y lo que hace utilizable cualquier panel. Sin esto, dar de alta un merchant por la API es una operación que se deshace sola, y la única forma real de operar la plataforma sigue siendo editar un archivo y reiniciar.

**Independent Test**: dar de alta un merchant, reiniciar, y verificar que responde a una petición firmada con la credencial que se emitió antes del reinicio.

**Acceptance Scenarios**:

1. **Given** un merchant dado de alta por la API, **When** el servidor se reinicia, **Then** el merchant existe con su identificador, sus orígenes y su estado, y su credencial de ingesta sigue autenticando.
2. **Given** un merchant al que se le rotó la credencial con gracia para la anterior, **When** el servidor se reinicia dentro de la gracia, **Then** las dos credenciales siguen autenticando, y al vencer la gracia sólo la nueva.
3. **Given** un merchant desactivado, **When** el servidor se reinicia, **Then** sigue desactivado y sus orígenes siguen reservados — no se los puede dar a otro.
4. **Given** un merchant con el interruptor apagado, **When** el servidor se reinicia, **Then** sigue apagado: nada se asigna y nada se consume.

---

### User Story 2 - La configuración publicada y su historial sobreviven (Priority: P2)

Una persona de operaciones publica la configuración de un merchant y, semanas después, necesita ver qué estaba publicado cuando se tomó una decisión. El historial completo está ahí, con quién lo publicó, cuándo y con qué motivo.

**Why this priority**: es lo que convierte la configuración en algo auditable en vez de algo vigente. Una decisión registra con qué versión de configuración se tomó (constitución IX), y esa referencia no sirve si la versión no existe después de un deploy.

**Independent Test**: publicar dos versiones de configuración y abrir un experimento, reiniciar, y verificar que las dos versiones están con su orden y su autoría, que la efectiva es la última, y que el experimento sigue con su estado y su ventana.

**Acceptance Scenarios**:

1. **Given** dos versiones de configuración publicadas, **When** el servidor se reinicia, **Then** las dos están, en su orden, con su operador, su instante y su motivo, y la efectiva sigue siendo la última.
2. **Given** un experimento abierto y calibrando, **When** el servidor se reinicia, **Then** sigue calibrando, con su reparto, su semilla, su muestra objetivo y sus reinicios de ventana.
3. **Given** un experimento con asignaciones registradas, **When** el servidor se reinicia, **Then** las asignaciones siguen apuntando a un experimento que existe, y un visitante ya asignado vuelve al mismo brazo.

---

### User Story 3 - Una acción administrativa que no se pudo auditar no ocurrió (Priority: P3)

Una persona de operaciones toca el interruptor de un merchant. O la acción y su entrada en el registro quedan las dos, o no queda ninguna de las dos. Nunca un merchant apagado sin constancia de quién lo apagó.

**Why this priority**: cierra la ventana que ADR-034 dejó abierta. Hoy el sistema pregunta al registro **antes** de ejecutar y responde `503` si no acepta escrituras, así que una acción no auditable no empieza; lo que queda abierto es que el registro se caiga **durante** la acción. Con la acción y su entrada en el mismo almacén, es una transacción.

**Independent Test**: provocar que el registro falle en medio de una acción administrativa y verificar que el efecto de la acción tampoco quedó.

**Acceptance Scenarios**:

1. **Given** un registro de administración que falla al escribir, **When** un operador ejecuta una acción, **Then** no queda la entrada **ni** el efecto de la acción, y la respuesta lo dice.
2. **Given** una acción administrativa aceptada, **When** el servidor se reinicia, **Then** su entrada está en el registro con su operador, su operación, su resultado y su motivo.
3. **Given** el registro de un merchant, **When** se lo consulta después de un reinicio, **Then** trae sólo las entradas de ese merchant.

---

### Edge Cases

- **La semilla contra un almacén que ya tiene merchants** → no se aplica, y **se dice en el arranque**. Hoy no se aplica y no avisa, que es lo que convierte «edité el archivo y no pasó nada» en un descubrimiento.
- **Un origen que otro merchant ya tiene**, incluido un merchant desactivado → se rechaza, y sigue rechazándose después de un reinicio: la reserva del origen es parte de lo que dura.
- **Un almacén con merchants y sin configuración** de alguno → ese merchant existe y resuelve con los valores de plataforma, que es lo que pasa hoy con un merchant que nada declaró.
- **Una credencial cuya gracia venció mientras el servidor estaba apagado** → al volver, la anterior ya no autentica: la expiración es un instante, no un temporizador.
- **Dos procesos sobre el mismo almacén** → fuera de alcance por D-21, igual que en las tres features anteriores. Lo que esta feature no puede prometer es que dos altas simultáneas del mismo origen desde dos procesos se rechacen; con un proceso, sí.
- **El primer arranque de un almacén existente que nunca tuvo estas tablas** → las crea vacías y la semilla se aplica, porque un almacén sin merchants está vacío para lo que esta feature mira.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El merchant DEBE sobrevivir un reinicio con su identificador, su estado, sus orígenes y las huellas de sus tres credenciales.
- **FR-002**: La expiración de una credencial rotada DEBE sobrevivir como **instante**, de modo que una gracia vencida durante el apagado no autentique al volver.
- **FR-003**: La reserva de un origen DEBE sobrevivir, y DEBE seguir alcanzando a los merchants desactivados: un origen pertenece a un solo merchant y eso no se reinicia.
- **FR-004**: La configuración publicada de un merchant y **todas** sus versiones DEBEN sobrevivir, con su orden, su operador, su instante y su motivo.
- **FR-005**: La definición de un experimento y su ciclo de vida DEBEN sobrevivir, de modo que una asignación durable nunca apunte a un experimento que no existe.
- **FR-006**: El registro de administración DEBE sobrevivir, y sus lecturas —global y por merchant— DEBEN seguir respondiendo lo mismo después de un reinicio.
- **FR-007**: El registro de administración NO DEBE podarse. La retención queda declarada como permanente, igual que el resto del ledger.
- **FR-008**: Una acción administrativa y su entrada en el registro DEBEN quedar **las dos o ninguna**.
- **FR-009**: La semilla DEBE aplicarse **sólo** si el almacén no tiene merchants, y el arranque DEBE decir qué hizo: cuántos importó, o que no la aplicó y por qué.
- **FR-010**: Toda lectura y escritura DEBE estar aislada por merchant: nada de un merchant es visible ni alcanzable desde otro.
- **FR-011**: El comportamiento observable de la API de administración NO DEBE cambiar. Las 21 operaciones responden lo mismo; lo que cambia es cuánto dura.
- **FR-012**: La resolución del merchant por su credencial DEBE seguir ocurriendo antes de validar el cuerpo de la petición, y NO DEBE empeorar de forma apreciable la latencia de una petición del SDK.

### Key Entities

- **Merchant**: quién es un cliente de OPE para el sistema — su identificador, su estado, sus orígenes registrados y las huellas de sus credenciales con la expiración de la anterior. No lleva ningún dato personal.
- **Versión de configuración**: qué declaró un merchant, en qué momento, publicado por quién y con qué motivo. Es un historial, no un valor: la efectiva es la última.
- **Experimento**: el reparto, la semilla, la muestra objetivo, los cortes y el estado del ciclo de vida, con los reinicios de su ventana.
- **Entrada de administración**: qué operación hizo qué operador, sobre qué merchant si aplica, con qué resultado y con qué motivo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un merchant dado de alta por la API sirve tráfico después de un reinicio, con la credencial emitida antes de ese reinicio. Hoy: `404`.
- **SC-002**: **La latencia de una petición del SDK no empeora de forma apreciable.** Es el criterio central y el riesgo central: cada petición resuelve el merchant por su credencial antes de validar el cuerpo, así que el costo de esta feature se paga en **todas** las peticiones y no sólo en las frías. Se mide el p95 de la ingesta con el almacén durable contra el mismo con todo en memoria, en la misma corrida.
- **SC-003**: El historial de configuración de un merchant después de un reinicio es **idéntico** al de antes: mismas versiones, mismo orden, misma autoría.
- **SC-004**: Ninguna acción administrativa deja efecto sin constancia, verificado provocando la falla del registro en medio de la acción.
- **SC-005**: El arranque informa qué hizo con la semilla en las dos situaciones —la aplicó, o no la aplicó y por qué—, y eso se lee en el log sin mirar el código.
- **SC-006**: Ninguna operación de administración devuelve, alcanza ni permite escribir nada de otro merchant, cruzando un reinicio.
- **SC-007**: Ninguna prueba de comportamiento existente cambia de expectativa: lo que la API responde es lo mismo, y si hay que tocar una prueba de comportamiento, esta feature se metió donde no debía.

## Assumptions

- **Se implementa sobre el mismo almacén que las tres features anteriores** (D-21: PostgreSQL y sus pruebas de concurrencia, después). Un proceso.
- **El despliegue local sigue en memoria**, como decidió la investigación de la 030: las pruebas rápidas no pasan por un almacén para probar comportamiento que no depende del almacenamiento. Lo durable se prueba en la suite que cruza reinicios.
- **No hay nada que migrar.** Ningún merchant estuvo nunca persistido, así que la migración crea tablas y no reconstruye ninguna — a diferencia de las dos anteriores.
- **El canal de fallo de las escrituras ya existe**: las operaciones que crean, actualizan y publican ya responden «el almacén no está disponible». Lo que esta feature no hace es dárselo a las lecturas, que sigue siendo trabajo del hito.
- **La semilla elige el identificador del merchant y la API lo acuña.** Queda anotado como medido y **no se juzga**: si resulta ser un problema, es de otra feature y se registra como deuda.
- **Quién administra OPE no es dato de un merchant.** Los operadores llegan por configuración del despliegue, como los niveles de plataforma, y se quedan ahí.

## Lo que esta feature NO hace, con su motivo

| Qué                                                                                               | Por qué                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Los operadores de la plataforma durables**                                                      | llegan por archivo y no tienen almacén **a propósito**: son configuración del despliegue, no dato de un merchant, y nadie pidió cambiarlo                              |
| **Las cinco lecturas del portal** (`results`, `accumulation`, `decisions`, `exposures`, `orders`) | son la otra mitad de «ver la actividad de un merchant». El dato ya existe en el almacén desde la 030 y la 031; les falta superficie, y eso es el hito `itt-and-portal` |
| **PostgreSQL**                                                                                    | D-21                                                                                                                                                                   |
| **La atomicidad del presupuesto por sesión**                                                      | es lo único que le queda al hito después de esta feature                                                                                                               |
| **Cambiar la superficie de administración**                                                       | está completa y probada. Esta feature no agrega ni cambia ninguna operación                                                                                            |

## El riesgo central, dicho de frente

Las tres features anteriores pusieron I/O durable en caminos que se recorren **a veces**: la escritura del ledger una vez por decisión (ADR-038), la reconstrucción sólo cuando la memoria olvidó una sesión (ADR-040). Esta pone una lectura en el camino que se recorre **siempre**.

`IngestKeyResolver` resuelve el merchant por la huella de su credencial **antes de validar el cuerpo**, en cada petición del SDK y de la plataforma. Hoy eso es un recorrido en memoria. Cualquier forma durable lo convierte en una lectura del almacén en el borde de autenticación de todo request.

Eso es una excepción al principio IV más caliente que las dos anteriores, y se declara con el mismo trato: nombrada, medida contra la única base que hay, y con su costo real anotado como pregunta abierta hasta que exista el gateway remoto (**D-21**, **D-26**). **Cómo se resuelve —consultar cada vez, o que la memoria sea una caché de un almacén que es la fuente— es del plan**, no de esta spec: es una decisión de diseño con alternativas reales y el plan es donde se evalúan.

Lo que la spec sí fija es el criterio: **SC-002 es la condición de aceptación de la feature**, no una métrica informativa. Si la latencia de la ingesta empeora de forma apreciable, la feature no está terminada.
