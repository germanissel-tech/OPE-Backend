# Feature Specification: El backend habla en tasas, adentro y afuera

**Feature Branch**: `022-tasas-de-punta-a-punta`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Los porcentajes son valores entre 0 y 1, incluso en cualquier endpoint de entrada o salida, nunca de 0 a 100. Nuestro backend no hace conversiones de formato. Cómo se muestren en un frontend, o en un reporte, o cómo se haga el input, no es nuestro problema: debemos recibir valores entre 0 y 1 y entregamos valores entre 0 y 1." (Decisión del dueño, 2026-09-23.)

## Contexto

El sistema tiene hoy **dos representaciones del mismo número**: el exterior declara enteros de 0 a
100 y el interior razona con fracciones de 0 a 1. La conversión entre ambas está escrita en los dos
sentidos, repartida en tres anillos, con **cuatro nombres distintos para el factor** y **tres
lecturas distintas de qué es un porcentaje válido** —una de ellas duplicando palabra por palabra el
mensaje de error de otra—.

Eso no es un problema de higiene. Es una clase de defecto:

- El juez del lado interior acepta **1** como valor válido. Un valor de 1 que llegue sin convertir
  —o sea 1 %— se lee como la fracción **1**, que es el 100 %. Y el 0 se comporta igual.
- Hoy los cuatro caminos convierten, así que **no hay defecto vivo**; lo que hay es un modo de
  falla latente que cualquier refactor puede despertar sin que ningún gate lo note. Si despierta en
  el reparto de un experimento, todos los visitantes van al brazo de tratamiento y la medición
  entera queda inservible sin una sola señal.

### La decisión

El backend **no convierte formatos**. Recibe y entrega fracciones de 0 a 1, en todos sus
endpoints, en sus archivos de configuración y en su semilla. Cómo una persona escribe un 15 % en un
formulario, o cómo un reporte lo muestra, es problema de quien construye ese formulario o ese
reporte — no del sistema que decide.

Con eso **la conversión desaparece**, y con ella la clase de defecto entera: no se puede equivocar
una conversión que no existe.

### Por qué ahora

El cambio es incompatible con lo que el contrato declara hoy. El contrato está marcado **en
construcción** y ningún merchant lo consume; mientras esa marca esté, un cambio incompatible entra
sin salto de versión mayor y conservando el prefijo, reportado y aceptado (ADR-003). La marca se
quita antes del primer piloto. **Es ahora o es con merchants adentro.**

### Lo que este recorrido descartó

Este alcance es la tercera formulación de la misma pregunta, y las dos anteriores quedan registradas
porque explican por qué ésta es la correcta:

1. **Un valor `Percent` con reglas** que encapsulara la conversión. Mejora el modo de falla pero
   institucionaliza las dos representaciones.
2. **Una sola representación adentro**, con el porcentaje tipado sólo en el borde. Mejor, pero
   seguía habiendo conversión —y una conversión es algo que se puede olvidar—.
3. **Una sola representación, punto.** No hay borde donde convertir porque no hay dos formas.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El sistema recibe y entrega fracciones (Priority: P1)

Quien integra con el sistema —la plataforma de un merchant, un operador, el SDK— declara y lee
fracciones de 0 a 1. No hay ningún campo del contrato que hable en enteros de 0 a 100.

**Why this priority**: es la decisión. Todo lo demás se deriva.

**Independent Test**: recorrer el contrato y no encontrar ningún campo que declare un porcentaje
entero; y que los ejemplos publicados usen fracciones.

**Acceptance Scenarios**:

1. **Given** un operador que abre un experimento con un reparto de tratamiento, **When** declara
   `0.3`, **Then** el sistema lo acepta y reparte el 30 % del tráfico.
2. **Given** ese mismo experimento, **When** un operador lo lee, **Then** el sistema le devuelve
   `0.3` y no `30`.
3. **Given** un valor fuera de 0 a 1, **When** alguien lo declara, **Then** se rechaza nombrando el
   campo, como cualquier otro valor inválido.
4. **Given** una decisión que concede un incentivo, **When** el SDK la recibe, **Then** el valor del
   incentivo es una fracción.

---

### User Story 2 - No queda ninguna conversión de formato (Priority: P1)

Nadie que lea o escriba el sistema encuentra un lugar donde un número se multiplique o divida para
cambiar de unidad, porque no hay dos unidades.

**Why this priority**: es lo que cierra la clase de defecto. Sin esto la decisión sería sólo un
cambio de contrato y la conversión seguiría viva adentro.

**Independent Test**: buscar el factor de conversión en todo el repositorio y no encontrarlo; y que
el único juez de una fracción sea el que ya existe.

**Acceptance Scenarios**:

1. **Given** el código fuente, **When** se lo inspecciona, **Then** no hay ninguna conversión entre
   fracción y porcentaje.
2. **Given** un valor que no es una fracción válida, **When** entra por cualquier camino —API,
   archivo de configuración o semilla—, **Then** lo juzga la misma regla.
3. **Given** la granularidad con la que el reparto asigna a un visitante, **When** se la lee,
   **Then** está declarada con un nombre que dice lo que es y con su motivo, separada de cualquier
   noción de porcentaje.

---

### User Story 3 - El vocabulario de estados de un experimento lo declara su dueño (Priority: P2)

Quien agrega un estado a un experimento lo agrega en un solo lugar, y todo lo que lo lee se entera.

**Why this priority**: es independiente de la decisión de las tasas; viaja con ella porque es el
mismo hallazgo —un concepto con reglas que quedó como una lista suelta en otro anillo—.

**Independent Test**: agregar un estado al vocabulario y comprobar que el lector de la semilla lo
acepta sin tocarlo.

**Acceptance Scenarios**:

1. **Given** el vocabulario de estados, **When** se lo lee desde cualquier parte, **Then** hay una
   sola declaración y todo lo demás se deriva de ella.
2. **Given** un estado que no existe, **When** una semilla lo declara, **Then** se rechaza listando
   los estados que existen **en ese momento**.

---

### User Story 4 - La forma de un identificador de experimento tiene dueño (Priority: P3)

La regla sobre cómo se ve un identificador de experimento vive en un solo lugar, o está escrito por
qué la entrada de la semilla admite más que lo que el sistema acuña.

**Why this priority**: no hay falla observable; es una regla huérfana que hoy sólo se aplica a una
de las entradas. Se resuelve o se documenta.

**Acceptance Scenarios**:

1. **Given** un identificador de experimento, **When** el sistema lo acepta o lo rechaza, **Then**
   la regla que decide está en un solo lugar.
2. **Given** que la semilla admite más que lo que el sistema acuña, **When** alguien lo revisa,
   **Then** encuentra escrito por qué.

---

### Edge Cases

- **Los valores 0 y 1**, que son los dos donde la confusión vieja era invisible porque también eran
  fracciones válidas. Siguen siendo el caso de prueba que da sentido a todo.
- **La granularidad del reparto**, que hoy comparte valor con el factor de conversión sin tener
  nada que ver. Se queda, con nombre propio; **confundirla con el factor sería el error de esta
  feature**.
- **El mínimo de un incentivo**: hoy el contrato exige al menos 1, que significa 1 %. Como fracción
  es 0,01 y no 1 — es el mismo error que la feature elimina, escrito en el contrato.
- **La precisión que el contrato admite**: hoy los enteros imponen pasos de 1 %. Con fracciones el
  contrato podría admitir más finura de la que el sistema resuelve; hay que decidir si se restringe
  o si se documenta a qué resuelve.
- **Los datos del repositorio** —configuración por defecto, merchants de desarrollo, fixtures— que
  llevan valores escritos en la unidad vieja. Si se olvida uno, arranca con un valor cien veces
  mayor; el juez de fracciones atrapa los que superan 1, pero **no atrapa el 1**.
- **El cliente tipado** que este repositorio publica para sus consumidores: cambia con el contrato.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Todo valor que hoy el contrato declara como porcentaje entero MUST pasar a declararse
  como fracción de 0 a 1, tanto en lo que se recibe como en lo que se entrega.
- **FR-002**: Los nombres de esos campos MUST dejar de decir "porcentaje", y MUST adoptar los
  nombres que el sistema ya usa internamente para la misma cosa.
- **FR-003**: El sistema MUST NOT convertir entre unidades en ningún punto: no debe quedar ninguna
  multiplicación ni división cuyo propósito sea cambiar de representación.
- **FR-004**: Un solo juicio MUST decidir si un valor es una fracción válida, para todos los
  caminos de entrada.
- **FR-005**: La granularidad con la que el reparto asigna un visitante MUST quedar declarada
  aparte, con un nombre que diga lo que es y con su motivo escrito, aunque hoy comparta valor con
  el factor que desaparece.
- **FR-006**: El algoritmo de asignación MUST seguir produciendo exactamente los mismos brazos para
  los mismos visitantes.
- **FR-007**: El mínimo que el contrato exige a un incentivo MUST expresarse en la unidad nueva sin
  cambiar lo que significa.
- **FR-008**: El contrato MUST declarar explícitamente a qué granularidad resuelve el sistema un
  reparto, para que quien integra sepa qué esperar de un valor más fino.
- **FR-009**: Los datos que el repositorio versiona —configuración por defecto, merchants de
  desarrollo y fixtures— MUST quedar expresados en la unidad nueva.
- **FR-010**: El cliente tipado que el repositorio publica MUST reflejar la unidad nueva.
- **FR-011**: El cambio MUST entrar bajo la marca de construcción del contrato: se reporta como
  incompatible, se acepta sin salto de versión mayor y conserva el prefijo.
- **FR-012**: El vocabulario de estados de un experimento MUST estar declarado una sola vez, y todo
  lo que lo consume MUST derivarse de esa declaración.
- **FR-013**: La regla sobre la forma de un identificador de experimento MUST vivir en un solo
  lugar, o la diferencia entre lo que se acepta y lo que se acuña MUST estar escrita.
- **FR-014**: Lo que el sistema decide, registra y responde MUST quedar idéntico salvo por la
  unidad: mismos brazos, mismas entradas de registro, mismos códigos de error.

### Key Entities

- **Fracción**: un número de 0 a 1. La única forma en que el sistema expresa una parte de un todo,
  hacia adentro y hacia afuera. Ya existe y no cambia; lo que cambia es que deja de tener
  competencia.
- **Granularidad del reparto**: en cuántas cubetas se divide la población para asignar un visitante.
  Hoy cien, o sea cubetas de un centésimo. **No** es un factor de conversión, aunque hoy valgan
  igual.
- **Vocabulario de estados de un experimento**: el conjunto cerrado de estados por los que un
  experimento puede pasar, declarado por su dueño.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cero campos del contrato expresados como porcentaje entero.
- **SC-002**: Cero conversiones de unidad en el repositorio.
- **SC-003**: Un solo juicio de "esto es una fracción válida", usado por todos los caminos de
  entrada.
- **SC-004**: La asignación produce exactamente los mismos brazos que antes del cambio, demostrado
  por la prueba de regresión que ya existe.
- **SC-005**: Una sola declaración del vocabulario de estados de un experimento.
- **SC-006**: Cero valores en la unidad vieja en los datos que el repositorio versiona.
- **SC-007**: La suite completa pasa; las únicas aserciones que cambian son las que declaran o leen
  un valor en la unidad vieja, y cambian **sólo** en la unidad.

## Assumptions

- La feature sale de `021-plano-de-decoracion`, que sale de `020-grafo-de-composicion`. Ninguna está
  en `main`.
- **Ningún merchant consume el contrato todavía**, que es lo que hace posible el cambio sin salto de
  versión mayor. Si eso dejara de ser cierto antes de implementar, la feature se replantea.
- Cómo se captura o se muestra un valor —un formulario que pide "15 %", un reporte que lo escribe
  así— es responsabilidad de quien construye esa interfaz. El sistema no ofrece ni acepta esa
  forma.
- El algoritmo de asignación no se toca. La única relación con él es separar la granularidad del
  reparto del factor que desaparece.
- Unificar dónde se lee la forma de una entrada de configuración queda **fuera de alcance**: hoy hay
  dos lugares que hacen lo mismo para entradas distintas, y conviene decidirlo antes de que los
  hitos de persistencia y del puerto de plataforma traigan configuración nueva.
