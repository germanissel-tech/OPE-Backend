# Feature Specification: Lo que el SDK manda deja de ser invisible

**Feature Branch**: `031-registro-de-eventos`

**Created**: 2026-09-27

**Status**: Draft

**Input**: Feature siguiente al hito `persistence-and-resilience`. Sale de `main` limpio (`5c18e48`,
con la 030 mergeada y el CI de `main` verificado).

## Contexto: hoy el tráfico del SDK no queda en ningún lado

**Los eventos no se persisten.** No existe un puerto de almacenamiento de eventos: hay
deduplicación —una ventana en memoria, nivel 1 de la configuración— y el plano de decisión. Un lote
de hasta cincuenta eventos deja **una** fila en `decisions` y desaparece.

Lo que sobrevive de esos eventos es lo que la decisión recuerda: qué reglas dispararon
(`inference.matched`), la confianza por barrera y la evidencia consultada. Eso alcanza para explicar
**qué decidió** OPE. No alcanza para responder **con qué**.

Y hay un tramo del tráfico que hoy es completamente invisible: **un lote rechazado por invariante no
produce decisión y no deja rastro**. Si un merchant integra mal el SDK y manda instantes fuera de
tolerancia, OPE responde `422` y no queda nada; el operador ve silencio y no sabe distinguirlo de un
merchant sin tráfico.

**Por qué ahora.** La feature 030 volvió durable el ledger, y al cerrarla apareció un patrón: las
cuatro cosas que hubo que arreglar después de que la suite diera verde salieron de **usar** el
sistema —correr el quickstart, mirar el esquema, preguntar por la auditoría, leer el log de CI— y
ninguna de correr la cadena de gates sobre sí misma. Poder mirar lo que el sistema hace es lo que
esta feature entrega.

**Y hay algo que hoy no se puede hacer de ninguna manera.** El estado de sesión —las señales
acumuladas sobre las que el plano decide— **vive en memoria y se pierde en cada reinicio**: es la
feature siguiente del hito. La decisión guarda el resultado de la inferencia, no las señales que la
alimentaron, y esas señales estaban en un `Map` que ya no existe. Así que **después de un deploy no
hay forma de reconstruir con qué se decidió**. Con los eventos registrados sí la hay: de ellos se
reconstruye el estado acumulado en cualquier punto de la sesión. Eso vuelve a este registro la
única fuente capaz de explicar una decisión pasada, que es más de lo que «auditoría» sugiere.

**Y una decisión del dueño que define la forma** (2026-09-27): el registro va **fuera del camino
crítico**; los eventos se encolan y se escriben aparte. No es una concesión: es exactamente lo que
`01 §P9` quiso desde el principio —«Decisión: síncrono, acotado, sin I/O de red. Medición:
**asíncrono, durable**, auditable. No se mezclan, no comparten garantías y no comparten presupuesto
de latencia»—. Este registro es el primer componente del sistema que cae del lado de la medición.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Del click al veredicto, y al revés (Priority: P1)

Alguien discute una cifra: «esta sesión no debería haber recibido una intervención». Hoy se puede
leer la decisión y ver qué barrera se infirió y con qué confianza, pero no **qué mandó el SDK** para
que esa inferencia diera eso. La conversación termina en la palabra de OPE contra la del merchant.

Después de esta historia, de una decisión se llega a lo que se recibió, y de lo recibido a la
decisión que produjo, con el brazo con el que entró.

**Why this priority**: es la feature. Sin esto, lo demás son variantes de lo mismo.

**Independent Test**: ingestar un lote, esperar a que el registro se vacíe, y llegar desde la
decisión a los eventos que la precedieron y desde un evento a su decisión.

**Acceptance Scenarios**:

1. **Given** un lote aceptado, **When** el registro termina de escribir, **Then** lo recibido se
   lee con el mismo contenido: cada evento con su identificador, su tipo y su instante.
2. **Given** una decisión registrada, **When** se pregunta con qué llegó, **Then** se obtienen los
   eventos del lote que la produjo.
3. **Given** un evento registrado, **When** se pregunta qué produjo, **Then** se llega a su
   decisión, incluida la que resultó `NO_OP`.
4. **Given** un visitante asignado a un brazo, **When** se lee lo que mandó, **Then** consta si
   entró con `CONTROL` o con `TREATMENT`.
5. **Given** dos merchants con tráfico, **When** cualquiera de los dos se lee, **Then** no ve nada
   del otro.

---

### User Story 2 - Lo que se descartó también deja rastro (Priority: P2)

Un merchant dice que manda eventos y el tablero no los muestra. Hoy no hay forma de distinguir «no
mandó nada» de «mandó y se descartó», y el segundo caso es el que tiene arreglo.

Después de esta historia, lo descartado queda con su motivo: el duplicado que la ventana ya conocía
y el lote que una invariante rechazó.

**Why this priority**: es la mitad que convierte el registro en forense. Un registro que sólo guarda
lo aceptado muestra el tráfico que OPE entendió, no el que llegó — y una integración rota vive
exactamente en la diferencia.

**Independent Test**: mandar un lote con un evento repetido y otro con un instante fuera de
tolerancia, y encontrar los dos con su motivo.

**Acceptance Scenarios**:

1. **Given** un evento ya visto dentro de la ventana, **When** llega otra vez, **Then** queda
   registrado como repetición y no como un evento nuevo.
2. **Given** un lote con un instante fuera de la tolerancia declarada, **When** se rechaza con `422`,
   **Then** queda registrado qué llegó y qué invariante lo rechazó.
3. **Given** un lote que mezcla sesiones o visitantes, **When** se rechaza, **Then** queda
   registrado con ese motivo.
4. **Given** un lote rechazado, **When** se lo busca, **Then** consta que **no produjo decisión** —
   porque no la produjo, y eso es lo que hay que poder ver.

---

### User Story 3 - Cuánto trabajo está haciendo esto (Priority: P3)

Antes de un piloto con tráfico real hay que saber qué vuelve a caer encima: cuántos eventos por
merchant, de qué tipos, repartidos cómo en el tiempo. Hoy esa pregunta se responde mirando el log
operativo, que no está hecho para contar.

**Why this priority**: es dimensionamiento, no corrección. Hace falta antes del piloto, no antes de
la primera lectura forense.

**Independent Test**: ingestar tráfico de dos merchants y obtener, por cada uno, cuántos eventos
entraron, de qué tipos y en qué ventana de tiempo.

**Acceptance Scenarios**:

1. **Given** tráfico de varios merchants, **When** se cuenta por merchant, **Then** los conteos son
   separados y ninguno incluye al otro.
2. **Given** tráfico de varios tipos de evento, **When** se cuenta por tipo, **Then** la
   distribución es legible sin abrir cada registro.

---

### Edge Cases

- **El registro se atrasa** → el camino de decisión **no espera**. Un registro atrasado no degrada
  ninguna decisión ni cambia ninguna respuesta: ésa es la diferencia entre este camino y el del
  ledger.
- **El registro no puede escribir** → la decisión se toma igual y se responde igual. Qué se hace con
  lo que no se pudo escribir es la pregunta abierta **Q3**.
- **El proceso se apaga con cosas encoladas** → mismo caso que el anterior, y misma pregunta.
- **Un lote llega cuando el merchant está apagado** (`merchant-off`) → llegó, así que se registra;
  la decisión existe y es `NO_OP` con su motivo.
- **Un lote llega sin experimento activo** → se registra sin brazo, porque no hay ninguno; no se
  inventa `CONTROL`.
- **El almacén crece** → es la pregunta abierta **Q2**. Hoy el ledger no poda por diseño, y ese
  diseño se pensó para decisiones, no para todo el tráfico.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Todo evento que el sistema acepta DEBE quedar registrado de forma durable, con su
  identificador, su tipo y el instante que declara.
- **FR-002**: El registro DEBE guardar además **cuándo OPE lo recibió**, distinto del instante que
  declara el cliente.
- **FR-003**: Desde una decisión DEBE poder llegarse a los eventos del lote que la produjo, y desde
  un evento a su decisión.
- **FR-004**: El registro DEBE constar con qué brazo entró el tráfico, o que no había experimento
  activo.
- **FR-005**: Un evento descartado por deduplicación DEBE quedar registrado como repetición, con la
  referencia a lo que ya se conocía.
- **FR-006**: Un lote rechazado por una invariante DEBE quedar registrado con qué llegó, qué
  invariante lo rechazó, y que no produjo decisión.
- **FR-007**: El registro NO DEBE agregar espera, I/O de red ni escritura bloqueante al camino
  crítico de decisión. Una decisión NO DEBE degradarse porque el registro esté atrasado o caído.
- **FR-008**: El aislamiento entre merchants DEBE valer también acá: ninguna lectura del registro de
  un merchant devuelve nada de otro.
- **FR-009**: Lo registrado DEBE sobrevivir a un reinicio, con el mismo contenido.
- **FR-010**: El registro NO DEBE guardar ningún dato personal: se registra el evento tal como el
  contrato ya lo admite, y no gana campos por registrarse.
- **FR-011**: El comportamiento observable de la decisión NO DEBE cambiar: para la misma secuencia
  de eventos, la decisión, la exposición y la atribución DEBEN ser las mismas que hoy.
- **FR-012**: DEBE poder contarse, por merchant, cuántos eventos entraron, de qué tipos y en qué
  ventana de tiempo, sin leer cada registro.
- **FR-013**: DEBEN poder obtenerse los eventos de una **sesión**, en orden, para reconstruir con qué
  se decidió — que es la pregunta que el lote solo no responde, porque la decisión es de la sesión.
- **FR-014**: Toda tabla que esta feature cree o modifique DEBE tener **clave primaria
  autoincremental propia**; lo que hoy es clave de negocio pasa a ser **índice UNIQUE** (regla de
  arquitectura del dueño, 2026-09-27).
- **FR-015**: Toda tabla que esta feature cree o modifique DEBE tener **`created_at` y `updated_at`**,
  iguales al crear la fila (misma regla). En este registro los dos son además información: como la
  escritura va encolada, `created_at` **no** es `received_at`, y su diferencia mide el atraso de la
  cola.
- **FR-016**: Las **siete tablas de la feature 030** DEBEN migrarse a esas dos reglas en una
  migración versionada, para que el esquema no conviva con dos criterios.
- **FR-017**: El apagado ordenado DEBE esperar a que la cola de escritura se vacíe.
- **FR-018**: Si el proceso termina sin apagado ordenado, el sistema DEBE registrar **cuántos eventos
  se perdieron**: el registro no promete completitud, promete saber dónde no la tiene.

### Key Entities

- **Evento recibido**: lo que el SDK mandó, tal como llegó, con el instante en que se recibió.
- **Lote**: la unidad en que el SDK manda y en que el sistema decide. Es lo que une los eventos con
  su decisión, porque la decisión se toma por lote y no por evento.
- **Descarte**: un evento o un lote que no entró, con su motivo — repetición, o la invariante que lo
  rechazó.
- **Registro**: dónde vive lo anterior. Se escribe fuera del camino de decisión.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: De cualquier decisión registrada puede obtenerse lo que el SDK mandó para producirla,
  sin leer el código y sin reconstruir nada de varias fuentes.
- **SC-002**: De cualquier evento registrado puede obtenerse la decisión que produjo y el brazo con
  el que entró.
- **SC-003**: Un lote rechazado y un merchant sin tráfico **se distinguen**, que hoy es imposible.
- **SC-004**: El p95 del camino de ingesta **no empeora de forma apreciable** respecto de la medición
  de la feature 030 (memoria 0,90–1,35 ms; SQLite 1,94–2,72 ms, sobre un presupuesto de 150 ms de
  `01 §4.6`). Es el criterio que verifica FR-007.
- **SC-005**: Ninguna de las pruebas de comportamiento que ya existen cambia de expectativa.
- **SC-006**: Reiniciar el servicio no pierde nada de lo que ya se había registrado.
- **SC-007**: El volumen por merchant y por tipo se obtiene en una sola consulta.
- **SC-008**: De una decisión pasada puede reconstruirse con qué señales se tomó, **incluso después
  de un reinicio** — que hoy es imposible.
- **SC-009**: Ninguna tabla del esquema queda fuera de las dos reglas de arquitectura.
- **SC-010**: Un hueco en el registro por una caída abrupta **se puede nombrar**: cuántos eventos y
  en qué intervalo.

## Assumptions

- **El registro se alimenta de lo que el sistema ya recibe**; el SDK no cambia y el contrato de
  ingesta no gana campos.
- **Un lote produce a lo sumo una decisión**, que es como funciona hoy.
- **La cardinalidad es doble y hay que decir las dos.** Cada lote **dispara** exactamente una
  decisión; cada decisión se toma **sobre la sesión acumulada**, es decir sobre ese lote y todos los
  anteriores (`SessionState`: «what the plane remembers of a session **between batches**», `01 §4.2`,
  ADR-026). Mostrar el lote y decir «esto produjo la decisión» sería falso: lo cierto es «esta
  decisión se disparó con este lote, y se tomó con todo lo que la sesión venía acumulando».
- **El brazo se conoce en el momento de decidir** y no cambia para ese visitante mientras el
  experimento siga abierto (ADR-022).
- **Los eventos no llevan datos personales**, y por eso registrarlos no cambia el perfil de
  privacidad: son identificadores propios sin significado fuera de OPE y secuencias de clicks
  (`01 §665`).
- **Un solo proceso** escribe el registro, como el resto del almacén (**D-21**).

## Q1 — resuelta: una fila por evento (2026-09-27)

**Decisión del dueño**: el registro es **una tabla de eventos**, y cada evento lleva su sesión, su
lote, su decisión y su brazo.

Se compararon tres formas **midiéndolas con el motor real**, con las dos reglas de arquitectura ya
aplicadas y el archivo compactado:

| Forma            | Tamaño (piloto completo) | Contar por tipo | Buscar un evento |
| ---------------- | ------------------------ | --------------- | ---------------- |
| Sólo lotes       | 512 MB                   | 335 ms          | 135 ms           |
| **Sólo eventos** | **749 MB**               | **7 ms**        | **0,1 ms**       |
| Lote + evento    | 551 MB                   | 7 ms            | 8 ms             |

**El almacenamiento no es criterio** (decisión del dueño, 2026-09-27): importa la performance. Eso
descarta «sólo lotes», que era la más barata y la única lenta para dos de las cuatro preguntas.

Entre las otras dos la velocidad empata, así que la decisión fue de modelado, y la resolvió una
observación del dueño que corrigió el argumento con que se defendía «lote + evento»: **una decisión
no se toma sobre un lote sino sobre la sesión acumulada** (ver la suposición sobre la cardinalidad).
El lote es lo que **dispara** una decisión, no aquello sobre lo que se decide. Reducido a
disparador, no necesita tabla propia: el único caso que la justificaba era el lote rechazado, que
queda como su motivo repetido en cada evento — repetición que no cuesta, porque el almacenamiento
no es criterio.

**Lo medido, para que el plan no lo re-deduzca:**

- **Un índice equivocado es peor que ninguno.** La consulta de US3 sobre 2 M eventos cuesta 507 ms
  sin índice útil, **1 703 ms** con `(merchant_id, type)` y **107 ms** con el índice de cobertura
  `(merchant_id, created_at, type)`. El plan se verifica, no se supone.
- Los dos timestamps de la regla 2 ocupan ~50 bytes, pero en una tabla de **filas grandes** empujan
  sobre el umbral de paginación de SQLite y llegan a costar **684 bytes por fila**. Con filas
  chicas —el caso de esta decisión— el efecto no aparece.
- La PK autoincremental de la regla 1 **no cuesta nada** en SQLite: `INTEGER PRIMARY KEY` es el
  `rowid` que ya existía. Y **salda una de las tres deudas de D-21**: el `rowid` implícito que hoy
  da el orden de inserción no existe en PostgreSQL; una columna autoincremental sí.

## Q2 — resuelta: no se borra nada (2026-09-27)

**Decisión del dueño**: el histórico se conserva completo, para análisis futuros. Lo que hace falta
no es podar sino **tener a mano la ventana vigente**, y eso resultó ser otra cosa.

Lo medido que sostiene la decisión: **guardar todo no encarece leer lo reciente**. Con 10 millones
de eventos guardados, traer los de una sesión cuesta **0,2 ms** y los de una decisión **0,2 ms**;
no se degradan con el volumen porque el índice hace el trabajo. La única consulta que sí se degrada
es el **conteo agregado** —447 ms con 1 millón, 4,7 s con 10— y ésa no se arregla borrando: se
arregla con totales mantenidos aparte, que queda anotado abajo.

`01 §10.6` decía «ventana acotada; después queda el estado derivado» y marcaba los plazos como
PROPUESTO, a resolver con **D5** (régimen de datos personales). Esta decisión no la contradice: lo
que se acota es **la ventana caliente**, no el histórico. Si D5 termina exigiendo borrar, se borra
por obligación legal y no por diseño.

## La arquitectura que salió de tensionar el patrón

Lo que parecía una cosa son **dos puertos con garantías distintas**, y separarlos disuelve la
tensión entre «escribir sin frenar» y «leer al día»:

|               | **Registro durable**               | **Ventana caliente**                       |
| ------------- | ---------------------------------- | ------------------------------------------ |
| Qué guarda    | todo, para siempre                 | sólo las sesiones con actividad            |
| Quién lo lee  | quien investiga o analiza          | el plano de decisión                       |
| Garantía      | nada se pierde                     | puede perderse; **no es fuente de verdad** |
| Escritura     | fuera del camino crítico, encolada | inmediata, en memoria                      |
| En producción | PostgreSQL                         | Redis o memoria del proceso                |

Eso es lo que la constitución ya fija: «Redis es estado caliente de sesión, acotado y con
expiración; MUST NOT ser fuente de verdad durable. PostgreSQL es la fuente durable». Y el plano de
decisión sigue **sin I/O de red saliente**, porque lee lo caliente y no el durable.

**Una advertencia sobre medir esto**: los números de arriba son de SQLite local. En producción la
ventana vive detrás de red y el orden de magnitud es otro; esa medición se hace contra el motor
real y hoy no lo tenemos (**D-21**).

## Lo que esta feature habilita, y entrega otra

Al tensionar el diseño apareció que un reinicio pierde **tres cosas con ventanas muy distintas**, y
que la peor no estaba en ninguna deuda: la **fatiga por visitante** vive en memoria con una ventana
de 24 horas, y cada despliegue la borra entera — un visitante que ya agotó su cupo diario vuelve a
estar disponible para todo el cupo, hoy, sin que nada lo mida.

Reconstruir eso necesita dos fuentes: **los eventos** para las señales, y el **ledger de decisiones**
para las intervenciones. Esta feature entrega la primera.

**El resto —la ventana caliente con expiración, la rehidratación y la duración de sesión— es la
feature 032**, que decidimos separar el 2026-09-27 para que cada cadena de gates pueda decir qué
rompió qué. Las decisiones ya tomadas viven en su spec, no se rediscuten.

## Q3 — resuelta: la cola se drena, y el hueco se declara (2026-09-27)

**Decisión del dueño**: al apagar, el apagado ordenado **espera a que la cola se vacíe** —el grafo ya
cierra en orden inverso lo que creó, así que encaja sin inventar nada— y cubre el caso frecuente, que
es el despliegue.

Si el proceso muere **sin apagado ordenado** —sin memoria, terminado por el sistema, corte de
energía— lo encolado se pierde, y entonces **el hueco queda declarado**: se cuenta lo recibido contra
lo escrito y la diferencia se registra al volver.

El registro **no promete completitud; promete saber dónde no la tiene**. Es la diferencia entre un
registro en el que se puede confiar para investigar y uno que se lee como completo siendo parcial.

## Lo que sigue abierto

### La ventana caliente, ¿es parámetro por merchant?

Quedó sin decidir: la conversación derivó a la duración de sesión, que la condicionaba. Hoy
`sessionWindowMs` es de plataforma porque la memoria del proceso es **un único límite compartido**
entre identificadores de evento, sesiones y visitantes (`identityCap`, 100 000): un valor por
merchant sobre un recurso compartido permite que uno consuma lo de los demás, y el que se queda
afuera **no se entera**.

El código ya anticipó la salida: «el día que el estado caliente salga del proceso, separarlos es un
campo nuevo de este nivel, no un cambio de forma».

### El conteo agregado, cuando duela

Medido: 447 ms con 1 millón de eventos, 4,7 s con 10 millones. Las consultas forenses no se degradan;
ésta sí. Cuando pase de segundos, la respuesta son **totales mantenidos aparte** — y entonces hay que
decidir la ventana de agregación, que es una política y no vive en el código (constitución XI). No se
hace antes de que el número lo pida.

## Lo que esta feature NO hace, y por qué

- **No desacopla la aceptación del ledger de decisiones** (ADR-038). Ése sigue síncrono porque nada
  entra al reporte sin trazabilidad (constitución IX), y su disparador es un número que hoy no se
  alcanzó. Son dos caminos distintos y éste no toca el otro.
- **No hace durable el estado de sesión y visitante**, ni el commit conjunto de la entrada de
  administración, ni la configuración publicada: son las tres features que le quedan al hito.
- **No analiza nada.** Deja el dato; el ITT, el portal y los reportes son otra cosa.
- **No juzga lo que midió sobre los duplicados.** `claim()` marca cuáles entraron por primera vez y
  eso decide el conteo de la respuesta, pero el plano de decisión recibe el **lote completo**, así
  que un evento duplicado sí influye en la decisión. Queda anotado como medido. Si resulta ser un
  defecto, es de otra feature y se registra como deuda — esta feature lo hace **visible**, que es
  justamente lo que justifica que exista.
- **No cambia el SDK ni el contrato de ingesta.**
- **La ventana caliente, su expiración y la rehidratación**: es la **feature 032**, que consume lo
  que ésta entrega.
- **La duración de una sesión** y lo que el SDK recibe de ella: va con la 032, que es donde el TTL de
  la ventana vive.
- **PostgreSQL** (**D-21**), aunque la clave autoincremental de FR-014 salda una de sus tres deudas.
