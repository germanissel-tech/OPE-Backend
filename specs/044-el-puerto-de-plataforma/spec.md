# Feature Specification: El puerto de plataforma

**Feature Branch**: `044-el-puerto-de-plataforma`

**Created**: 2026-10-10

**Status**: Borrador

**Input**: Primer tramo del hito `platform-port` de `contracts/api-map.yaml` (constitución X; `02` §4 y §6): el
puerto de plataforma con sus cuatro operaciones, los modos `pull` y `subscribe` que hoy la configuración declara
y nada ejecuta, el refresco parcial de stock y precio, y el adaptador de prueba con una corrida de punta a punta.
La precede la verificación documental de Magento 2 y VTEX (`docs/verificacion-documental-plataformas.md`), cuyos
siete puntos `PROPUESTO` son entrada. El adaptador Magento 2 es la feature siguiente.

## Por qué existe

Hoy un merchant se conecta a OPE de una sola forma: su plataforma **empuja** el catálogo, cada orden y cada
devolución por HTTP firmado. Sirve para cualquier ecommerce capaz de hacer un POST, pero le pide al merchant que
programe. El principio comercial de `02` §6 es el contrario: conectar a cada merchant **con la menor fricción que
su plataforma permita**. Para Magento 2 y VTEX eso es que OPE **consulte** la API de la plataforma (`pull`) o
**escuche** los avisos que la plataforma ya publica (`subscribe`), sin que el merchant escriba código.

La configuración ya dice, flujo por flujo, en qué modo llega cada uno (`syncStrategy`). Pero un merchant
configurado en `pull` hoy no recibe nada: ningún componente lee esa configuración. Y el núcleo de OPE conoce el
`push` por su forma HTTP, no por un puerto; agregar la primera plataforma real sin el puerto metería sus
particularidades en el núcleo, que es lo que la constitución X prohíbe.

El adaptador de prueba es lo que permite construir y verificar todo esto **sin ninguna plataforma real**, y
ejercitar el circuito completo —evento, decisión, exposición, orden, atribución— con datos que llegan por los tres
modos (`02` §6.4).

## Lo decidido antes de la spec

1. **El puerto tiene cuatro operaciones y nada más** (constitución X; `02` §6.1): catálogo, stock y precio, orden
   confirmada, devolución registrada. El núcleo depende del puerto y no sabe qué plataforma hay detrás.
2. **El modo es por merchant y por flujo, y es configuración versionada** (`02` §6, DECIDIDO 2026-09-20). Se
   congela durante el piloto y queda estampado en la versión de configuración.
3. **Nunca se consulta la plataforma dentro del camino de decisión** (`01` §4.6). El planificador y el
   consumidor corren afuera; la decisión lee lo que ya está guardado.
4. **El perfil de datos se mide, no se declara** (`02` §4; ADR-025): el nivel efectivo sale de la observación.
5. **De la verificación documental**, esta feature adopta los puntos 1 a 5 (el refresco parcial por lotes, el
   instante de observación cuando la plataforma no lo da, el aviso que obliga a leer, el autenticador propio del
   aviso, y «confirmada» como configuración). Los puntos 6 (el precio que cobra Magento) y 7 (el módulo del
   identificador) son de la feature de Magento y de la conversación comercial.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OPE consulta la plataforma por su cuenta (Priority: P1)

Un operador configura un merchant con catálogo, stock y precio en `pull`. Sin que la plataforma envíe nada, OPE
trae el catálogo completo a su cadencia, refresca stock y precio por lotes a la suya, y la decisión usa esos
datos como hoy usa los del snapshot empujado. Si la plataforma deja de responder, los datos envejecen y el perfil
de datos del merchant baja solo.

**Why this priority**: es lo que habilita a Magento 2 y VTEX como plataformas sin código del merchant, y el
camino crítico del hito.

**Independent Test**: con el adaptador de prueba sirviendo un catálogo, configurar un merchant en `pull` para
catálogo y para stock y precio; esperar las corridas del planificador; comprobar que la verdad de producto del
merchant es la del adaptador, con el instante de cada ítem, y que su perfil de datos sube al nivel que esa
cadencia justifica.

**Acceptance Scenarios**:

1. **Given** un merchant con catálogo en `pull`, **When** corre el planificador, **Then** el catálogo del
   merchant es el que entregó la plataforma, igual que si lo hubiera empujado.
2. **Given** un merchant con stock y precio en `pull`, **When** corre el refresco, **Then** se actualizan sólo
   las variantes del lote consultado, cada una con su instante: el que dio la plataforma o, si no lo dio, el de
   la observación de OPE.
3. **Given** un catálogo más grande que un lote, **When** pasan las corridas, **Then** todas las variantes se
   refrescan en un ciclo, y el ciclo dura lo que la configuración del merchant permite.
4. **Given** la plataforma deja de responder, **When** pasa el tiempo, **Then** los datos envejecen, el nivel de
   sincronización baja como baja hoy con un `push` que se corta, y la decisión **calla** las familias que
   dependen de datos frescos.
5. **Given** una decisión en curso, **When** el planificador está consultando la plataforma, **Then** la
   decisión no espera ni lee de la plataforma: lee lo guardado.

---

### User Story 2 - Las órdenes y devoluciones llegan sin que la plataforma las empuje (Priority: P2)

Un merchant tiene órdenes y devoluciones en `pull`. OPE pregunta a la plataforma qué órdenes cambiaron, toma las
que el merchant considera **confirmadas** según su configuración, y las registra con su identificador de OPE y su
incentivo, como hoy las registra el `push`. Las devoluciones se vinculan a su orden.

**Why this priority**: la atribución es el resultado del producto; sin órdenes no hay medición. Va después del
catálogo porque sin decisión no hay orden que atribuir.

**Independent Test**: con el adaptador de prueba publicando órdenes en distintos estados, configurar el merchant
en `pull` para órdenes y declarar qué estado es «confirmada»; comprobar que se registran exactamente las que
cumplen, una vez cada una, y que una devolución posterior queda vinculada.

**Acceptance Scenarios**:

1. **Given** una orden en un estado que el merchant declaró «confirmada», **When** corre el planificador,
   **Then** la orden queda registrada con lo mismo que registra el `push`: monto, ítems, identificador de OPE e
   incentivo.
2. **Given** una orden que todavía no está en ese estado, **When** corre el planificador, **Then** no se
   registra; se registra en la corrida en que lo alcanza.
3. **Given** una orden ya registrada, **When** el planificador la vuelve a ver, **Then** no se registra dos
   veces.
4. **Given** una devolución de una orden registrada, **When** corre el planificador, **Then** queda vinculada a
   su orden como hoy por `push`.
5. **Given** el merchant cambia qué estado es «confirmada», **When** publica la versión de configuración,
   **Then** las corridas siguientes usan la regla nueva y la versión registra el cambio.

---

### User Story 3 - La plataforma avisa y OPE lee (Priority: P3)

Un merchant tiene órdenes en `subscribe`. Su plataforma manda un aviso por cada orden que cambia: sólo el
identificador y el estado. OPE autentica el aviso con una credencial del merchant pensada para eso, y **lee el
detalle de la orden por el adaptador**; lo que se registra viene de esa lectura, nunca del aviso.

**Why this priority**: reduce la latencia de las órdenes donde la plataforma ya publica eventos (VTEX), pero
`pull` alcanza para el piloto.

**Independent Test**: con el adaptador de prueba, mandar un aviso autenticado de una orden confirmada y
comprobar que se registra con el detalle leído; mandar un aviso sin credencial, o con datos que contradicen la
lectura, y comprobar que no entra nada del aviso.

**Acceptance Scenarios**:

1. **Given** un aviso autenticado de una orden, **When** llega, **Then** OPE lee la orden por el adaptador y la
   registra si está confirmada según la configuración.
2. **Given** un aviso sin credencial o con la de otro merchant, **When** llega, **Then** se rechaza y no se lee
   nada.
3. **Given** un aviso cuyo contenido no coincide con lo que la lectura devuelve, **When** se procesa, **Then**
   manda la lectura.
4. **Given** el mismo aviso repetido, **When** llega varias veces, **Then** la orden se registra una sola vez.
5. **Given** un merchant cuyo flujo de órdenes **no** está en `subscribe`, **When** llega un aviso, **Then** se
   rechaza: un modo no configurado no abre una puerta.
6. **Given** la plataforma no responde a la lectura que sigue al aviso, **When** se procesa, **Then** el aviso
   no se pierde: se reintenta, y el `pull` del mismo flujo, si lo hay, no depende de él.

---

### User Story 4 - El refresco parcial también se empuja (Priority: P4)

Una plataforma genérica que ya empuja el snapshot quiere empujar también los cambios de stock y precio, de a
pocas variantes, sin reenviar el catálogo entero.

**Why this priority**: completa la tabla de `02` §6 para el modo genérico; ningún candidato lo pide hoy.

**Independent Test**: empujar un refresco firmado de dos variantes con su instante; comprobar que cambian sólo
esas dos y que el resto del catálogo sigue igual.

**Acceptance Scenarios**:

1. **Given** un catálogo ya cargado, **When** se empuja un refresco firmado de algunas variantes, **Then**
   cambian sólo esas, cada una con su instante.
2. **Given** un refresco con una variante que el catálogo no tiene, **When** llega, **Then** esa variante se
   informa como desconocida y las demás entran.
3. **Given** un refresco con un instante más viejo que el que la variante ya tiene, **When** llega, **Then** no
   pisa el dato más nuevo.

---

### User Story 5 - El circuito completo sin ninguna plataforma real (Priority: P5)

Un desarrollador corre el sistema de punta a punta con el adaptador de prueba: el catálogo llega por `pull`, un
visitante genera eventos, OPE decide y el SDK confirma la exposición, la orden llega por `subscribe` con el
identificador de OPE, y la atribución la vincula a la decisión.

**Why this priority**: es la prueba de que el puerto alcanza, y la base para que cada adaptador nuevo se
verifique igual.

**Independent Test**: una prueba automática que recorre el circuito y afirma que la orden queda atribuida a la
decisión que la originó; y la misma corrida, a mano, sobre el servidor de desarrollo.

**Acceptance Scenarios**:

1. **Given** un merchant configurado con el adaptador de prueba, **When** se recorre el circuito, **Then** la
   orden queda atribuida a su decisión y exposición.
2. **Given** el mismo circuito con el catálogo empujado y la orden consultada, **When** se recorre, **Then** el
   resultado es el mismo: el núcleo no distingue el modo.

---

### Edge Cases

- **Un cambio de modo** de un flujo (de `push` a `pull`, o al revés) entra sólo por una versión de configuración,
  y desde ese momento el modo anterior deja de aceptarse para ese flujo: un `push` a un flujo en `pull` se
  rechaza con un problema que lo dice.
- **Un modo que nada ejecuta**: publicar una configuración con `subscribe` para catálogo o para stock y precio se
  rechaza, diciendo que ese modo no existe todavía para ese flujo; aceptarlo dejaría al merchant sin datos y sin
  aviso.
- **Dos corridas del planificador superpuestas** para el mismo merchant y flujo no deben pisarse: la segunda
  espera o se omite.
- **Un reinicio del servidor** en medio de un ciclo: lo que ya entró queda, y el ciclo sigue donde quedó o
  empieza de nuevo, sin duplicar órdenes.
- **Una plataforma que responde con errores o lento**: el planificador no cae, deja rastro del fallo por merchant
  y flujo, y reintenta a su cadencia, sin consultar más rápido que lo que la configuración permite.
- **Un merchant desactivado o con el interruptor apagado**: el planificador no lo consulta y los avisos se
  rechazan.
- **Lo que la plataforma devuelve viola la lista blanca** (un campo de dato personal, un formato que el contrato
  de datos no admite): no entra, y queda rastro.
- **Una orden sin identificador de OPE** se registra como hoy por `push` (sin atribución autoritativa); el
  mecanismo A sigue siendo la única fuente autoritativa (constitución X).
- **El adaptador de prueba** no puede quedar configurado para un merchant en un entorno de producción.
- **Aislamiento**: un adaptador consultado para un merchant nunca escribe en otro, y un aviso con la credencial
  de un merchant nunca dispara una lectura de otro.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: OPE MUST tener un puerto de plataforma con exactamente cuatro operaciones —catálogo, stock y precio,
  orden confirmada, devolución registrada— y el núcleo MUST recibir los datos por él sin saber qué plataforma ni
  qué modo los trajo.
- **FR-002**: El `push` existente MUST pasar por el puerto sin cambiar su contrato: lo que hoy acepta y responde
  sigue igual.
- **FR-003**: Para cada flujo de cada merchant, OPE MUST actuar según el modo que rige en su versión de
  configuración, y MUST rechazar la entrada por un modo que no es el configurado. Una versión que configura un modo que ningún
  componente ejecuta para ese flujo MUST rechazarse al publicarla.
- **FR-004**: En `pull`, un planificador MUST consultar la plataforma por cada flujo configurado así, a una
  cadencia que es configuración (constitución XI), fuera del camino de decisión.
- **FR-005**: El refresco de stock y precio en `pull` MUST recorrer el catálogo por lotes de tamaño configurable
  y refrescar sólo las variantes de cada lote.
- **FR-006**: Cada variante refrescada MUST llevar su instante: el que entrega la plataforma, o el de la
  observación de OPE si no lo entrega; y el perfil de datos MUST medirse con ese instante.
- **FR-007**: Un dato con instante más viejo que el guardado para la misma variante MUST NOT reemplazarlo.
- **FR-008**: Qué estados de una orden la hacen «confirmada» MUST ser configuración del merchant; OPE MUST
  registrar una orden traída por `pull` o `subscribe` sólo cuando cumple esa regla.
- **FR-009**: Una orden o devolución MUST registrarse una sola vez, llegue por el modo que llegue y cuantas veces
  la plataforma la vuelva a mostrar.
- **FR-010**: En `subscribe`, el aviso MUST autenticarse con una credencial del merchant propia de ese modo, y lo
  que se registra MUST salir de la lectura por el adaptador, nunca del contenido del aviso.
- **FR-011**: Un aviso que no puede completarse porque la plataforma no responde MUST reintentarse, sin perderse
  ante un reinicio.
- **FR-012**: El `push` MUST aceptar un refresco parcial de stock y precio, firmado como el resto del `push`,
  con instante por variante, y MUST informar las variantes que el catálogo no tiene.
- **FR-013**: Ninguna consulta a la plataforma MUST ocurrir dentro del camino de decisión, y una prueba MUST
  afirmarlo.
- **FR-014**: OPE MUST tener un adaptador de prueba que implemente las cuatro operaciones en cada modo que esta
  feature soporta para su flujo,
  guionable desde las pruebas y usable desde el servidor de desarrollo, y MUST impedir que se use en producción.
- **FR-015**: Lo que el planificador ya trajo MUST sobrevivir a un reinicio, y un reinicio MUST NOT duplicar
  órdenes ni devoluciones.
- **FR-016**: Cada fallo de una consulta o de un aviso MUST dejar rastro por merchant y flujo, sin datos
  personales.
- **FR-017**: Toda operación HTTP nueva (el aviso, el refresco parcial empujado, la credencial del aviso si la
  hay) MUST entrar primero al mapa del contrato y como cambio compatible.
- **FR-018**: Las pruebas MUST incluir el aislamiento entre merchants en los tres modos.
- **FR-019**: Una prueba automática MUST recorrer el circuito evento → decisión → exposición → orden →
  atribución con el adaptador de prueba.

### Key Entities

- **Puerto de plataforma**: las cuatro operaciones por las que entra al núcleo todo lo que viene de la plataforma
  del merchant.
- **Adaptador**: la traducción de una plataforma al puerto. Esta feature trae dos: el genérico (el `push` que ya
  existe) y el de prueba.
- **Estrategia de sincronización**: para cada merchant y flujo, el modo que rige; parte de la versión de
  configuración.
- **Corrida del planificador**: una consulta de un flujo de un merchant; su resultado (cuántos ítems, fallo) y su
  instante quedan registrados.
- **Cursor de un flujo**: dónde quedó el recorrido de un merchant (el último lote de variantes, el último cambio de
  órdenes visto), para seguir después de un reinicio.
- **Aviso**: la notificación de la plataforma en `subscribe`; dice qué cambió, no qué es.
- **Regla de confirmación**: los estados de orden que el merchant considera confirmada.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un merchant configurado en `pull` para los cuatro flujos tiene catálogo, stock y precio, órdenes y
  devoluciones sin que su plataforma envíe nada, y el núcleo produce las mismas decisiones y atribuciones que con
  los mismos datos empujados.
- **SC-002**: En un catálogo de N variantes con lotes de tamaño L, cada variante se refresca al menos una vez cada
  ⌈N/L⌉ corridas.
- **SC-003**: Ninguna orden se registra dos veces en ningún modo, también después de un reinicio y con avisos
  repetidos.
- **SC-004**: Ningún dato que llega en un aviso se registra si la lectura no lo confirma.
- **SC-005**: El tiempo de una decisión no cambia porque el planificador esté corriendo o la plataforma esté
  caída.
- **SC-006**: Ninguna prueba de aislamiento existente deja de pasar, y las nuevas cubren los tres modos.
- **SC-007**: El circuito completo se recorre con el adaptador de prueba sin ninguna plataforma real, en una
  prueba automática y a mano.

## Supuestos

- El planificador corre dentro del mismo proceso que el servidor, fuera del camino de decisión; separarlo en otro
  proceso es una decisión de despliegue posterior.
- La cadencia de cada flujo, el tamaño del lote y los reintentos son valores de configuración, con defaults de
  tratamiento que un merchant puede pisar (constitución XI, ADR-031).
- La credencial con la que OPE consulta una plataforma real (la de Magento 2) es de la feature de Magento: el
  adaptador de prueba no necesita una. Ningún secreto vive en la configuración.
- La forma del aviso (sólo identificador y estado) sigue a la del Hook de VTEX, que es la más pobre de las
  verificadas: un aviso más rico no cambia nada, porque igual se lee.
- La regla de confirmación por defecto acepta lo que hoy acepta el `push`: la plataforma genérica ya decide qué
  empuja, así que la regla sólo actúa en `pull` y `subscribe`.

## Lo que queda afuera

- El adaptador Magento 2, sus credenciales y su verificación contra una tienda (V3 y V4 de `02` §9): feature
  siguiente.
- VTEX como adaptador: sólo se verificó documentalmente.
- El precio que cobra Magento (punto 6 de la verificación) y el módulo del identificador (punto 7).
- `subscribe` para catálogo y para stock y precio: ninguna plataforma verificada lo publica sin un afiliado, y el
  `pull` alcanza para el nivel 2 del perfil.
- Las pantallas de la consola para configurar los modos y ver las corridas: las hace OPE-Web después de
  `contract:sync`.
