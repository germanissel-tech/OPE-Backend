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

## Assumptions

- **El registro se alimenta de lo que el sistema ya recibe**; el SDK no cambia y el contrato de
  ingesta no gana campos.
- **Un lote produce a lo sumo una decisión**, que es como funciona hoy.
- **El vínculo es lote → decisión.** La decisión no se toma sobre el lote sino sobre el estado de
  sesión acumulado, así que decir «estos eventos causaron esta decisión» sería falso; lo cierto es
  «esta decisión se tomó cuando llegó este lote».
- **El brazo se conoce en el momento de decidir** y no cambia para ese visitante mientras el
  experimento siga abierto (ADR-022).
- **Los eventos no llevan datos personales**, y por eso registrarlos no cambia el perfil de
  privacidad: son identificadores propios sin significado fuera de OPE y secuencias de clicks
  (`01 §665`).
- **Un solo proceso** escribe el registro, como el resto del almacén (**D-21**).

## Lo abierto, que se decide con esta spec delante

Tres preguntas que cambian el alcance y que no tienen un valor por defecto razonable.

### Q1 — ¿La unidad de registro es cada evento o el lote?

El dueño pidió explícitamente decidirlo con la spec escrita.

| Opción                    | Qué habilita                                                                                                                          | Qué cuesta                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Cada evento, una fila** | Contar por tipo y por tiempo directamente (US3, FR-012); buscar un evento por su identificador; el descarte por duplicado es una fila | Hasta cincuenta veces más filas que lotes, y el volumen es el del tráfico entero                                                     |
| **El lote, una fila**     | Muchas menos filas; el vínculo con la decisión es natural, porque la decisión es del lote                                             | Contar por tipo obliga a abrir cada lote; buscar un evento suelto obliga a recorrer; un duplicado no tiene dónde ser una fila propia |

**Lo que no cambia con la respuesta**: el vínculo sigue siendo lote → decisión en los dos casos.

### Q2 — ¿Cuánto se retiene?

El ledger es append-only y no poda **por diseño**, y ese diseño se pensó para decisiones. El MVP
nunca decidió retención y la 030 lo dejó explícitamente afuera. Con eventos, el volumen es el del
tráfico entero, así que la pregunta deja de ser postergable.

### Q3 — ¿Qué pasa con lo que no se pudo registrar?

Estar fuera del camino crítico significa que el registro puede atrasarse, y un proceso que se apaga
puede tener cosas encoladas. Para una decisión eso es irrelevante —y es el punto—; para un registro
forense no lo es: un registro con huecos silenciosos es peor que no tenerlo, porque se lo lee como
completo.

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
- **PostgreSQL** (**D-21**).
