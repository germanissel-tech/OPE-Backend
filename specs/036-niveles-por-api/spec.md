# Feature Specification: Los niveles 1 y 2 se configuran por API, como el nivel merchant

**Feature Branch**: `036-niveles-por-api`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Decisión del dueño, 2026-09-30: «todo se tiene que poder configurar desde el panel
administrador», con el trato de congelamiento del nivel merchant escalado a los niveles 1 y 2.

## Por qué existe

El panel de administración puede publicar la configuración **de un merchant**, pero los dos niveles que
están por encima —las reglas de la plataforma y los defaults de tratamiento— sólo se cambian con un
deploy. ADR-031 lo decidió así con un motivo real: «su radio es multitenant: un cambio contaminaría todos
los experimentos».

**El motivo es cierto y la protección no existe.** El ADR nunca comparó contra la alternativa que dejó en
pie, y el deploy hace el mismo daño, peor y sin dejar rastro:

|                                             | Hoy, por deploy                                                                            | Por API                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| Contamina experimentos activos              | sí                                                                                         | sí, y **exige un motivo declarado**   |
| Reinicia el servidor con merchants operando | sí                                                                                         | no                                    |
| Queda versionado                            | sólo si alguien recuerda cambiar la versión a mano; una huella lo obliga en 2 de 22 campos | siempre: versión numerada e inmutable |
| Queda en el registro de administración      | **no**, de ninguna forma                                                                   | sí: actor, instante, motivo, versión  |
| Avisa que hay experimentos activos          | no                                                                                         | sí                                    |
| Reinicia la ventana de medición             | **no**: el experimento sigue partido en dos tratamientos                                   | sí, explícitamente                    |

Un cambio de `holdoutShare` o de `dedupWindow` por deploy hoy no deja constancia en ninguna parte y no
reinicia ninguna ventana: el experimento sigue corriendo como si nada y su número deja de significar lo
que dice. Esta feature no agrega el riesgo — lo pone bajo reglas.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Los defaults de tratamiento se publican por API (Priority: P1)

Un operador ajusta desde el panel los defaults de tratamiento de la plataforma —la política de decisión,
la comercial, el presupuesto de frescura, el holdout, los umbrales de sincronización— y el cambio vale
desde la siguiente petición, sin reiniciar nada, como una versión numerada que queda registrada.

**Why this priority**: es el nivel que el operador realmente quiere tocar —es el tratamiento— y es el que
hoy sólo se puede cambiar con un deploy que no deja rastro. Con esta historia sola, el panel ya sirve para
preparar un piloto.

**Independent Test**: publicar una versión de defaults por la API, comprobar que la resolución la usa en
la petición siguiente sin reiniciar, que quedó una versión numerada y una entrada en el registro.

**Acceptance Scenarios**:

1. **Given** un valor de defaults vigente, **When** un operador publica una versión que lo cambia,
   **Then** se crea la versión siguiente, la resolución la usa desde la próxima petición y el registro de
   administración tiene la entrada con actor, instante y versión resultante.
2. **Given** una versión publicada, **When** se publica un cuerpo idéntico, **Then** no se crea una
   versión nueva y la respuesta lo dice, como ya hace el nivel merchant.
3. **Given** un valor inválido según las invariantes del código (una tasa fuera de 0–1, una escalera que
   no crece), **When** se publica, **Then** se rechaza nombrando el campo y **no** se crea ninguna versión.
4. **Given** un merchant que sobrescribe un campo, **When** cambia el default de ese campo, **Then** la
   configuración efectiva de ese merchant **no** cambia: lo que él declara sigue ganando.
5. **Given** que el almacén no puede escribir, **When** se publica, **Then** la operación falla y no queda
   ni la versión ni la entrada de auditoría — ni a medias.

---

### User Story 2 - Un cambio con un experimento activo exige su motivo y reinicia la ventana (Priority: P1)

Un operador intenta cambiar un default mientras hay experimentos activos. El sistema **se niega** y le
dice por qué; si el operador insiste declarando el motivo, el cambio entra como **versión correctiva**, la
ventana de medición de cada experimento alcanzado se reinicia, y todo eso queda en el registro.

**Why this priority**: es la mitad que hace aceptable la historia 1. Sin esto, el panel le da a un
operador la posibilidad de arruinar una medición en curso sin que nada se lo diga — que es exactamente lo
que pasa hoy con el deploy, y no es a lo que se aspira.

**Independent Test**: con un experimento activo, publicar sin motivo (rechazo con su problema) y después
con motivo, comprobando que la ventana del experimento se reinició y que la entrada del registro lleva el
motivo.

**Acceptance Scenarios**:

1. **Given** un experimento activo alcanzado por el cambio, **When** se publica **sin** motivo, **Then**
   se rechaza con el problema de configuración congelada y no se crea ninguna versión.
2. **Given** ese mismo caso, **When** se publica **con** motivo, **Then** se crea la versión, la ventana
   de medición de cada experimento alcanzado se reinicia, y el registro guarda el motivo.
3. **Given** un experimento activo de un merchant que **sobrescribe** todos los campos que cambian,
   **When** se publica, **Then** ese experimento **no** se considera alcanzado: su ventana no se reinicia.
4. **Given** ningún experimento activo, **When** se publica, **Then** no hace falta motivo y nada se
   reinicia.
5. **Given** un experimento en calibración, **When** se publica, **Then** no bloquea ni se reinicia: sus
   decisiones ya están excluidas del análisis.

---

### User Story 3 - Las reglas de la plataforma se publican por API (Priority: P2)

Un operador ajusta desde el panel las reglas de la plataforma —ventanas de sesión y de visitante,
deduplicación, tolerancias de reloj, ventana de firma, gracia de rotación, cuánto se retiene de las
observaciones, el `retry-after`— y el cambio vale desde la siguiente petición, sin reiniciar.

**Why this priority**: es el nivel que completa la promesa «todo se configura desde el panel», y va
después porque cuesta más: hoy cada uno de estos valores **se le entrega a un componente cuando el
servidor se construye**, así que no alcanza con guardarlo — hay que hacer que se lea en el momento de
usarlo.

**Independent Test**: publicar una versión de plataforma que cambie una ventana y comprobar, **sin
reiniciar**, que el comportamiento que depende de ella cambió en la petición siguiente.

**Acceptance Scenarios**:

1. **Given** una ventana de deduplicación vigente, **When** un operador publica una versión que la
   cambia, **Then** la deduplicación de la petición siguiente usa el valor nuevo, sin reiniciar.
2. **Given** una retención de observaciones vigente, **When** se publica una menor, **Then** lo que se
   conserva a partir de ahí es la nueva, sin reiniciar.
3. **Given** un `retry-after` vigente, **When** se publica otro, **Then** la próxima respuesta que lo
   incluya lleva el valor nuevo.
4. **Given** un campo de plataforma que gobierna la medición (las ventanas, la deduplicación), **When**
   hay un experimento activo, **Then** aplica la regla de la historia 2.
5. **Given** un cambio de plataforma, **When** el SDK pide su configuración, **Then** recibe el valor
   nuevo en su próximo pedido, y el contrato de esa respuesta no cambia de forma.

---

### User Story 4 - El historial de cada nivel se puede ver (Priority: P3)

Un operador abre en el panel el historial de un nivel y ve sus versiones: cuándo, quién, con qué motivo
cuando lo hubo, y qué cambió respecto de la anterior.

**Why this priority**: sin esto se puede publicar pero no explicar. Es P3 porque el registro de
administración ya deja la traza de cada publicación; lo que esta historia agrega es verla ordenada por
nivel en vez de reconstruirla del registro general.

**Independent Test**: publicar dos versiones de un nivel y comprobar que el historial las lista, más
nueva primero, con su actor y su motivo.

**Acceptance Scenarios**:

1. **Given** varias versiones publicadas, **When** un operador pide el historial de ese nivel, **Then**
   las recibe de la más nueva a la más vieja, paginadas, con versión, instante, actor y motivo.
2. **Given** una versión concreta, **When** un operador la pide, **Then** recibe su contenido tal como se
   publicó, inmutable.

---

### Edge Cases

- **La semilla del arranque.** Los dos archivos del release dejan de ser la fuente y pasan a ser
  **semilla**: se importan sólo si el almacén está vacío, como los merchants. Un arranque que encuentra
  los niveles ya guardados **no aplica el archivo** y lo dice en el log; editar el archivo después del
  primer arranque no hace nada, y la forma de cambiar un valor es la API.
- **Un cambio que alcanza a todos los merchants.** Es lo normal de estos niveles, y lo que hay que
  verificar es que los alcanza **de la misma forma**: ningún valor de un merchant se filtra a otro, y
  ningún merchant queda con una versión efectiva que no le corresponde.
- **Un valor de seguridad más corto.** Acortar la ventana de firma o la gracia de rotación invalida
  credenciales o firmas que un cliente estaba usando legítimamente. Vale desde la petición siguiente y es
  el operador quien decide; queda en el registro como cualquier otro cambio.
- **Dos publicaciones a la vez.** Dos versiones del mismo nivel no pueden quedar con el mismo número:
  numerar y escribir es una sola cosa, como en el nivel merchant.
- **El número de versión ya no se declara.** Hoy cada archivo trae su propio campo de versión y nada
  obliga a cambiarlo cuando el contenido cambia. Con la API, **la versión la acuña OPE** y es correlativa;
  lo que el operador declara es el contenido y, cuando hace falta, el motivo.
- **Un reinicio después de varias publicaciones.** El servidor arranca con la última versión de cada
  nivel, no con el archivo. Lo único que el archivo decide es el contenido inicial de un almacén vacío.
- **Dos procesos.** Fuera de alcance como en todo el hito (**D-21**): una instancia. Con dos, cada una
  tendría su propia copia en memoria de la configuración efectiva y un cambio no alcanzaría a la otra.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Un operador MUST poder publicar una versión nueva del nivel de defaults de tratamiento por
  la API de administración, y otra del nivel de plataforma.
- **FR-002**: Cada publicación MUST crear una versión **numerada por OPE, correlativa e inmutable**; el
  operador declara contenido, no número de versión.
- **FR-003**: Un cuerpo idéntico a la versión vigente MUST NOT crear una versión nueva, y la respuesta
  MUST decirlo — el mismo trato que el nivel merchant.
- **FR-004**: Una publicación MUST valer desde la petición siguiente **sin reiniciar el servidor**,
  incluidos los valores que hoy se entregan a un componente cuando el servidor se construye.
- **FR-005**: Un valor que viole una invariante del código MUST rechazarse nombrando el campo, y **no**
  MUST crearse ninguna versión.
- **FR-006**: Con al menos un experimento **activo alcanzado** por el cambio, una publicación sin motivo
  MUST rechazarse con el problema de configuración congelada.
- **FR-007**: Un experimento está **alcanzado** cuando al menos uno de los campos que cambian resuelve,
  para su merchant, **desde el nivel que cambió**. Un merchant que sobrescribe todos los campos que
  cambian MUST NOT quedar alcanzado.
- **FR-008**: Una publicación con motivo declarado MUST crear la versión, MUST reiniciar la ventana de
  medición de **cada** experimento alcanzado, y el motivo MUST quedar en el registro de administración.
- **FR-009**: Un experimento en calibración MUST NOT bloquear una publicación ni reiniciar nada.
- **FR-010**: Toda publicación MUST quedar en el registro de administración con actor, instante,
  operación, resultado, versión resultante y motivo cuando lo hubo; y una publicación que no se pueda
  auditar MUST NOT ocurrir.
- **FR-011**: El alcance del operador MUST juzgarse como en toda operación de administración. Un cambio de
  estos niveles alcanza a todos los merchants, así que MUST exigir un operador de alcance total.
- **FR-012**: Los archivos del release MUST pasar a ser **semilla**: se importan sólo cuando el almacén
  del nivel está vacío, a nombre del operador del sistema, y un arranque que no los aplica MUST decirlo.
- **FR-013**: Las versiones de cada nivel MUST sobrevivir un reinicio, y el arranque MUST usar la última.
- **FR-014**: Un operador MUST poder listar las versiones de cada nivel, más nueva primero y paginadas, y
  MUST poder leer una versión concreta tal como se publicó.
- **FR-015**: La resolución de la configuración efectiva MUST seguir sirviéndose desde memoria: el camino
  de decisión MUST NOT ganar I/O por esta feature.
- **FR-016**: Un cambio de nivel MUST alcanzar a los merchants **de la misma forma**, sin filtrar ningún
  valor declarado de un merchant a otro.
- **FR-017**: Lo que el SDK recibe MUST seguir teniendo la misma forma; lo que cambia es el valor.

### Key Entities

- **Versión de un nivel**: el contenido de un nivel tal como quedó en un momento, con su número correlativo,
  su actor, su instante y su motivo cuando lo hubo. Inmutable. Es lo mismo que ya es una versión de
  configuración de merchant, un nivel más arriba.
- **Nivel**: el ámbito de un valor — plataforma, defaults de tratamiento, merchant— y el orden en que se
  resuelven. No cambia; lo que cambia es de dónde sale el contenido de los dos primeros.
- **Experimento alcanzado**: el que mide un tratamiento que este cambio modifica, porque al menos un campo
  que cambió resuelve para su merchant desde el nivel que cambió.
- **Motivo**: lo que el operador declara cuando cambia algo con experimentos activos. Es donde queda
  escrito que sabía lo que hacía, y por eso es obligatorio en ese caso y se conserva.
- **Semilla**: el contenido inicial de un nivel, que viene de un archivo del release y se aplica una sola
  vez, sobre un almacén vacío.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **Los 22 valores de los dos niveles se cambian desde la API**, y cada uno tiene una prueba
  que lo cambia y observa el efecto sin reiniciar el servidor. Lo que no pueda, queda nombrado con su
  motivo — y la spec no espera que haya ninguno.
- **SC-002**: **Ningún cambio de nivel requiere un reinicio**: verificable publicando y observando el
  comportamiento nuevo en la petición siguiente, en el mismo proceso.
- **SC-003**: **Un cambio con experimentos activos no pasa desapercibido**: sin motivo se rechaza; con
  motivo, cada experimento alcanzado tiene su ventana reiniciada y el motivo queda en el registro.
  Verificable contando experimentos alcanzados y no alcanzados en la misma corrida.
- **SC-004**: **Todo cambio queda explicable a partir del registro**: para cualquier versión publicada se
  puede decir quién, cuándo, qué cambió y por qué, sin mirar el código ni los archivos del release.
- **SC-005**: **La medición sigue siendo segmentable**: cada decisión sigue estampando la terna de
  versiones, así que el análisis puede separar antes y después de cada cambio.
- **SC-006**: **El camino de decisión no paga nada**: el p95 de la ingesta no empeora de forma apreciable
  contra la misma corrida antes de la feature, medido en la misma máquina.
- **SC-007**: **El aislamiento entre merchants se conserva**, verificado a través de un cambio de nivel
  que alcanza a varios: lo que cada merchant declara sigue ganando y nada se cruza.
- **SC-008**: **Nada del comportamiento existente cambia** salvo de dónde sale el contenido de los dos
  niveles: las operaciones de administración responden lo mismo y ninguna prueba anterior cambia de
  expectativa, salvo las que afirmaban que estos niveles no se podían escribir.
- **SC-009**: **Un arranque sobre un almacén que ya tiene los niveles no aplica el archivo y lo dice**,
  verificable arrancando dos veces y leyendo el log.

## Assumptions

- **La resolución sabe de qué nivel vino cada valor.** ADR-031 dice que los tres niveles se resuelven
  «valor por valor», así que decidir si un merchant está alcanzado por un cambio es una consulta sobre lo
  que ya se calcula. El plan lo confirma leyendo el código; si no estuviera disponible, la alternativa es
  considerar alcanzados a **todos** los experimentos activos, que es más conservador y más fácil de
  explicar, y la spec lo acepta como salida declarada.
- **El nivel de defaults ya se lee por un puerto** y el de plataforma también, para la resolución; lo que
  no está preparado son los **otros** consumidores del nivel de plataforma, que reciben su valor cuando el
  servidor se construye. Esa es la mayor parte del trabajo de la historia 3.
- **El contrato admite la superficie nueva.** Está marcado como en construcción, así que un cambio
  incompatible se acepta y se reporta; aun así lo que el SDK recibe conserva su forma (FR-017).
- **Una instancia** (**D-21**). La configuración efectiva vive en memoria y un cambio alcanza a este
  proceso; con dos procesos haría falta invalidación entre ellos, que queda fuera.
- **El operador es responsable del cambio**, y el sistema no lo sustituye: le exige declarar el motivo
  cuando hay medición en curso, se lo registra, y reinicia lo que ese cambio invalidó.

## Fuera de alcance, con su motivo

- **Las cinco lecturas del portal** (resultados, acumulación, decisiones, exposiciones, órdenes): son el
  otro lado del panel y su esquema de autenticación sigue propuesto. Otra feature.
- **La otra mitad de D-29** (que el registro diga qué hizo con la semilla, no sólo que la importó): toca
  un esquema publicado del registro. Esta feature cierra la mitad de la semilla de los niveles.
- **Multi-instancia e invalidación entre procesos** (**D-21**).
- **Cambiar qué valores existen**: no se agrega ni se quita ningún campo de ningún nivel. Lo que cambia es
  quién los escribe.
- **Que el panel muestre el impacto estimado de un cambio** antes de aplicarlo: es una feature de producto
  sobre datos que esta feature no produce.
