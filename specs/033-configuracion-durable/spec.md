# Feature Specification: Nada de lo que se configuró u observó se pierde en un reinicio

**Feature Branch**: `033-configuracion-durable`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Prueba de la API de administración contra el servidor real (2026-09-28), decisión del dueño sobre el alcance (2026-09-29), y la tercera feature del hito `persistence-and-resilience`.

## Cómo apareció, y por qué el alcance es más grande que lo que apareció

Probando la API de administración contra el servidor real: alta de un merchant por `POST /v1/admin/merchants`, un experimento, su configuración publicada. Reinicio. `404 merchant-not-found`.

La superficie de administración está completa y probada —21 operaciones, todas `built`— y lo que falta no es una operación: es que lo que esas operaciones escriben dure. Hoy la fuente de verdad de los merchants es `config/*-merchants.json`, así que **cualquier panel de administración es una consola sobre un estado que se pierde en cada deploy**.

**El principio del dueño (2026-09-29) es el que fija el alcance, y es más ancho que el hallazgo**: todo lo que se configuró u observó tiene que aguantar un reinicio. La primera versión de esta spec cubría cuatro almacenes y trataba el resto como hallazgos laterales; auditar los diecisiete puertos de almacenamiento uno por uno mostró que **quedaban tres afuera que son de la misma clase**, y dos de ellos los lee el propio panel.

## El inventario completo, que es lo que vuelve verificable la afirmación

Diecisiete puertos guardan algo. Ninguno queda sin clasificar, porque «todo persiste» sólo significa algo si la lista está entera.

| Ya durable (030, 031)  | Esta feature                                    | Recuperable, no durable      | Configuración del despliegue |
| ---------------------- | ----------------------------------------------- | ---------------------------- | ---------------------------- |
| decisiones             | **merchants** (orígenes, huellas de credencial) | estado de sesión             | textos curados del release   |
| exposiciones           | **configuración y todas sus versiones**         | estado de visitante          |                              |
| órdenes                | **experimentos** y su ciclo de vida             | **ventana de deduplicación** |                              |
| corroboraciones        | **registro de administración**                  |                              |                              |
| asignaciones           | **diagnóstico de anclajes**                     |                              |                              |
| catálogo y sus recibos | **valores de atributo sin mapear**              |                              |                              |
| registro de eventos    |                                                 |                              |                              |

**«Recuperable» no es una excepción al principio: es la otra forma de cumplirlo**, y la feature 032 ya la estableció (ADR-040). Un estado que la memoria olvidó se reconstruye de lo durable en cuanto alguien lo necesita, así que **en lo observable el reinicio no pierde nada** — y la memoria sigue sin ser fuente de verdad (constitución IV). Se elige para lo que se consulta demasiado seguido como para ir al almacén cada vez.

**Los textos curados sí quedan afuera, y es la única cosa que queda afuera**: llegan del archivo del release como los niveles de plataforma, y son configuración del despliegue y no dato de un merchant. Un reinicio los vuelve a leer del archivo, así que tampoco se pierden — simplemente no son de nadie.

### Las tres que la primera versión había dejado afuera

- **Diagnóstico de anclajes** y **valores de atributo sin mapear**: los dos los expone la API de administración (`GET .../anchor-diagnostics`, `GET .../unmapped-attribute-values`) y los dos son **observaciones sobre el tráfico de un merchant** — qué anclaje no se pudo resolver, qué etiqueta de atributo llegó sin correspondencia. Es exactamente lo que un panel muestra para que alguien arregle una integración, y hoy un deploy lo borra. Dejarlos afuera era un descuido: el relevamiento del panel los listó como operaciones disponibles sin mirar si lo que devuelven dura.
- **La ventana de deduplicación**: entra como **recuperable**, por decisión del dueño. El detalle de por qué, más abajo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un merchant dado de alta sigue existiendo (Priority: P1)

Una persona de operaciones da de alta un merchant por la API: recibe su identificador acuñado y sus tres credenciales. El merchant queda sirviendo tráfico. Días después hay un despliegue, y el merchant sigue ahí — con sus mismos orígenes, sus mismas credenciales y su mismo estado.

**Why this priority**: es el mínimo entregable y lo que hace utilizable cualquier panel. Sin esto, dar de alta un merchant por la API es una operación que se deshace sola, y la única forma real de operar la plataforma sigue siendo editar un archivo y reiniciar.

**Independent Test**: dar de alta un merchant, reiniciar, y verificar que responde a una petición hecha con la credencial que se emitió antes del reinicio.

**Acceptance Scenarios**:

1. **Given** un merchant dado de alta por la API, **When** el servidor se reinicia, **Then** el merchant existe con su identificador, sus orígenes y su estado, y su credencial de ingesta sigue autenticando.
2. **Given** un merchant al que se le rotó la credencial con gracia para la anterior, **When** el servidor se reinicia dentro de la gracia, **Then** las dos credenciales siguen autenticando, y al vencer la gracia sólo la nueva.
3. **Given** un merchant desactivado, **When** el servidor se reinicia, **Then** sigue desactivado y sus orígenes siguen reservados — no se los puede dar a otro.
4. **Given** un merchant con el interruptor apagado, **When** el servidor se reinicia, **Then** sigue apagado: nada se asigna y nada se consume.

---

### User Story 2 - La configuración, el historial y los experimentos sobreviven (Priority: P2)

Una persona de operaciones publica la configuración de un merchant y abre su experimento. Semanas después necesita ver qué estaba publicado cuando se tomó una decisión. El historial completo está ahí, con quién lo publicó, cuándo y con qué motivo; y el experimento sigue siendo el mismo experimento.

**Why this priority**: es lo que convierte la configuración en algo auditable en vez de algo vigente. Una decisión registra con qué versión de configuración se tomó (constitución IX), y esa referencia no sirve si la versión no existe después de un deploy.

**Y arregla una incoherencia que hoy está en el almacén.** Las asignaciones son durables desde la 030 y la definición del experimento no, así que tras un reinicio quedan asignaciones apuntando a un experimento que ya no existe. En los merchants de la semilla no se nota, porque el archivo vuelve a traer los mismos identificadores — por eso nunca se vio. En uno creado por la API, el identificador acuñado se perdió y las asignaciones quedaron huérfanas.

**Independent Test**: publicar dos versiones y abrir un experimento con asignaciones, reiniciar, y verificar que las dos versiones están con su orden y su autoría, que la efectiva es la última, y que un visitante ya asignado vuelve al mismo brazo del mismo experimento.

**Acceptance Scenarios**:

1. **Given** dos versiones de configuración publicadas, **When** el servidor se reinicia, **Then** las dos están, en su orden, con su operador, su instante y su motivo, y la efectiva sigue siendo la última.
2. **Given** un experimento abierto y calibrando, **When** el servidor se reinicia, **Then** sigue calibrando, con su reparto, su semilla, su muestra objetivo y sus reinicios de ventana.
3. **Given** un experimento con asignaciones registradas, **When** el servidor se reinicia, **Then** ninguna asignación queda huérfana: el experimento que nombran existe, y un visitante ya asignado vuelve al mismo brazo.

---

### User Story 3 - Lo que se observó del tráfico de un merchant sigue ahí (Priority: P3)

Una persona de operaciones abre el panel de un merchant para arreglar su integración: qué anclajes no se pudieron resolver y en qué superficies, qué etiquetas de atributo llegaron sin correspondencia. Eso es trabajo que se acumula durante días y se revisa una vez por semana; un deploy en el medio no lo borra.

Y del otro lado de la misma idea: un reintento del SDK sigue siendo un duplicado después del reinicio, en vez de volver a contar como un evento nuevo.

**Why this priority**: es la mitad de «ver la actividad de un merchant» que ya tiene API. Sin esto, el panel muestra una lista que se vacía en cada deploy y nadie puede confiar en que está vacía porque la integración está bien.

**Independent Test**: reportar diagnósticos de anclaje y publicar un catálogo con una etiqueta sin mapear, reiniciar, y verificar que las dos listas siguen ahí con sus conteos; y reenviar un evento ya enviado antes del reinicio y verificar que cuenta como duplicado.

**Acceptance Scenarios**:

1. **Given** diagnósticos de anclaje reportados por el SDK, **When** el servidor se reinicia, **Then** siguen ahí con su anclaje, su superficie y su conteo, y un reporte nuevo del mismo anclaje sigue acumulando sobre el conteo anterior.
2. **Given** valores de atributo sin correspondencia observados en un catálogo, **When** el servidor se reinicia, **Then** siguen ahí, y el tope por merchant se sigue aplicando sobre lo que ya había.
3. **Given** un evento que el SDK envió antes del reinicio, **When** lo reenvía después, **Then** cuenta como **duplicado** y no como nuevo, y no entra dos veces en las señales de la sesión.
4. **Given** un merchant que nunca mandó tráfico después del reinicio, **When** manda su primer lote, **Then** la respuesta no tarda de forma apreciablemente distinta a la de un lote posterior.

---

### User Story 4 - Una acción administrativa que no se pudo auditar no ocurrió (Priority: P4)

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
- **Un merchant cuya ventana de deduplicación excede el tope mientras se reconstruye** → se reconstruye hasta el tope, con los más recientes, que es lo que la ventana promete también sin reinicio.
- **El registro de eventos incompleto cuando se reconstruye la ventana** → la reconstrucción vale lo que vale el registro. Si al registro le falta un tramo (feature 031, FR-018), un evento de ese tramo puede volver a contar como nuevo, y es la misma asimetría que ADR-040 ya declaró: lo que protege un tope es exacto, lo que mejora una medición es best-effort.
- **Dos procesos sobre el mismo almacén** → fuera de alcance por D-21, igual que en las tres features anteriores. Con un proceso, dos altas del mismo origen se rechazan; con dos, esta feature no lo promete.
- **El primer arranque de un almacén existente que nunca tuvo estas tablas** → las crea vacías y la semilla se aplica, porque un almacén sin merchants está vacío para lo que esta feature mira.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El merchant DEBE sobrevivir un reinicio con su identificador, su estado, sus orígenes y las huellas de sus tres credenciales.
- **FR-002**: La expiración de una credencial rotada DEBE sobrevivir como **instante**, de modo que una gracia vencida durante el apagado no autentique al volver.
- **FR-003**: La reserva de un origen DEBE sobrevivir, y DEBE seguir alcanzando a los merchants desactivados: un origen pertenece a un solo merchant y eso no se reinicia.
- **FR-004**: La configuración publicada de un merchant y **todas** sus versiones DEBEN sobrevivir, con su orden, su operador, su instante y su motivo.
- **FR-005**: La definición de un experimento y su ciclo de vida DEBEN sobrevivir, de modo que ninguna asignación durable quede apuntando a un experimento que no existe.
- **FR-006**: El diagnóstico de anclajes DEBE sobrevivir con su conteo acumulado, y un reporte posterior al reinicio DEBE acumular sobre lo que ya había.
- **FR-007**: Los valores de atributo sin correspondencia DEBEN sobrevivir, y su tope por merchant DEBE aplicarse sobre lo conservado.
- **FR-008**: El registro de administración DEBE sobrevivir, y sus lecturas —global y por merchant— DEBEN seguir respondiendo lo mismo después de un reinicio.
- **FR-009**: El registro de administración NO DEBE podarse. La retención queda declarada como permanente, igual que el resto del ledger.
- **FR-010**: Una acción administrativa y su entrada en el registro DEBEN quedar **las dos o ninguna**.
- **FR-011**: Un evento ya recibido antes de un reinicio DEBE contar como duplicado cuando se lo reenvía después, dentro de la ventana que la plataforma declara.
- **FR-012**: La comprobación de duplicado NO DEBE consultar el almacén por evento. La ventana se reconstruye de lo durable **cuando un merchant vuelve a aparecer**, y desde ahí se responde en memoria.
- **FR-013**: La semilla DEBE aplicarse **sólo** si el almacén no tiene merchants, y el arranque DEBE decir qué hizo: cuántos importó, o que no la aplicó y por qué.
- **FR-014**: Toda lectura y escritura DEBE estar aislada por merchant: nada de un merchant es visible ni alcanzable desde otro.
- **FR-015**: El comportamiento observable de la API de administración NO DEBE cambiar. Las 21 operaciones responden lo mismo; lo que cambia es cuánto dura.
- **FR-016**: La resolución del merchant por su credencial DEBE seguir ocurriendo antes de validar el cuerpo de la petición, y NO DEBE empeorar de forma apreciable la latencia de una petición del SDK.

### Key Entities

- **Merchant**: quién es un cliente de OPE para el sistema — su identificador, su estado, sus orígenes registrados y las huellas de sus credenciales con la expiración de la anterior. No lleva ningún dato personal.
- **Versión de configuración**: qué declaró un merchant, en qué momento, publicado por quién y con qué motivo. Es un historial, no un valor: la efectiva es la última.
- **Experimento**: el reparto, la semilla, la muestra objetivo, los cortes y el estado del ciclo de vida, con los reinicios de su ventana.
- **Diagnóstico de anclaje**: qué anclaje no se pudo resolver, en qué superficie, cuántas veces. Es una observación acumulada, no un evento.
- **Valor de atributo sin correspondencia**: una etiqueta que llegó en un catálogo y que el mapa del merchant no traduce, con cuándo se la vio.
- **Entrada de administración**: qué operación hizo qué operador, sobre qué merchant si aplica, con qué resultado y con qué motivo.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un merchant dado de alta por la API sirve tráfico después de un reinicio, con la credencial emitida antes de ese reinicio. Hoy: `404`.
- **SC-002**: **La latencia de una petición del SDK no empeora de forma apreciable.** Es el criterio central y el riesgo central: cada petición resuelve el merchant por su credencial antes de validar el cuerpo, así que el costo se paga en **todas** las peticiones y no sólo en las frías. Se mide el p95 de la ingesta con el almacén durable contra el mismo con todo en memoria, en la misma corrida.
- **SC-003**: El historial de configuración de un merchant después de un reinicio es **idéntico** al de antes: mismas versiones, mismo orden, misma autoría.
- **SC-004**: Ninguna asignación registrada queda apuntando a un experimento inexistente después de un reinicio.
- **SC-005**: Las dos listas que el panel muestra de un merchant —anclajes sin resolver y atributos sin mapear— sobreviven un reinicio con sus conteos.
- **SC-006**: Un evento reenviado después de un reinicio cuenta como duplicado, y la reconstrucción de la ventana **no** aparece en la latencia por evento: el primer lote de un merchant tras el reinicio no tarda apreciablemente más que el siguiente.
- **SC-007**: Ninguna acción administrativa deja efecto sin constancia, verificado provocando la falla del registro en medio de la acción.
- **SC-008**: El arranque informa qué hizo con la semilla en las dos situaciones —la aplicó, o no la aplicó y por qué—, y eso se lee en el log sin mirar el código.
- **SC-009**: Ninguna operación de administración devuelve, alcanza ni permite escribir nada de otro merchant, cruzando un reinicio.
- **SC-010**: Ninguna prueba de comportamiento existente cambia de expectativa: lo que la API responde es lo mismo, y si hay que tocar una prueba de comportamiento, esta feature se metió donde no debía.
- **SC-011**: **El inventario de arriba queda completo y verificado**: todo puerto de almacenamiento está en una de las cuatro columnas, y ninguno pierde algo observable en un reinicio salvo lo que la columna de configuración del despliegue explica.

## Assumptions

- **Se implementa sobre el mismo almacén que las tres features anteriores** (D-21: PostgreSQL y sus pruebas de concurrencia, después). Un proceso.
- **El despliegue local sigue en memoria**, como decidió la investigación de la 030: las pruebas rápidas no pasan por un almacén para probar comportamiento que no depende del almacenamiento. Lo durable se prueba en la suite que cruza reinicios.
- **No hay nada que migrar.** Ninguno de estos seis almacenes estuvo nunca persistido, así que la migración crea tablas y no reconstruye ninguna — a diferencia de las dos anteriores.
- **El canal de fallo de las escrituras ya existe** en los puertos que lo necesitan: crear, actualizar y publicar ya responden «el almacén no está disponible». Lo que esta feature no hace es dárselo a las lecturas, que sigue siendo trabajo del hito.
- **La semilla elige el identificador del merchant y la API lo acuña.** Queda anotado como medido y **no se juzga**: si resulta ser un problema, es de otra feature y se registra como deuda.
- **Quién administra OPE no es dato de un merchant.** Los operadores llegan por configuración del despliegue, como los niveles de plataforma, y se quedan ahí.

## Lo que esta feature NO hace, con su motivo

| Qué                                                                                               | Por qué                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Los operadores de la plataforma durables**                                                      | llegan por archivo y no tienen almacén **a propósito**: son configuración del despliegue, no dato de un merchant, y nadie pidió cambiarlo                              |
| **Hacer durable el estado de sesión y de visitante**                                              | la 032 los hizo **recuperables**, que cumple el principio en lo observable sin volver la memoria una segunda verdad (ADR-040)                                          |
| **Las cinco lecturas del portal** (`results`, `accumulation`, `decisions`, `exposures`, `orders`) | son la otra mitad de «ver la actividad de un merchant». El dato ya existe en el almacén desde la 030 y la 031; les falta superficie, y eso es el hito `itt-and-portal` |
| **PostgreSQL**                                                                                    | D-21                                                                                                                                                                   |
| **La atomicidad del presupuesto por sesión**                                                      | es lo único que le queda al hito después de esta feature                                                                                                               |
| **Cambiar la superficie de administración**                                                       | está completa y probada. Esta feature no agrega ni cambia ninguna operación                                                                                            |

## El riesgo central, dicho de frente

Las tres features anteriores pusieron I/O durable en caminos que se recorren **a veces**: la escritura del ledger una vez por decisión (ADR-038), la reconstrucción sólo cuando la memoria olvidó una sesión (ADR-040). Esta pone una lectura en el camino que se recorre **siempre**.

La resolución del merchant por la huella de su credencial ocurre **antes de validar el cuerpo**, en cada petición del SDK y de la plataforma. Hoy es un recorrido en memoria. Cualquier forma durable lo convierte en una lectura del almacén en el borde de autenticación de todo request.

Eso es una excepción al principio IV más caliente que las dos anteriores, y se declara con el mismo trato: nombrada, medida contra la única base que hay, y con su costo real anotado como pregunta abierta hasta que exista el gateway remoto (**D-21**, **D-26**). **Cómo se resuelve —consultar cada vez, o que la memoria sea una caché de un almacén que es la fuente— es del plan**, no de esta spec: es una decisión de diseño con alternativas reales y el plan es donde se evalúan.

Lo que la spec sí fija es el criterio: **SC-002 es la condición de aceptación de la feature**, no una métrica informativa. Si la latencia de la ingesta empeora de forma apreciable, la feature no está terminada.

**Y la deduplicación es el mismo problema una escala más arriba**, que es lo que hizo que el dueño la resolviera distinto: se consulta **por evento**, no por petición, y su ventana son hasta cien mil identificadores por merchant. Ir al almacén por evento no es una versión más cara de lo mismo: es otra cosa. Por eso entra como **recuperable** y no como durable — la comprobación se sigue respondiendo en memoria, y lo que cambia es que la ventana se reconstruye de lo durable la primera vez que un merchant aparece tras un reinicio. Es el patrón de la 032 aplicado donde vuelve a servir, y **SC-006 lo vigila por los dos lados**: que el duplicado se detecte, y que reconstruir no se pague por evento.
