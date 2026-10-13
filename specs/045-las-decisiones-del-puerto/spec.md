# Feature Specification: Las decisiones que el puerto dejó abiertas

**Feature Branch**: `045-las-decisiones-del-puerto`

**Created**: 2026-10-13

**Status**: Construida (2026-10-13)

**Input**: La enmienda del 2026-10-13 de ADR-047, decidida con el dueño punto por punto: tres cambios de
comportamiento sobre lo que construyó la feature 044 (el puerto de plataforma) y uno que se confirma sin cambio.
El primero lo encontró la corrida a mano del `quickstart.md` de la 044.

## Por qué existe

La 044 construyó los tres modos del puerto, y al construirlos aparecieron cuatro preguntas que el plan no
respondía. Se respondieron con el dueño; tres cambian lo que hoy pasa:

- **Una orden leída dos veces aparece como un conflicto.** Cuando la plataforma no dice cuándo confirmó una orden,
  OPE usa el instante en que la observó. Leerla otra vez —un aviso repetido, un lote releído después de un
  reinicio— trae otro instante, y OPE la ve como una orden distinta con el mismo identificador: no la duplica,
  pero lo registra como un rechazo y no la cuenta. Lo que ve un operador dice que algo falló cuando nada falló.
- **Una devolución que llega antes que su orden se pierde.** Una corrida de `pull` que lee una devolución de una
  orden que OPE todavía no tiene la rechaza, la deja atrás y no la vuelve a mirar, aunque la orden llegue un
  minuto después. Una devolución perdida es una venta que la medición cuenta como buena.
- **Un catálogo que falla espera un día entero.** Una corrida que falla vuelve a intentarse recién en su próxima
  cadencia; para el catálogo, eso es un día sin la foto que la decisión necesita.

## Lo decidido antes de la spec

1. **El instante dice su origen** (ADR-047, enmienda, punto 1): si el instante de una orden o de una devolución
   lo dio la plataforma o lo puso la observación de OPE. Uno observado no cuenta para decidir si dos lecturas son
   la misma.
2. **Un rechazo no frena el flujo, salvo el que el tiempo resuelve** (punto 2): sólo la devolución de una orden
   que todavía no está se reintenta, y se reintenta como un aviso de devolución, con la misma espera, los mismos
   intentos y el mismo rastro.
3. **Una corrida que falla se reintenta a la espera del aviso** (punto 3): `noticeRetry.afterMs`, sin tope; la
   que sale bien espera su cadencia. No hay un valor de configuración nuevo.
4. **El temporizador no cambia** (punto 4): corre por primera vez al primer tick después de leer los niveles.
5. **Nada de esto toca el camino de decisión** (`01` §4.6): sigue leyendo sólo lo guardado.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Una orden leída dos veces es una sola, y se cuenta como repetida (Priority: P1)

Un merchant cuya plataforma no informa cuándo confirmó una orden recibe la misma orden por dos caminos —un aviso
repetido, o un lote que se vuelve a leer después de un reinicio—. OPE la registra una vez, la segunda lectura
cuenta como repetida, y ni el log ni el estado del flujo dicen que hubo un rechazo. Lo mismo para una devolución.

**Why this priority**: es lo único de los tres que hoy produce un efecto visible y engañoso: un operador que mira
el estado de la sincronización ve rechazos que no existen, y una corrida que depositó todo dice que depositó menos.

**Independent Test**: con la fuente de prueba, una orden sin instante leída en dos corridas: queda una, la segunda
cuenta como depositada y no hay ningún rechazo en el log; la misma orden con otro total sigue siendo un conflicto.

**Acceptance Scenarios**:

1. **Given** una orden confirmada que la plataforma entrega sin instante, **When** OPE la lee dos veces,
   **Then** queda registrada una vez, con el instante de la primera lectura, y la segunda cuenta como repetida.
2. **Given** esa orden ya registrada, **When** se lee otra vez con un total o unos ítems distintos, **Then** es
   un conflicto, como hoy, y queda la primera.
3. **Given** una orden registrada con el instante que dio la plataforma, **When** se lee otra vez sin instante,
   **Then** es la misma orden: el instante observado no cuenta.
4. **Given** una devolución sin instante de la plataforma, **When** se lee dos veces, **Then** queda una y la
   segunda es repetida.
5. **Given** una orden que llega por `push`, que siempre declara su instante, **When** llega dos veces con
   instantes distintos, **Then** es un conflicto, como hoy.

---

### User Story 2 - Una devolución que llega antes que su orden no se pierde (Priority: P2)

Un merchant en `pull` de devoluciones tiene una devolución que su plataforma informa antes de que OPE haya
registrado la orden. OPE no la descarta: la vuelve a intentar con la espera de los avisos, y la registra cuando la
orden llega; si la orden no llega nunca, al agotar los intentos la descarta dejando rastro.

**Why this priority**: una devolución perdida cambia la medición (una venta que volvió cuenta como buena), pero
pasa sólo cuando la devolución adelanta a la orden, que es un caso de borde del orden de lectura.

**Independent Test**: con la fuente de prueba, devoluciones en `pull` y órdenes en otro modo; la devolución se lee
antes de que la orden exista; cuando la orden entra, la devolución queda vinculada en el intento siguiente.

**Acceptance Scenarios**:

1. **Given** una devolución leída por `pull` de una orden que OPE no tiene, **When** la corrida termina,
   **Then** la devolución queda pendiente de reintento, el cursor avanza y nada se registra todavía.
2. **Given** esa devolución pendiente, **When** la orden llega y vence el reintento, **Then** la devolución se
   registra vinculada a su orden.
3. **Given** esa devolución pendiente, **When** se agotan los intentos sin que la orden llegue, **Then** se
   descarta y deja rastro en el log y en el estado del flujo, igual que un aviso agotado.
4. **Given** un aviso de devolución (`subscribe`) cuya orden OPE todavía no tiene, **When** se lee, **Then** no se
   da por terminado: se reintenta igual que si la plataforma no hubiera respondido.
5. **Given** cualquier otro rechazo de una orden o una devolución durante una corrida, **When** ocurre,
   **Then** se loguea y la corrida sigue, como hoy.

---

### User Story 3 - Una corrida que falla se reintenta pronto (Priority: P3)

Un merchant en `pull` cuya plataforma no responde un rato no espera la cadencia entera del flujo para volver a
intentar: OPE reintenta a la espera de los avisos, sin tope, y cuando una corrida sale bien el flujo vuelve a su
cadencia.

**Why this priority**: importa sobre todo para el catálogo, cuya cadencia es de un día; para los flujos de
minutos, la diferencia es chica.

**Independent Test**: un catálogo en `pull` cuya fuente falla: se reintenta a la espera configurada y no al día;
cuando la fuente vuelve, la corrida sale bien y la siguiente espera un día.

**Acceptance Scenarios**:

1. **Given** una corrida de catálogo que falla, **When** pasa la espera de reintento, **Then** se corre otra vez,
   aunque no haya pasado la cadencia del catálogo.
2. **Given** una plataforma que sigue sin responder, **When** se reintenta, **Then** cada intento espera lo mismo y
   ninguno se corre en cada tick.
3. **Given** una corrida que sale bien después de fallar, **When** pasa la espera de reintento, **Then** no se
   corre de nuevo hasta su cadencia.
4. **Given** un flujo cuya cadencia es más corta que la espera de reintento, **When** su corrida falla, **Then**
   se reintenta a su cadencia.

---

### Edge Cases

- **Las dos lecturas con instante de la plataforma, distintos**: es un conflicto, como hoy; la plataforma no corrige
  un instante sin que sea otra orden.
- **Una orden registrada antes de esta feature**: no dice el origen de su instante. Se trata como dado por la
  plataforma —lo que es cierto de todo lo que llegó por `push`—. Una relectura sin instante de una orden de `pull`
  registrada antes es igual la misma, porque basta con que una de las dos lecturas tenga el instante observado; una
  repetición por `push` con otro instante sigue siendo conflicto, como hoy.
- **Una devolución pendiente de reintento cuya orden pertenece a otro merchant**: nunca se vincula; para OPE esa
  orden no existe en este merchant, y la devolución se agota con rastro.
- **La misma devolución leída otra vez mientras está pendiente**: es la misma pendiente, como un aviso repetido.
- **Un merchant que cambia devoluciones de `pull` a `push` con una devolución pendiente**: el reintento pasa por
  la compuerta del modo como cualquier lectura de aviso; si la devolución ya no llega por un modo que rige, se
  descarta con rastro.
- **Un reinicio con reintentos pendientes**: las devoluciones pendientes sobreviven, como los avisos; el reintento
  de una corrida fallida se calcula de lo guardado (cuándo empezó la última y cómo terminó), así que también.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Una orden y una devolución MUST registrar si su instante (de confirmación, de devolución) lo dio la
  plataforma o lo puso la observación de OPE.
- **FR-002**: Al decidir si dos lecturas de una orden son la misma, el instante MUST contar sólo si los dos lo dio
  la plataforma; el resto de lo que mandó la plataforma (identificador, total, ítems, sesión, incentivo) cuenta
  siempre. Lo mismo para una devolución, con sus ítems.
- **FR-003**: Una segunda lectura que resulta la misma MUST contarse como repetida: entra en el conteo de la
  corrida y no se loguea como rechazo.
- **FR-004**: Lo que llega por `push` MUST seguir declarando su instante, y su comportamiento ante una repetición
  MUST no cambiar.
- **FR-005**: Una orden o devolución registrada antes de esta feature MUST leerse como de instante dado por la
  plataforma.
- **FR-006**: Una devolución leída por `pull` que el núcleo rechaza porque su orden no existe MUST quedar pendiente
  de reintento con la espera, los intentos y el rastro de un aviso de devolución, y la corrida MUST seguir y
  avanzar su cursor. Un aviso de devolución con el mismo rechazo MUST reintentarse, no darse por terminado.
- **FR-007**: El resto de los rechazos de una corrida MUST seguir logueándose sin frenar el flujo, y la
  indisponibilidad del almacén MUST seguir cortando la corrida sin mover el cursor.
- **FR-008**: Una corrida de `pull` que falla MUST volver a correr cuando pase la espera de reintento de avisos del
  merchant, o su cadencia si es más corta, contada desde que empezó; una que sale bien MUST esperar su cadencia.
- **FR-009**: El reintento de una corrida MUST no tener tope de intentos y MUST no correr en cada tick.
- **FR-010**: Toda devolución pendiente y todo reintento MUST sobrevivir un reinicio.
- **FR-011**: Ninguna lectura de plataforma MUST ocurrir en el camino de decisión.
- **FR-012**: Una devolución pendiente de un merchant MUST no vincularse nunca a una orden de otro.

### Key Entities

- **Orden** y **devolución** (existen): ganan el **origen de su instante** (la plataforma, o la observación de
  OPE).
- **Aviso** (existe): la devolución huérfana de una corrida de `pull` se guarda como un aviso de devolución.
- **Estado de un flujo** (existe): su último resultado decide si la próxima corrida espera la cadencia o el
  reintento.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Una orden y una devolución sin instante, leídas cualquier cantidad de veces, quedan registradas una
  vez cada una, y ninguna relectura aparece como rechazo en el log ni en el estado del flujo.
- **SC-002**: Una devolución que adelanta a su orden queda registrada a lo sumo una espera de reintento después de
  que la orden llega, siempre que la orden llegue antes de agotar los intentos.
- **SC-003**: Un catálogo cuya corrida falla vuelve a intentarse en la espera de reintento (un minuto con los
  valores iniciales), no en su cadencia de un día; con la plataforma caída, ninguna corrida se intenta más de una
  vez por espera.
- **SC-004**: Con dos merchants, nada de lo que se reintenta para uno se registra en el otro.
- **SC-005**: Una decisión responde igual con reintentos pendientes y con una fuente que no responde.

## Assumptions

- Las cifras de espera y de intentos son las de `noticeRetry` de cada merchant; esta feature no agrega valores de
  configuración ni cambia el contrato de los niveles.
- El cambio de la orden y la devolución no toca el contrato HTTP: el origen del instante no se expone en las
  respuestas.
- La devolución huérfana se reintenta cuando llega por `pull` y cuando llega por `subscribe`: el plan encontró que el
  lector de avisos también la daba por terminada (research R-02). Por `push` la plataforma recibe la respuesta y
  reintenta ella.
- La salud de la sincronización y sus alertas son de la feature siguiente, en el hito `observability`.
