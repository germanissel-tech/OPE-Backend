# Feature Specification: Asignación experimental y ledger

**Feature Branch**: `006-asignacion-experimental`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Asignación experimental y ledger. Segunda feature de dominio;
primer paso del camino crítico (01-arquitectura-mvp.md §4.1) y primer estado de la cadena de
evidencia (§5, ASSIGNED). Alcance: (1) módulo `experiment` con un experimento por merchant
definido por configuración y asignación determinista y estable de cada visitante a un brazo;
(2) la asignación se registra en el ledger cuando ocurre, idempotente, para el ITT; (3) la
ingesta resuelve la asignación antes de decidir, CONTROL siempre NO_OP con motivo propio, el
brazo nunca viaja al SDK; (4) la asignación no es una bandera; (5) semántica de escritura del
ledger fijada por ADR: diferida, acotada, fail-closed con motivo `ledger-unavailable`; (6)
prueba de carga informativa sin SLA; (7) aislamiento entre merchants y entre experimentos;
(8) glosario e invariantes probadas. Fuera de alcance: persistencia real, kill switch y
banderas, plano de decisión, lectura para el portal, multi-instancia."

## Contexto

La 004 dejó la ingesta: cada lote de eventos de un visitante produce una decisión, hoy siempre
`NO_OP` porque no hay plano de decisión. Pero el MVP no existe para intervenir: existe para
**medir** si intervenir produce contribución incremental, y eso exige un experimento
controlado desde el primer visitante (01-arquitectura-mvp.md §4.1, §5). Sin asignación
registrada no hay análisis por intención de tratar (§5.1) y cualquier número que salga después
es un número que no sobrevive a una auditoría.

La asignación es el primer paso del camino crítico y tiene tres propiedades que no se
negocian: es **determinista** (una función del visitante, no una moneda), es **estable** (el
mismo visitante cae siempre en el mismo brazo, en cualquier instancia, sin consultar estado
compartido) y se **registra cuando ocurre**, no cuando hay exposición. Un visitante de
CONTROL atraviesa todo el pipeline y se registra igual; la única diferencia es que la política
siempre resuelve `NO_OP`. Eso mide sin sesgo y, además, permite detectar si el pipeline se
comporta distinto entre brazos, que sería un defecto (§4.1).

Esta feature trae además dos decisiones que la persistencia real (007) va a necesitar ya
tomadas: cómo escribe el ledger sin bloquear el camino crítico y qué hace el sistema cuando el
ledger no está (§4.6, §4.7: preferimos perder una intervención antes que perder la integridad
de la medición), y una medición honesta de cuánta carga aguanta hoy una instancia (§4.6: el
objetivo de latencia es de diseño, no un compromiso; §9: una sola instancia hasta que el
tráfico exija otra cosa).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Cada visitante cae siempre en el mismo brazo, sin preguntarle a nadie (Priority: P1)

Un merchant tiene un experimento activo con un reparto (por defecto, mitad y mitad). Cuando un
visitante llega por primera vez, el sistema determina su brazo —CONTROL o TREATMENT— a partir
del merchant, el experimento y el identificador del visitante, sin consultar ningún estado
compartido ni tirar ninguna moneda. Cuando vuelve —en otra sesión, otro día, atendido por otra
instancia— cae en el mismo brazo. Sobre muchos visitantes, la proporción observada se aproxima
al reparto configurado.

**Why this priority**: sin esto no hay experimento. La estabilidad es lo que hace comparables
los grupos; el determinismo sin estado compartido es lo que permite escalar sin coordinación
(01 §4.1, §9).

**Independent Test**: una función pura recibe merchant, experimento y visitante y devuelve el
brazo; la misma entrada devuelve siempre la misma salida; sobre una muestra grande de
visitantes generados la proporción de TREATMENT queda dentro de una tolerancia del reparto
configurado; dos merchants con el mismo visitante y distinta semilla obtienen brazos
independientes.

**Acceptance Scenarios**:

1. **Given** un experimento activo con reparto 50/50, **When** se asigna el mismo visitante
   mil veces (misma entrada), **Then** las mil respuestas son idénticas.
2. **Given** el mismo experimento, **When** se asignan cien mil visitantes distintos, **Then**
   la proporción de TREATMENT está entre 49 % y 51 %.
3. **Given** un experimento con reparto 20/80 (TREATMENT/CONTROL), **When** se asignan cien mil
   visitantes, **Then** la proporción de TREATMENT está entre 19 % y 21 %.
4. **Given** el mismo visitante en dos merchants distintos, **When** se lo asigna en cada uno,
   **Then** los brazos son independientes (sobre muchos visitantes, la coincidencia es la
   esperada por azar, no sistemática).
5. **Given** un experimento cuya semilla o reparto cambia, **When** se lo compara con el
   anterior, **Then** es un experimento distinto con identificador distinto; el sistema no
   admite modificar semilla ni reparto de un experimento existente.
6. **Given** un merchant sin experimento activo, **When** llega un lote, **Then** el sistema
   no asigna, no registra asignación y decide `NO_OP` con el motivo "sin experimento activo".

---

### User Story 2 - La asignación queda registrada cuando ocurre, una sola vez (Priority: P1)

Cuando un visitante es asignado por primera vez —al recibir su primer lote de eventos— el
sistema registra la asignación en el ledger con merchant, experimento, visitante, brazo e
instante. Es el estado `ASSIGNED` de la cadena de evidencia (01 §5) y ocurre haya o no
exposición después. Los lotes siguientes del mismo visitante no producen un segundo registro.

**Why this priority**: el análisis por intención de tratar compara a **todos** los asignados a
cada grupo, hayan visto algo o no (01 §5.1). Si la asignación se registrara al exponer, se
mediría la autoselección y no el efecto.

**Independent Test**: tras el primer lote de un visitante existe exactamente una asignación
en el ledger con sus cinco campos; tras diez lotes más sigue habiendo una; una asignación de
un merchant no es visible desde otro.

**Acceptance Scenarios**:

1. **Given** un visitante nuevo, **When** envía su primer lote, **Then** el ledger tiene una
   asignación con merchant, experimento, visitante, brazo e instante del reloj del backend.
2. **Given** ese visitante ya asignado, **When** envía diez lotes más (en la misma sesión o en
   otras), **Then** el ledger sigue teniendo exactamente una asignación para él y su brazo no
   cambió.
3. **Given** un lote rechazado (por contrato o por invariante), **When** se inspecciona el
   ledger, **Then** no hay asignación nueva: sólo un lote aceptado asigna.
4. **Given** dos experimentos del mismo merchant, uno cerrado y otro activo, **When** un
   visitante asignado en el cerrado llega con el activo, **Then** recibe una asignación nueva
   en el activo y la del cerrado queda intacta.
5. **Given** asignaciones del merchant A, **When** el merchant B consulta el ledger por el
   mismo visitante, **Then** no ve ninguna.

---

### User Story 3 - CONTROL recorre el mismo camino y siempre resuelve no intervenir (Priority: P1)

Cada lote resuelve la asignación del visitante antes de decidir. La decisión registra el brazo
y el experimento. Para un visitante de CONTROL el pipeline se ejecuta entero y la decisión es
siempre `NO_OP` con el motivo "brazo de control"; para TREATMENT la decisión sigue siendo
`NO_OP` porque todavía no hay plano de decisión, con el motivo que ya existe. El brazo nunca
viaja en la respuesta al SDK ni en ningún request: el navegador no sabe en qué grupo está.

**Why this priority**: es lo que permite medir sin sesgo y detectar si el pipeline trata
distinto a los dos brazos (01 §4.1). Que el brazo no salga del backend protege la homogeneidad
del experimento y la regla de que nada del experimento se decide del lado del cliente.

**Independent Test**: dos visitantes conocidos (uno por brazo) envían lotes; las decisiones
registradas en el ledger llevan brazo y experimento; la del visitante de CONTROL tiene motivo
"brazo de control"; ninguna respuesta HTTP contiene el brazo ni el identificador del
experimento; la latencia de la ingesta no cambia de forma medible entre brazos.

**Acceptance Scenarios**:

1. **Given** un visitante de CONTROL, **When** envía un lote válido, **Then** la respuesta es
   `NO_OP` y la decisión del ledger registra brazo CONTROL, el experimento y el motivo "brazo
   de control".
2. **Given** un visitante de TREATMENT, **When** envía un lote válido, **Then** la respuesta es
   `NO_OP` con el motivo "plano de decisión no disponible" y la decisión registra brazo
   TREATMENT y el experimento.
3. **Given** cualquier respuesta de ingesta o de exposición, **When** se inspecciona su cuerpo,
   **Then** no contiene el brazo ni el identificador del experimento.
4. **Given** lotes de visitantes de ambos brazos, **When** se mide la latencia por brazo,
   **Then** los percentiles no difieren de forma que delate el brazo (misma ruta, mismo
   trabajo).
5. **Given** un visitante de CONTROL, **When** se confirma una exposición de su decisión,
   **Then** se rechaza como exposición de `NO_OP` (la regla de la 004 ya lo cubre; CONTROL
   nunca produce intervención).

**Decisión (usuario, 2026-09-17)**: un solo catálogo de motivos, visible al SDK: `decision.reason`
lleva "brazo de control" tal cual lo registra el ledger. El brazo no viaja como campo, pero se
puede deducir del motivo; eso no compromete el experimento (la asignación es determinista y no
depende de lo que el visitante sepa) y mantiene la regla de que la respuesta dice lo mismo que
el ledger (constitución II).

---

### User Story 4 - El ledger escribe sin frenar la decisión, y si no está, el sistema se calla (Priority: P2)

El registro en el ledger (asignaciones, decisiones, exposiciones) es diferido y acotado: el
camino crítico no espera a que la escritura termine, y hay un límite de escrituras pendientes.
Cada registro devuelve un resultado honesto: aceptado, o no disponible. Si el ledger no está
disponible, el sistema falla cerrado: no interviene, resuelve `NO_OP` con el motivo "ledger no
disponible" y lo deja visible en la observabilidad. En esta feature la implementación en
memoria nunca falla, pero el contrato del puerto y el camino de degradación quedan fijados por
decisión escrita y probados con un ledger falso que reporta no disponible.

**Why this priority**: la 007 va a poner una base de datos detrás de estos puertos. Si la
semántica se decide entonces, el código de la 006 nacerá asumiendo escrituras síncronas e
infalibles y habrá que reescribirlo. 01 §4.6 y §4.7 lo fijan: ninguna escritura bloqueante;
ledger no disponible ⇒ se suprime la intervención.

**Independent Test**: con un ledger falso que responde "no disponible", un lote válido produce
`NO_OP` con motivo "ledger no disponible", no registra asignación ni decisión, y el servidor
sigue respondiendo; con el ledger disponible el mismo lote produce la decisión normal; la
respuesta del registro es visible al orquestador y distinta en cada caso.

**Acceptance Scenarios**:

1. **Given** el ledger de asignaciones reporta no disponible, **When** llega el primer lote de
   un visitante, **Then** la respuesta es `NO_OP` con motivo "ledger no disponible", no hay
   asignación registrada y no hay error 5xx.
2. **Given** el ledger de decisiones reporta no disponible, **When** llega un lote, **Then**
   la respuesta es `NO_OP` con motivo "ledger no disponible" y la decisión no se registra.
3. **Given** el ledger vuelve a estar disponible, **When** el mismo visitante envía otro lote,
   **Then** se asigna y se registra con normalidad, como si fuera la primera vez.
4. **Given** una escritura aceptada, **When** se mide el tiempo de respuesta de la ingesta,
   **Then** no incluye el tiempo de completar la escritura (la aceptación es inmediata).
5. **Given** la decisión de diseño, **When** se la busca, **Then** existe como registro de
   decisión de arquitectura citado desde el código de los puertos.

---

### User Story 5 - Sabemos cuánta carga aguanta una instancia hoy (Priority: P3)

Una prueba de carga informativa levanta el servidor real con el perfil en memoria y lo somete
a un volumen sostenido de lotes de ingesta durante un tiempo fijo. Reporta throughput
(lotes/segundo), p50/p95/p99 de latencia y tasa de error. No hay umbral que la haga fallar:
es una medición que queda registrada y que la 007 va a repetir con persistencia real.

**Why this priority**: el objetivo de latencia es de diseño, no de compromiso, hasta medir bajo
tráfico (01 §4.6); y la decisión de seguir con una sola instancia (01 §9) necesita un número
para revisarse.

**Independent Test**: la prueba corre en un comando propio, no dentro de la suite corriente,
imprime las cifras en un formato estable y termina con éxito aunque las cifras sean malas.

**Acceptance Scenarios**:

1. **Given** el servidor real levantado, **When** se corre la prueba de carga, **Then** imprime
   lotes/segundo, p50, p95, p99 y tasa de error sobre una duración y una concurrencia
   declaradas.
2. **Given** la prueba, **When** se corre dos veces, **Then** ambas terminan con éxito y las
   cifras se registran en el quickstart de la feature con fecha y máquina.
3. **Given** la suite corriente, **When** se corre `npm test`, **Then** la prueba de carga no
   forma parte de ella (tiene su propio comando).

---

### Edge Cases

- Visitante con identificador válido pero nunca visto y merchant sin experimento activo: no
  se asigna, `NO_OP` "sin experimento activo", nada en el ledger de asignaciones.
- Experimento cerrado con visitantes ya asignados: no se asigna a nadie más en él; los
  registros existentes se conservan; un experimento activo nuevo asigna desde cero.
- Dos experimentos activos a la vez para un merchant: no se admite; la configuración se rechaza
  al arrancar (fail-closed, como los merchants inválidos).
- Reparto 0 % o 100 % de TREATMENT: admitido como configuración (calibración o apagado
  experimental) y se asigna en consecuencia; se registra igual.
- Semilla vacía o repetida entre merchants: la semilla es obligatoria; dos merchants pueden
  tener la misma semilla y aun así sus asignaciones son independientes porque el merchant
  forma parte de la entrada.
- Mismo visitante en dos lotes simultáneos: ambos asignan el mismo brazo (determinismo) y el
  ledger conserva una sola asignación (idempotencia por clave).
- Ledger que acepta la asignación pero no la decisión: se resuelve `NO_OP` "ledger no
  disponible"; la asignación registrada es válida y no se revierte (asignar es registrar la
  intención de tratar, no la decisión).
- Cambio de reparto o semilla "en caliente": no existe como operación; sólo un experimento
  nuevo con otro identificador.

## Requirements _(mandatory)_

### Functional Requirements

**Experimento y asignación**

- **FR-001**: Cada merchant MUST poder tener como máximo un experimento activo, definido por
  configuración en esta feature (identificador, reparto TREATMENT/CONTROL como porcentaje
  entero de TREATMENT entre 0 y 100, semilla no vacía, estado activo o cerrado, fecha de
  inicio); una configuración con dos activos o campos inválidos MUST rechazarse al arrancar.
- **FR-002**: La asignación de un visitante a un brazo MUST ser una función pura de merchant,
  experimento, semilla y visitante, sin consultar estado compartido ni fuente de azar en el
  momento de asignar; MUST devolver siempre el mismo brazo para la misma entrada, en cualquier
  instancia y en cualquier momento.
- **FR-003**: Sobre una muestra grande de visitantes distintos, la proporción asignada a
  TREATMENT MUST aproximarse al reparto configurado con una tolerancia declarada en la prueba.
- **FR-004**: Las asignaciones de dos merchants para el mismo visitante MUST ser
  independientes; las de dos experimentos del mismo merchant también.
- **FR-005**: La semilla y el reparto de un experimento MUST NOT poder modificarse: un cambio
  es un experimento nuevo con otro identificador. La asignación MUST NOT ser una bandera de
  configuración ni depender de ninguna (01 §14.2).

**Registro (estado ASSIGNED)**

- **FR-010**: La asignación MUST registrarse en el ledger en el momento en que ocurre —el primer
  lote aceptado del visitante en el experimento—, con merchant, experimento, visitante, brazo e
  instante del reloj del backend; MUST NOT registrarse al exponer.
- **FR-011**: Registrar la misma asignación otra vez MUST ser idempotente: una sola asignación
  por merchant, experimento y visitante; el brazo registrado MUST coincidir con el calculado.
- **FR-012**: Un lote rechazado (contrato o invariante) MUST NOT producir asignación.
- **FR-013**: Las asignaciones MUST ser consultables por merchant, experimento y visitante a
  través de un puerto; una consulta de otro merchant MUST devolver "no existe".

**Orquestación**

- **FR-020**: Toda decisión MUST registrar el brazo y el identificador del experimento del
  visitante, además de lo que ya registra.
- **FR-021**: Un visitante de CONTROL MUST atravesar el mismo pipeline que uno de TREATMENT y
  resolver siempre `NO_OP` con el motivo "brazo de control", del catálogo.
- **FR-022**: Sin experimento activo, la decisión MUST ser `NO_OP` con el motivo "sin
  experimento activo", del catálogo, y no se registra asignación.
- **FR-023**: El brazo y el identificador del experimento MUST NOT aparecer como campos en
  ninguna respuesta HTTP ni aceptarse en ningún request; el motivo de `NO_OP` sale tal cual lo
  registra el ledger (un solo catálogo), aunque de él se deduzca el brazo.
- **FR-024**: La resolución de la asignación MUST NOT agregar I/O de red ni escritura
  bloqueante al camino crítico.

**Semántica de escritura del ledger**

- **FR-030**: Una decisión de arquitectura MUST fijar, antes de la persistencia real, que toda
  escritura al ledger (asignación, decisión, exposición) es diferida y acotada, y que el
  registro devuelve un resultado explícito: aceptado o no disponible.
- **FR-031**: Ante un ledger no disponible, el orquestador MUST fallar cerrado: `NO_OP` con el
  motivo "ledger no disponible", sin intervención, sin error 5xx, con el hecho visible en los
  logs operativos.
- **FR-032**: La implementación en memoria MUST cumplir el contrato del puerto (aceptar siempre);
  el camino de degradación MUST probarse con una implementación falsa que reporte no
  disponible, en ingesta y en exposición.
- **FR-033**: El motivo "ledger no disponible" y el motivo "brazo de control" y "sin
  experimento activo" MUST agregarse al catálogo de motivos de `NO_OP` sin cambio incompatible
  del contrato.

**Carga**

- **FR-040**: MUST existir una prueba de carga con comando propio, fuera de la suite corriente,
  que levante el servidor real con el perfil en memoria y reporte lotes/segundo, p50, p95, p99
  y tasa de error para una duración y una concurrencia declaradas; MUST NOT fallar por las
  cifras (sin SLA).
- **FR-041**: Las cifras obtenidas MUST registrarse en el quickstart de la feature con fecha y
  máquina, como línea base para la 007.

**Aislamiento, glosario, verificación**

- **FR-050**: Las pruebas MUST demostrar aislamiento entre merchants (mismo visitante, dos
  merchants; asignaciones no visibles) y entre experimentos del mismo merchant.
- **FR-051**: Todo sustantivo nuevo MUST tener su nota en el glosario con fuente: experimento,
  asignación, brazo, control, tratamiento, intención de tratar.
- **FR-052**: Las propiedades de la asignación (determinismo, estabilidad, reparto,
  independencia) y del registro (idempotencia) MUST verificarse con pruebas nombradas; si el
  contrato HTTP declarara reglas nuevas, irían como invariantes con tipo propio, pero esta
  feature no agrega operaciones ni campos al contrato.
- **FR-053**: La suite anterior MUST seguir pasando sin modificar aserciones.

### Key Entities

- **Experimento**: identificador, merchant, reparto (porcentaje de TREATMENT), semilla,
  estado (activo | cerrado), fecha de inicio. Como máximo uno activo por merchant.
- **Brazo**: CONTROL | TREATMENT.
- **Asignación**: merchant, experimento, visitante, brazo, instante. Estado `ASSIGNED` de la
  cadena de evidencia. Una por (merchant, experimento, visitante).
- **Decisión** (ampliada): además de lo de la 004, brazo y experimento.
- **Resultado de registro**: aceptado | no disponible. Lo devuelve todo puerto del ledger.
- **Motivo de `NO_OP`** (ampliado): brazo de control, sin experimento activo, ledger no
  disponible.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un millón de asignaciones repetidas del mismo visitante dan un millón de veces
  el mismo brazo; con cien mil visitantes distintos la proporción de TREATMENT queda dentro de
  ±1 punto del reparto configurado, para al menos tres repartos distintos.
- **SC-002**: Tras cualquier secuencia de lotes de un visitante, el ledger tiene exactamente
  una asignación para él en el experimento activo, creada con su primer lote aceptado.
- **SC-003**: Ninguna respuesta HTTP de la suite de integración contiene un campo con el brazo
  ni el identificador del experimento (verificado sobre todas las respuestas capturadas); el
  único rastro admitido es el motivo de `NO_OP`.
- **SC-004**: Con el ledger no disponible, el 100 % de los lotes válidos recibe `NO_OP` con
  motivo "ledger no disponible" y ninguno recibe 5xx; con el ledger disponible, el mismo lote
  produce decisión y asignación.
- **SC-005**: La latencia de la ingesta con asignación no supera en más de 10 % la medida en la
  004 (p95 en el perfil de memoria), y no difiere entre brazos.
- **SC-006**: La prueba de carga corre con un comando, reporta las cinco cifras y termina con
  éxito; las cifras están en el quickstart.
- **SC-007**: `release-check` en verde; la suite de las features 001–005 pasa sin modificar
  aserciones; el glosario resuelve todo sustantivo nuevo.

## Assumptions

- Los experimentos vienen de la misma configuración que los merchants (variable de entorno o
  archivo), con la misma validación fail-closed al arrancar; el almacén real llega con la 007.
- El reparto por defecto, si un experimento no lo declara, es 50 % TREATMENT.
- "Muestra grande" en las pruebas de reparto es del orden de cien mil visitantes generados;
  la tolerancia es ±1 punto porcentual.
- La asignación calculada en cada lote se compara con la registrada; si difirieran (sólo
  posible por un cambio indebido de configuración) gana la registrada y se loguea el hecho
  como error operativo: la estabilidad del brazo es más importante que la fórmula.
- La cadena de evidencia sigue teniendo sólo `ASSIGNED` y `EXPOSED`; `VERIFIED_ORDER` y
  siguientes llegan con outcomes (008).
- El kill switch, las banderas y la versión de configuración estampada en cada decisión (01
  §14.2) son de la 009; esta feature no las adelanta.
- La prueba de carga usa una herramienta de carga HTTP estándar sobre el servidor real en un
  puerto libre; los parámetros por defecto son 30 segundos y 20 conexiones concurrentes.
