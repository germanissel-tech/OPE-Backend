# Feature Specification: El porcentaje es un valor con reglas

**Feature Branch**: `022-porcentaje-como-valor`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Percent lo percibo como un value object, quizás del shared-kernel; me cuesta verlo en el borde." (Decisión del dueño, 2026-09-23, challengeando `composition/experiments-config.ts`.)

## Contexto

La convención del repositorio es explícita: **los porcentajes 0–100 viven sólo en el borde; adentro,
tasas 0–1**. Lo que la revisión del 2026-09-23 encontró es que esa convención no la sostiene nada
más que la disciplina, y que el modo de falla es silencioso y grave.

Medido en `021-plano-de-decoracion`:

- **Los dos lados de la convención son el mismo tipo.** `treatmentShare` (0..1) y
  `treatmentPercent` (0..100) son ambos `number`. Nada distingue uno de otro.
- **El juez del lado de adentro acepta el valor límite.** `isRate` admite 0..1 **inclusive**. Por
  lo tanto un porcentaje de **1** —o sea 1 %— que llegue sin convertir se lee como una tasa de
  **1.0**, o sea **100 %**. Compila, pasa la validación del dominio, pasa los siete gates de
  calidad y las 1293 pruebas, y **todos los visitantes van al brazo de tratamiento sin que nada
  avise**. Lo mismo con el holdout, y lo mismo con el valor **0**.
- **La conversión está escrita en varios lugares**, en los dos sentidos, con **cuatro nombres
  distintos para el mismo factor** repartidos en tres anillos.
- **El concepto ya existe pero no tiene dueño**: hay un predicado que juzga "esto es un
  porcentaje" dentro de un módulo de dominio, y dos reimplementaciones del factor en otros dos.
- **Hay seis conceptos que son porcentajes**, y uno de ellos ni siquiera se llama así: los cortes
  de un experimento se juzgan con otro predicado y contra otra constante.

La incoherencia que lo explica: **el repositorio marca los identificadores con tipos propios para
prevenir una confusión que casi nunca ocurre, y deja sin marcar la única confusión numérica sobre
la que escribió una convención.**

### Una trampa que el diseño tiene que respetar

Una de las cuatro constantes vale 100 **por coincidencia** y significa otra cosa: la granularidad
del reparto experimental, que resuelve a cubetas enteras de 1 %. En un mismo archivo se usa con
dos sentidos —convertir una tasa a porcentaje para compararla contra el holdout, y elegir la cubeta
de un visitante—. **Unificarla con el factor de conversión sería un error**: el día que el reparto
quiera más resolución que 1 %, ese número cambia y el factor de conversión no.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un porcentaje no puede pasar por una tasa (Priority: P1)

Quien escribe una regla, un lector de configuración o un presentador no puede confundir las dos
representaciones: el compilador lo detiene. La conversión entre ellas ocurre en un solo lugar, en
los dos sentidos.

**Why this priority**: es la historia que cierra el modo de falla silencioso. Las otras dos son
higiene; ésta evita que un experimento entero mida lo que no era.

**Independent Test**: un fixture de tipos que intenta usar un porcentaje donde se espera una tasa y
no compila, más la suite completa sin cambiar ninguna aserción de comportamiento.

**Acceptance Scenarios**:

1. **Given** un valor declarado como porcentaje, **When** se lo intenta usar donde el sistema
   espera una tasa, **Then** el build se detiene y el mensaje lo nombra.
2. **Given** un porcentaje de 1, **When** se lo convierte, **Then** la tasa resultante es 0,01 —y
   no hay ningún camino por el que un 1 se convierta en la tasa 1.
3. **Given** una tasa cualquiera, **When** se la presenta como porcentaje, **Then** el redondeo es
   el mismo que hoy y el valor que sale al exterior no cambia.
4. **Given** un número que no es un porcentaje válido (no entero, negativo, mayor que 100),
   **When** se lo declara como tal, **Then** se rechaza nombrando el campo, como hoy.

---

### User Story 2 - El vocabulario de estados de un experimento lo declara su dueño (Priority: P2)

Quien agrega un estado a un experimento lo agrega en un solo lugar, y todo lo que lo lee se entera.

**Why this priority**: es un agujero real —un estado nuevo quedaría invisible para la semilla— pero
hoy no puede fallar, porque el vocabulario no cambió desde que se escribió.

**Independent Test**: agregar un estado al vocabulario y comprobar que el lector de la semilla lo
acepta sin tocarlo.

**Acceptance Scenarios**:

1. **Given** el vocabulario de estados, **When** se lo lee desde cualquier parte del sistema,
   **Then** hay una sola declaración y todo lo demás se deriva de ella.
2. **Given** un estado que el vocabulario no tiene, **When** una semilla lo declara, **Then** se
   rechaza con un mensaje que lista los estados que existen **en ese momento**.

---

### User Story 3 - La forma de un identificador de experimento tiene dueño (Priority: P3)

La regla sobre cómo se ve un identificador de experimento vive con la identidad, o está escrito por
qué la entrada de la semilla es más permisiva que lo que el sistema acuña.

**Why this priority**: no hay falla observable; es una regla huérfana que hoy sólo se aplica a una
de las entradas. Se resuelve o se documenta, pero no se deja como está.

**Independent Test**: la regla se lee en un solo lugar, y si hay dos formas válidas, cada una dice
por qué.

**Acceptance Scenarios**:

1. **Given** un identificador de experimento, **When** el sistema lo acepta o lo rechaza, **Then**
   la regla que decide está en un solo lugar.
2. **Given** que la entrada de la semilla admite más que lo que el sistema acuña, **When** alguien
   lo revisa, **Then** encuentra escrito por qué.

---

### Edge Cases

- **El porcentaje 0 y el porcentaje 1**, que son los dos valores donde la confusión es silenciosa
  porque también son tasas válidas. Son el caso de prueba obligatorio.
- **El redondeo de vuelta**: una tasa que no cae en un porcentaje entero. Lo que sale al exterior no
  puede cambiar respecto de hoy.
- **La granularidad del reparto**, que vale lo mismo que el factor de conversión y **no es** el
  factor de conversión. Tiene que quedar separada y con su motivo escrito.
- **Los cortes de un experimento**, que son porcentajes de la muestra y hoy se juzgan con otro
  predicado. Entran al mismo vocabulario o se declara por qué no.
- **Una lista de porcentajes** (la escalera de incentivos), donde la conversión se aplica elemento
  por elemento.
- **El porcentaje opcional** (el margen), que puede no estar declarado.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El sistema MUST tratar un porcentaje como un valor con sus propias reglas —entero,
  entre 0 y 100— y no como un número cualquiera.
- **FR-002**: Un porcentaje MUST NOT poder usarse donde el sistema espera una tasa, ni al revés, y
  el intento MUST detener el build.
- **FR-003**: La conversión entre porcentaje y tasa MUST estar escrita **una sola vez**, en los dos
  sentidos, incluido su redondeo.
- **FR-004**: El factor de conversión MUST estar declarado una sola vez en todo el repositorio.
- **FR-005**: La granularidad del reparto experimental MUST quedar separada del factor de
  conversión, con su motivo escrito, aunque hoy valgan lo mismo.
- **FR-006**: Los seis conceptos que son porcentajes MUST pasar por la misma puerta: el reparto de
  tratamiento, el holdout, el techo de incentivo, la escalera de incentivos, el margen y los cortes
  de un experimento.
- **FR-007**: Un valor que no es un porcentaje válido MUST rechazarse nombrando el campo que lo
  declaró, como hoy.
- **FR-008**: El vocabulario de estados de un experimento MUST estar declarado una sola vez, y todo
  lo que lo consume MUST derivarse de esa declaración.
- **FR-009**: La regla sobre la forma de un identificador de experimento MUST vivir en un solo
  lugar, o la diferencia entre lo que se acepta y lo que se acuña MUST estar escrita.
- **FR-010**: El contrato MUST quedar sin cambios: los porcentajes que entran y salen por la API
  siguen siendo enteros de 0 a 100.
- **FR-011**: Lo que el sistema responde, registra y decide MUST quedar idéntico: esta feature no
  cambia ningún comportamiento observable.

### Key Entities

- **Porcentaje**: un entero de 0 a 100, tal como el exterior lo declara y lo lee. Sabe convertirse
  en la tasa equivalente, y sabe construirse desde una tasa con su redondeo.
- **Tasa**: la fracción de 0 a 1 con la que razonan las reglas del sistema. No cambia: es el número
  con el que se sigue calculando.
- **Vocabulario de estados de un experimento**: el conjunto cerrado de estados por los que un
  experimento puede pasar, declarado por el módulo dueño.
- **Granularidad del reparto**: en cuántas cubetas se divide la población para asignar un visitante.
  Hoy 100, o sea cubetas de 1 %. **No** es el factor de conversión.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un porcentaje usado donde va una tasa **no compila**, demostrado por un fixture que
  se corre en cada build.
- **SC-002**: Una sola declaración del factor de conversión en todo el repositorio.
- **SC-003**: Cero predicados de "esto es un porcentaje" fuera del lugar que lo posee.
- **SC-004**: Una sola declaración del vocabulario de estados de un experimento.
- **SC-005**: Cero diff del contrato.
- **SC-006**: La suite completa pasa sin modificar ninguna aserción de comportamiento
  preexistente; las únicas aserciones nuevas son las de SC-001 y las del caso 0/1.
- **SC-007**: Convertir un porcentaje de 1 nunca produce la tasa 1, demostrado por prueba.

## Assumptions

- La feature sale de `021-plano-de-decoracion`, que sale de `020-grafo-de-composicion`; ninguna de
  las dos está en `main`. Si el dueño mergea antes de empezar, sale de `main`.
- El contrato no cambia y no se toca: los porcentajes seguirán entrando y saliendo como enteros de
  0 a 100. La feature es interna.
- El algoritmo de asignación y el reparto en cubetas **no se tocan**. La única relación con ellos es
  separar explícitamente la granularidad del factor de conversión.
- Que el concepto de porcentaje viva en el corazón compartido del sistema **no contradice** la
  convención: la convención dice con qué representación razonan las reglas, no dónde vive el
  contrato de conversión. Hoy ya hay un predicado de porcentaje adentro del dominio, en un módulo
  que no es su dueño; esta feature lo consolida en vez de agregarlo.
- Unificar dónde se lee la forma de una entrada de configuración queda **fuera de alcance**: hoy
  hay dos lugares que hacen lo mismo para entradas distintas, y es una decisión de arquitectura que
  merece su propia discusión — conviene tomarla antes de que los hitos de persistencia y del puerto
  de plataforma traigan configuración nueva.
