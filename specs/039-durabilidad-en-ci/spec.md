# Feature Specification: La durabilidad se verifica en CI, y ninguna prueba corre en ningún lado

**Feature Branch**: `039-durabilidad-en-ci`

**Created**: 2026-10-06

**Status**: Draft

**Input**: Hallazgo al verificar las features 037 y 038 antes de mergearlas (2026-10-06), con el orden
elegido por el dueño en esa conversación: «CI de durabilidad primero, que es chico y protege todo lo
demás». La evidencia está en «El hueco, medido».

## Por qué existe

Dos documentos normativos del repositorio dicen lo mismo con otras palabras. `.claude/rules/gateway-durable.md`:
«Su prueba va en `tests/durability/`, **y no hay otra**. El proyecto `fast` corre en memoria a propósito, así
que ninguna prueba de ahí toca estos gateways. La cobertura es entera de esa suite». Y CLAUDE.md, del
proyecto `durability`: «lo único que sólo se ve cruzando un reinicio. Es la única cobertura de los gateways
durables».

**Y el job que decide si un cambio entra no la corre.** El job `checks` corre la suite que un cambio
necesita, y esa elección se escribió cuando el proyecto `durability` todavía no existía: el script es de la
feature 017 y el proyecto nació en la 030. No fue una decisión que alguien tomó y escribió; es una omisión
por cronología, que es la clase de hueco que nadie encuentra leyendo, porque no hay nada escrito que
contradecir.

Lo que hoy tapa el hueco es un accidente afortunado: el job de mutación, para poder juzgar un mutante,
arranca ejecutando toda la suite, y ahí la durabilidad entra. Funciona —una prueba de durabilidad roja pone
rojo ese job— pero **el rojo no dice qué falló**: dice «el arranque de la mutación falló». Y la cobertura de
lo único que cubre los gateways durables depende de que ese job exista y de que su configuración siga
incluyendo esa suite, dos cosas que nadie declaró como requisito.

**Y tres pruebas no corren en ningún lado.** La configuración de la mutación excluye seis archivos por
nombre; tres son del proyecto `fast` y se corren igual, y los otros tres son de durabilidad y no tienen
quién los corra. Una de ellas es la que mide lo que una acción de administración le cuesta a una decisión
concurrente (feature 034): la escribimos para responder una pregunta que nadie más responde, y hace tres
features que no se ejecuta fuera de la máquina de quien la escribió.

## El hueco, medido (2026-10-06)

| Qué                             | Archivos | Pruebas | Duración en la máquina de desarrollo |
| ------------------------------- | -------- | ------- | ------------------------------------ |
| Proyecto `durability` entero    | 23       | 197     | **207 s**                            |
| Las tres pruebas medidas        | 3        | 4       | 43 s                                 |
| El resto, que es comportamiento | 20       | 193     | ~165 s                               |

El job que decide tarda hoy 8 min 36 s; el de mutación, unos 20 min, y es el que domina el reloj de pared.

## Lo decidido antes de la spec

1. **La durabilidad se verifica en un lugar propio, no adentro del job que ya existe.** Con los números de
   arriba las dos opciones cuestan lo mismo en reloj de pared —el job de mutación es más largo que
   cualquiera de las dos—, así que el criterio no es el tiempo: es que **un rojo diga qué falló**. «La
   durabilidad falló» y «los gates fallaron» mandan a leer lugares distintos, y hoy el rojo que existe
   manda a leer el peor de los tres.
2. **Una prueba que mide no es un gate** (CLAUDE.md ya lo dice de la barrida informativa y de `test:load`).
   Un techo medido en la máquina de desarrollo no significa lo mismo donde CI corre: la prueba de la ventana
   de administración falló acá con sólo compartir la máquina con los otros dos proyectos, y pasó sola y con
   su proyecto entero. Las tres medidas se quedan afuera del gate — pero **dicho donde se pueda verificar**,
   no como efecto secundario de la configuración de otra herramienta.
3. **Lo que no corre en ningún lado tiene que fallar el build.** Es la misma forma que el repositorio ya usa
   para las instrucciones y los inventarios de los README: se verifica en los dos sentidos, y abrir una
   categoría obliga a decidir a cuál pertenece lo nuevo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un cambio que rompe un gateway durable no entra (Priority: P1)

Quien manda un cambio que rompe la lectura, la idempotencia, el aislamiento entre merchants o la
degradación de un gateway durable ve el rechazo **nombrando la durabilidad**, sin tener que saber que el
arranque de otra herramienta era lo que lo cubría.

**Why this priority**: es el hueco. Sin esta historia, la única cobertura de los gateways durables sigue
dependiendo de un efecto secundario, y lo que la feature 030 decidió —que esa suite es la cobertura entera—
no es cierto del proceso que decide si un cambio entra.

**Independent Test**: romper a propósito una garantía que sólo se ve cruzando un reinicio (que una entidad
leída vuelva como registro plano, por ejemplo) y comprobar que la verificación falla, y que lo que informa
nombra la durabilidad.

**Acceptance Scenarios**:

1. **Given** un cambio que rompe una garantía de un gateway durable, **When** se verifica el cambio,
   **Then** la verificación falla y lo que informa nombra la suite de durabilidad.
2. **Given** un cambio que no toca la persistencia, **When** se verifica, **Then** la durabilidad se
   verifica igual: lo que la cubre no depende de adivinar qué cambió.
3. **Given** la verificación de la durabilidad, **When** falla, **Then** se distingue de un fallo de los
   demás gates sin leer el detalle: el nombre de lo que falló alcanza.
4. **Given** que la herramienta que hoy la cubre de rebote dejara de existir o de incluir esa suite,
   **When** se verifica un cambio, **Then** la durabilidad se sigue verificando.

### User Story 2 - Ninguna prueba del repositorio corre en ningún lado (Priority: P1)

Quien agrega una prueba de durabilidad no puede dejarla sin ejecutar por olvido: o entra al conjunto que
decide, o queda declarada como medición, y no hay tercera opción silenciosa.

**Why this priority**: es lo que evita que el hueco vuelva. Tres pruebas ya se perdieron así, y lo que las
perdió fue una lista escrita a mano en la configuración de otra herramienta — exactamente lo que vuelve a
pasar la próxima vez que alguien excluya un archivo por una razón buena y nadie lo note.

**Independent Test**: agregar un archivo de prueba de durabilidad que no esté en ninguna de las dos
categorías y comprobar que el build falla nombrándolo.

**Acceptance Scenarios**:

1. **Given** un archivo de prueba de durabilidad que no está en el conjunto que decide ni declarado como
   medición, **When** se verifica el repositorio, **Then** falla nombrando el archivo.
2. **Given** un archivo declarado como medición que ya no existe, **When** se verifica, **Then** falla
   nombrándolo: la declaración no puede quedar vieja.
3. **Given** las tres pruebas que miden, **When** se verifica el repositorio, **Then** están declaradas
   como mediciones con su motivo, en un lugar que la verificación lee.

### User Story 3 - Una medición se puede correr cuando alguien quiere el número (Priority: P2)

Quien quiere el número —al cerrar una feature, antes de un piloto, o para comparar contra una medición
anterior— tiene un comando que corre las mediciones y le informa las cifras, aunque no sean un gate.

**Why this priority**: sin esto, «no son un gate» se vuelve «no se corren nunca», que es el estado actual
de las tres. La diferencia entre una medición y una prueba muerta es que alguien la pueda correr y sepa
cómo.

**Independent Test**: correr el comando de las mediciones y ver las cifras de las tres pruebas.

**Acceptance Scenarios**:

1. **Given** el repositorio, **When** alguien corre las mediciones, **Then** se ejecutan las tres y se
   informan sus cifras.
2. **Given** una medición que cruza su techo en la máquina donde corre, **When** se ejecuta, **Then** lo
   dice, y eso **no** bloquea un cambio: es una cifra para interpretar, no un veredicto.

### Edge Cases

- **La verificación de durabilidad tarda más que el resto y alguien la cancela**: el resultado de un cambio
  no puede quedar en «verde» porque lo largo quedó sin terminar. Lo que decide tiene que esperar a las dos
  cosas.
- **Un archivo nuevo del proyecto `fast` con nombre de medición**: la regla es de la durabilidad; lo del
  proyecto `fast` ya corre siempre, y la verificación no debe reclamar sobre eso.
- **Dos verificaciones escribiendo el mismo almacén**: el proyecto ya corre un archivo a la vez por esa
  razón, y la forma nueva de ejecutarlo no puede cambiarlo.
- **La máquina donde corre CI es más chica que la de desarrollo**: las pruebas de comportamiento no miran
  el reloj, así que no les importa; las que sí, por eso quedan afuera.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La verificación de un cambio MUST ejecutar las pruebas de durabilidad **de comportamiento**,
  siempre, sin depender de qué archivos cambiaron.
- **FR-002**: El resultado de esa ejecución MUST identificarse por sí mismo, distinguible de los demás
  gates sin leer su detalle.
- **FR-003**: La verificación de un cambio MUST NOT darse por aprobada si la verificación de durabilidad no
  terminó.
- **FR-004**: Las pruebas que **miden** (una cifra contra un techo) MUST quedar fuera de lo que decide si un
  cambio entra, y MUST estar declaradas como tales en un lugar que una verificación lee.
- **FR-005**: Toda prueba de durabilidad MUST pertenecer exactamente a una de las dos categorías —lo que
  decide o lo que mide—, y el build MUST fallar nombrando el archivo que no pertenezca a ninguna.
- **FR-006**: El build MUST fallar si algo declarado como medición no existe: la declaración se verifica en
  los dos sentidos.
- **FR-007**: MUST existir una forma de ejecutar las mediciones e informar sus cifras, y su resultado MUST
  NOT bloquear un cambio.
- **FR-008**: La cobertura de los gateways durables MUST NOT depender de la herramienta de mutación: lo que
  esa herramienta ejecute es su asunto, y si deja de incluir la suite, nada de esta feature cambia.
- **FR-009**: Las pruebas de durabilidad MUST seguir ejecutándose de a un archivo a la vez, cada una con su
  propio almacén.
- **FR-010**: Lo que esta feature decide sobre dónde corre cada cosa MUST quedar escrito donde se busca —las
  instrucciones del repositorio y el inventario de `tests/`— y no sólo en una configuración.

### Key Entities

- **Prueba de comportamiento de durabilidad**: afirma una garantía que sólo se ve cruzando un reinicio
  (lectura, idempotencia, aislamiento, degradación, plan de consulta, unidad de trabajo). No mira el reloj.
- **Prueba de medición**: informa una cifra y la compara contra un techo medido en una máquina concreta. Su
  valor es la tendencia, no el veredicto.
- **Declaración de mediciones**: la lista de las pruebas que miden, con su motivo, que la verificación lee en
  los dos sentidos.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **Un cambio que rompe una garantía de un gateway durable no entra**, y lo que lo rechaza
  nombra la durabilidad: verificable rompiendo una garantía a propósito y leyendo el nombre del fallo.
- **SC-002**: **Ninguna prueba del repositorio queda sin ejecutar por olvido**: verificable agregando un
  archivo de durabilidad fuera de las dos categorías y viendo fallar el build con su nombre.
- **SC-003**: **Las tres pruebas que hoy no corren en ningún lado quedan declaradas y ejecutables**:
  verificable corriendo el comando de mediciones y viendo sus cifras.
- **SC-004**: **La verificación de un cambio no tarda más en el reloj de pared** que antes de la feature:
  verificable comparando la duración total de una verificación contra la de la última antes del cambio.
- **SC-005**: **Nada de lo que hoy se verifica deja de verificarse**: el conjunto de pruebas que decide
  crece, no se mueve.
- **SC-006**: **Lo decidido está escrito donde alguien lo busca**: verificable leyendo las instrucciones del
  repositorio y el inventario de `tests/` sin abrir ninguna configuración.

## Assumptions

- La máquina donde corre la verificación es más chica que la de desarrollo, así que una medición con techo
  calibrado acá no se puede exigir allá. Es la razón de la decisión 2, y si algún día se quisiera exigir,
  el techo se recalibra con su propia evidencia (el precedente es ADR-038).
- Las 20 pruebas de comportamiento no miran el reloj. Si alguna lo hiciera, pertenece a la otra categoría y
  la verificación de FR-005 es la que lo va a decir.
- El costo de ejecutar la durabilidad en la verificación es aceptable mientras el reloj de pared lo siga
  dominando otra cosa. Si eso cambia, lo que cambia es dónde corre, no si corre.

## Out of Scope

- **Cambiar los techos de las tres mediciones**: esta feature decide dónde corren, no qué afirman.
- **Node 20 y `ubuntu-latest` en las acciones de CI** (**D-25**): vence por calendario y es otra feature.
- **Acelerar la durabilidad**: los 207 s son el precio de que cada archivo tenga su propio almacén, que es
  una decisión de la feature 030 y sigue en pie.
- **Que la herramienta de mutación deje de ejecutar la suite de durabilidad en su arranque**: lo hace por su
  propia necesidad —juzgar un mutante de un gateway durable— y esta feature no le cambia nada.
