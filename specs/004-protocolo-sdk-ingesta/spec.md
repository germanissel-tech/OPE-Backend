# Feature Specification: Protocolo del SDK e ingesta de eventos

**Feature Branch**: `004-protocolo-sdk-ingesta`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Protocolo del SDK e ingesta de eventos. Primera feature de dominio:
estructura por anillos con composition root tipado (DI manual) y módulos con mapa de contextos
verificado; ingesta de lotes de eventos del SDK con credencial de ingesta por merchant, contrato
de evento como lista blanca (03-alcance-mvp.md §4.1), deduplicación por eventId, sin datos
personales; respuesta de decisión inline (por ahora siempre NO_OP con motivo); confirmación de
exposición registrada en el ledger (en memoria); CORS por merchant; aislamiento probado;
glosario e invariantes. Sin persistencia real, sin asignación, sin plano de decisión."

## Contexto

Es la primera feature con dominio. Hasta acá el repositorio tiene una sola operación
(`getHealth`) y toda la maquinaria de verificación. Dos cosas la ordenan:

1. **La tesis del MVP** (constitución): el aparato de medición tiene que ser más confiable que
   la lógica de intervención. Por eso esta feature construye el borde por donde entran las
   señales y por donde se confirma la exposición —los dos extremos que la medición necesita— y
   deja explícitamente fuera la decisión, que sigue resolviendo `NO_OP`.
2. **El SDK y el portal son otros equipos** que trabajan contra el contrato. Lo que los
   destraba es el protocolo completo hacia el navegador, aunque el backend todavía no decida
   nada. El mock de la 001 les sirve desde el día en que el contrato esté escrito.

Antes de la primera operación de dominio, el código se organiza por anillos de Clean
Architecture y por módulos con un mapa de contextos verificado, y la aplicación se compone en
un único lugar con inyección manual de dependencias. Igual que en la 002 y la 003: la regla
tiene que existir antes que el primer código que la violaría.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - La aplicación se compone en un solo lugar y cada pieza se reemplaza sin tocar el resto (Priority: P1)

Un agente que implementa una capacidad nueva escribe reglas puras en el dominio, un caso de
uso que las orquesta a través de puertos, y un adaptador por cada puerto. Nada de eso decide
qué implementación concreta se usa: eso lo decide un único módulo de composición, con
**perfiles** (memoria para pruebas, mock y esta feature; producción cuando lleguen los
almacenes reales). Reemplazar un adaptador es cambiar el perfil o pasar un reemplazo puntual;
el punto de entrada sólo lee la configuración y arranca. Una dependencia que cruza de anillo
en la dirección equivocada, o un módulo que importa lo interno de otro, falla el build.

**Why this priority**: la constitución exige composition root único, un módulo por
autoridad y ningún cliente de infraestructura fuera del root. La 002 lo hizo cumplir para
cuatro capas planas; esta feature lo lleva a la forma que va a tener todo el sistema antes de
que entre la primera autoridad. Si se hace después, cada feature siguiente paga el refactor.

**Independent Test**: la operación existente (`getHealth`) sigue respondiendo igual tras la
reorganización, con toda la suite anterior en verde sin tocar aserciones; un fixture con un
import de anillo o de módulo prohibido falla la verificación de arquitectura; una prueba de
integración obtiene la aplicación entera del bootstrap con un reloj fijo como reemplazo y
comprueba que el reloj se usó.

**Acceptance Scenarios**:

1. **Given** el código reorganizado por anillos (dominio, aplicación, adaptadores de interfaz,
   infraestructura, composición), **When** se corre la suite anterior, **Then** pasa sin
   modificar aserciones y `GET /v1/health` responde igual.
2. **Given** un módulo de dominio que importa de aplicación, de adaptadores o de
   infraestructura; o un caso de uso que importa un adaptador; o un adaptador que importa
   infraestructura, **When** se corre la verificación de arquitectura, **Then** falla
   nombrando archivo, import y regla.
3. **Given** un módulo que importa un archivo interno de otro módulo (no su API pública), o
   un módulo que importa de uno no permitido por el mapa de contextos, **When** se corre la
   verificación, **Then** falla nombrando ambos módulos.
4. **Given** el bootstrap con el perfil de memoria, **When** una prueba pide la aplicación
   con un reemplazo puntual (un reloj fijo), **Then** obtiene el grafo completo y la respuesta
   usa el reemplazo; sin reemplazo, usa el del perfil.
5. **Given** el punto de entrada, **When** se lo lee, **Then** contiene sólo lectura de
   configuración, llamada al bootstrap, arranque y apagado; ninguna instancia concreta.
6. **Given** un puerto nuevo agregado al contenedor tipado, **When** un perfil no lo provee,
   **Then** la compilación falla.

---

### User Story 2 - Las señales del navegador entran deduplicadas, validadas y aisladas por merchant (Priority: P1)

El SDK instalado en la tienda de un merchant envía lotes de eventos de comportamiento con la
credencial de ingesta de ese merchant. El backend identifica al merchant por la credencial,
acepta sólo eventos con la forma exacta que el contrato declara (una lista blanca: cualquier
campo no previsto rechaza el lote con error ruidoso), descarta como duplicado todo evento cuyo
identificador ya se recibió para ese merchant, y no registra ni escribe en logs ningún dato
personal, incluida la dirección IP. Un merchant no puede, por ningún camino, hacer entrar
un evento en nombre de otro.

**Why this priority**: es el criterio de aceptación 2 del MVP (03 §10) y la puerta de todo
lo demás: sin señales confiables no hay medición. La lista blanca es cómo la privacidad
"vive en el código" (01 §10.3).

**Independent Test**: un lote válido se acepta y reporta cuántos eventos entraron y cuántos
eran duplicados; el mismo lote reenviado reporta todos duplicados; un evento con un campo de
más se rechaza con la ruta del campo; una credencial desconocida o revocada se rechaza; el
mismo `eventId` enviado por dos merchants entra en ambos.

**Acceptance Scenarios**:

1. **Given** una credencial de ingesta válida y un lote con eventos de los tipos declarados,
   **When** se envía, **Then** se acepta y la respuesta indica, por evento, si entró o era
   duplicado.
2. **Given** el mismo lote reenviado (reintento o replay), **When** se envía, **Then** se
   acepta, todos los eventos se reportan como duplicados y nada se registra dos veces.
3. **Given** un evento con un campo no declarado —en la raíz, en el contexto de página o
   anidado—, **When** se envía, **Then** el lote entero se rechaza con error que nombra el
   campo; nada del lote entra.
4. **Given** un evento de un tipo fuera de la lista (03 §4.1), o sin alguna de las tres
   identidades, o con un instante fuera de rango, **When** se envía, **Then** se rechaza
   nombrando el motivo.
5. **Given** un request sin credencial, con una credencial desconocida o con una revocada,
   **When** se envía, **Then** se rechaza como no autorizado y no se procesa nada.
6. **Given** una credencial rotada (la nueva activa y la anterior aún vigente durante la
   ventana de rotación), **When** llegan lotes con cualquiera de las dos, **Then** ambos entran
   para el mismo merchant; con la anterior ya vencida, se rechaza.
7. **Given** dos merchants que envían un evento con el mismo `eventId`, **When** se envían,
   **Then** cada uno entra para su merchant; ninguno ve al otro como duplicado.
8. **Given** cualquier request de ingesta, **When** se revisan los registros y logs
   producidos, **Then** no contienen dirección IP, ni ningún campo fuera de la lista blanca.
9. **Given** un lote que excede el tamaño máximo declarado, **When** se envía, **Then** se
   rechaza nombrando el límite.

---

### User Story 3 - El SDK siempre recibe una decisión, aunque sea "no hacer nada" (Priority: P1)

Con cada lote aceptado, el SDK recibe la decisión del backend para esa sesión: por ahora,
siempre **no intervenir**, con un motivo explícito de un catálogo propio y un identificador de
decisión. La forma de la respuesta ya reserva el lugar de la intervención futura (anclaje y
mensaje versionado), para que el SDK se construya contra el protocolo definitivo y no contra
uno provisorio.

**Why this priority**: `NO_OP` es un resultado con motivo, nunca una ausencia
(constitución II). Definir el protocolo de decisión ahora, con el equipo del SDK enfrente,
evita rehacer el SDK cuando llegue el plano de decisión. La forma exacta queda marcada como
`PROPUESTO` hasta que ese equipo la revise.

**Independent Test**: toda respuesta de ingesta aceptada trae una decisión con identificador
y motivo del catálogo; dos lotes de la misma sesión traen decisiones distintas
(identificadores distintos); el mock responde con la misma forma.

**Acceptance Scenarios**:

1. **Given** un lote aceptado, **When** se lee la respuesta, **Then** trae una decisión con
   identificador único, resultado `NO_OP` y un motivo perteneciente al catálogo del contrato.
2. **Given** el catálogo de motivos, **When** se lee el contrato, **Then** cada motivo tiene
   descripción y está documentado como extensible sin romper compatibilidad.
3. **Given** un lote rechazado, **When** se lee la respuesta, **Then** no trae decisión: un
   lote inválido no produce decisión.
4. **Given** el servidor en modo mock, **When** el SDK envía un lote, **Then** recibe una
   respuesta con la misma forma que la del servidor real.

---

### User Story 4 - La exposición la confirma el navegador, y sólo la de una decisión propia (Priority: P2)

Cuando una intervención se renderiza y es visible, el SDK lo confirma indicando la decisión,
la sesión, el visitante, el momento y el anclaje donde se mostró. El backend la registra como
exposición de esa decisión. Una confirmación de una decisión inexistente, de otro merchant, o
repetida, se rechaza o se ignora de forma explícita, nunca se registra dos veces.

**Why this priority**: la exposición es el segundo estado de la cadena de evidencia
(01 §5) y la constitución exige que sea explícita, nunca inferida de la decisión. Hoy ninguna
decisión interviene, así que ninguna exposición real va a llegar; pero el protocolo y el
registro tienen que existir para que el SDK los implemente ahora.

**Independent Test**: una confirmación con una decisión emitida por el mismo merchant se
registra y se puede consultar en el registro en memoria; con una decisión inexistente o de
otro merchant se rechaza; repetida, se reporta como ya registrada.

**Acceptance Scenarios**:

1. **Given** una decisión emitida para el merchant, **When** llega su confirmación de
   exposición válida, **Then** queda registrada como `EXPOSED` con el momento y el anclaje.
2. **Given** una confirmación que referencia una decisión que no existe, **When** llega,
   **Then** se rechaza nombrando la invariante.
3. **Given** una confirmación de una decisión emitida para otro merchant, **When** llega con
   la credencial de este, **Then** se rechaza igual que si no existiera (no revela que existe).
4. **Given** una confirmación repetida de la misma decisión, **When** llega, **Then** se
   responde que ya estaba registrada y el registro no cambia.
5. **Given** una confirmación con un campo no declarado o sin alguno obligatorio, **When**
   llega, **Then** se rechaza nombrando el campo.

---

### User Story 5 - Sólo la tienda del merchant puede hablar con el backend desde el navegador (Priority: P2)

El SDK corre en el navegador del visitante, en el dominio de la tienda. El backend acepta
llamadas desde el navegador únicamente para los orígenes registrados de ese merchant; un
origen no registrado no obtiene autorización del navegador para llamar.

**Why this priority**: sin esto el SDK no puede llamar (los navegadores lo bloquean); con
una lista abierta, cualquier sitio podría enviar eventos con una credencial pública. La
credencial de ingesta es pública por diseño (viaja en el tag), así que el origen es la
segunda mitad del control.

**Independent Test**: una petición previa de autorización desde un origen registrado del
merchant se acepta; desde uno no registrado, no; los encabezados de autorización no dan
permisos más amplios que el origen que pregunta.

**Acceptance Scenarios**:

1. **Given** un merchant con orígenes registrados, **When** el navegador pregunta desde uno de
   ellos, **Then** obtiene autorización para los métodos y encabezados que el protocolo usa.
2. **Given** un origen no registrado para ese merchant, **When** pregunta, **Then** no obtiene
   autorización.
3. **Given** una petición sin origen (servidor a servidor, pruebas), **When** llega con
   credencial válida, **Then** se procesa normalmente.

---

### Edge Cases

- **Lote parcialmente duplicado**: los nuevos entran, los repetidos se reportan como tales;
  el lote se acepta. La atomicidad es por evento para duplicados y por lote para validez.
- **Eventos fuera de orden dentro del lote** (instantes no crecientes): se aceptan; el orden
  lo da el instante declarado, no la posición.
- **Instante en el futuro o demasiado en el pasado** (más allá de una tolerancia declarada):
  se rechaza; un reloj de navegador mal puesto no contamina la secuencia.
- **Misma sesión con dos visitantes distintos** en el mismo lote: se rechaza el lote (una
  sesión pertenece a un visitante).
- **Credencial válida de un merchant apagado** (kill switch, feature 008): fuera de alcance
  acá; se registra como dependencia.
- **Contexto de página incompleto** (por ejemplo sin variante en una vista de producto): se
  acepta —el SDK reporta lo que pudo resolver— y la decisión resuelve `NO_OP` por contexto
  incompleto; el motivo lo dice.
- **Dedup por `eventId` con memoria acotada**: la ventana de deduplicación está declarada en
  el contrato (por ejemplo, 24 horas o N eventos por merchant); un replay más viejo que la
  ventana puede volver a entrar y eso queda documentado como límite del perfil en memoria.
- **Decisión consultada por otro merchant**: no existe para él (US4.3).
- **Confirmación de exposición de una decisión `NO_OP`**: se rechaza nombrando la invariante:
  no hay intervención que exponer.

## Requirements _(mandatory)_

### Functional Requirements

**Estructura y composición**

- **FR-001**: El código MUST organizarse en anillos con dirección de dependencia fija hacia
  adentro: dominio (puro) ← aplicación (casos de uso y los puertos que definen) ← adaptadores
  de interfaz (traducción HTTP y gateways que implementan puertos) ← infraestructura
  (frameworks, drivers, configuración). Un módulo de composición ve todos; el punto de entrada
  ve sólo composición y configuración; nadie importa composición, infraestructura ni el punto
  de entrada, salvo las pruebas.
- **FR-002**: Dentro de cada anillo el código MUST agruparse por módulo del sistema
  (`shared-kernel`, `system`, `merchant`, `ingestion`, `ledger` en esta feature; los demás
  cuando su feature llegue). Cada módulo expone su API pública en un único punto; ningún
  módulo importa archivos internos de otro; las dependencias entre módulos MUST estar
  declaradas en un mapa de contextos y verificadas; sin ciclos.
- **FR-003**: La composición MUST ser un contenedor tipado de puertos con perfiles (memoria
  ahora; producción después) y reemplazos puntuales; MUST devolver la aplicación lista y una
  forma de apagarla ordenadamente; agregar un puerto al contenedor sin proveerlo en un perfil
  MUST fallar la compilación.
- **FR-004**: La verificación de arquitectura MUST cubrir anillos y módulos, con un fixture
  por regla, y correr en el chequeo previo a commit y en integración continua.
- **FR-005**: La reorganización MUST mantener la operación existente y toda la suite anterior
  sin modificar aserciones.

**Ingesta**

- **FR-010**: El contrato MUST declarar la operación de ingesta de lotes, autenticada con la
  credencial de ingesta del merchant (pública, rotable, distinta de las del portal), con la
  capacidad requerida declarada; `merchantId` MUST derivarse de la credencial y no aparecer
  en el request.
- **FR-011**: El contrato de evento MUST ser una lista blanca cerrada: tipo (exactamente los
  de 03 §4.1: vista de producto, vista de listado, interacción con selector de talle,
  interacción con color/variante, zoom y navegación de fotos, scroll y permanencia, hover y
  acercamiento al CTA, retorno a un producto anterior, agregado al carrito, eliminación del
  carrito con retorno al producto, avance de checkout, y las cuatro señales de salida:
  inactividad prolongada, pérdida de foco, navegación atrás, intención de salida en
  escritorio), identidades (`eventId`, `sessionId`, `visitorId`), instante, contexto de
  página (tipo de página, identificador de producto, variante, precio, moneda,
  disponibilidad), clase de dispositivo, y los atributos propios de cada tipo. Todo objeto
  MUST rechazar propiedades no declaradas.
- **FR-012**: La ingesta MUST rechazar el lote completo ante cualquier violación del contrato,
  nombrando cada violación; MUST NOT limpiar ni descartar campos silenciosamente.
- **FR-013**: La ingesta MUST deduplicar por `eventId` dentro del merchant: un evento repetido
  se reporta como duplicado y no se registra dos veces; el mismo `eventId` en merchants
  distintos son eventos distintos. La ventana de deduplicación MUST estar declarada.
- **FR-014**: La respuesta MUST informar, por evento, si entró o era duplicado, y el total.
- **FR-015**: El tamaño máximo de lote y la tolerancia de instante (pasado/futuro) MUST estar
  declarados en el contrato y hacerse cumplir.
- **FR-016**: Ningún dato fuera de la lista blanca MUST registrarse ni escribirse en logs; la
  dirección IP del request MUST NOT persistirse ni loguearse.
- **FR-017**: Las credenciales de ingesta MUST resolverse a través de un puerto del módulo
  `merchant`, con implementación en memoria cargada desde configuración (merchants de
  prueba), y soportar dos claves activas por merchant durante una rotación.

**Decisión**

- **FR-020**: Toda respuesta de ingesta aceptada MUST incluir una decisión con identificador
  único, resultado (`NO_OP` en esta feature) y motivo de un catálogo propio del contrato,
  documentado como extensible sin romper compatibilidad; la forma MUST reservar el lugar de
  una intervención futura (anclaje y mensaje versionado) marcada `PROPUESTO`.
- **FR-021**: Una decisión MUST registrarse en el ledger (puerto, implementación en memoria)
  al emitirse, con su merchant, sesión, visitante, motivo e instante.

**Exposición**

- **FR-030**: El contrato MUST declarar la operación de confirmación de exposición
  (`decisionId`, `sessionId`, `visitorId`, instante, anclaje), autenticada igual que la
  ingesta.
- **FR-031**: Una exposición MUST registrarse como `EXPOSED` sólo si la decisión existe para
  ese merchant y fue una intervención; una decisión inexistente, de otro merchant o `NO_OP`
  MUST rechazarse con la invariante correspondiente; una repetida MUST reportarse como ya
  registrada sin duplicar.

**Orígenes**

- **FR-040**: El backend MUST responder a las peticiones previas de autorización del navegador
  aceptando únicamente los orígenes registrados del merchant identificado por la credencial;
  sin credencial u origen no registrado, no autoriza. Las peticiones sin origen MUST
  procesarse con normalidad.

**Aislamiento, glosario, invariantes y pruebas**

- **FR-050**: Las pruebas MUST demostrar aislamiento entre merchants en: deduplicación,
  visibilidad de decisiones, exposiciones y orígenes.
- **FR-051**: Todo sustantivo nuevo del contrato MUST tener su nota en el glosario con fuente
  antes de usarse (`event`, `session`, `visitor`, `exposure`, `decision`, `ingestion`,
  `ledger`, `no-op`, `anchor`, `page`, `product`, `variant`, `device`).
- **FR-052**: Toda regla no expresable por esquema MUST declararse como invariante con su tipo
  propio y prueba nombrada: al menos evento duplicado, exposición de decisión inexistente o
  ajena, exposición de `NO_OP`, sesión con dos visitantes, instante fuera de tolerancia.
- **FR-053**: La latencia de la ingesta MUST medirse por percentil en las pruebas (p50/p95)
  sobre el perfil en memoria y reportarse; no es un SLA.

### Key Entities

- **Evento**: `eventId`, `sessionId`, `visitorId`, tipo (lista cerrada), instante, contexto de
  página, clase de dispositivo, atributos por tipo. Pertenece a un merchant.
- **Lote**: conjunto de eventos de una sesión enviados juntos; válido como un todo.
- **Credencial de ingesta**: clave pública por merchant; hasta dos activas; rotable; distinta
  de las credenciales del portal.
- **Merchant** (mínimo en esta feature): identificador, credenciales, orígenes registrados.
- **Decisión**: identificador, merchant, sesión, visitante, instante, resultado (`NO_OP` |
  intervención futura), motivo.
- **Exposición**: decisión, instante, anclaje; estado `EXPOSED` de la cadena de evidencia.
- **Motivo de `NO_OP`**: catálogo propio del contrato, extensible.
- **Módulo / mapa de contextos**: nombre, API pública, dependencias permitidas.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Toda la suite de las features 001–003 pasa sin modificar aserciones tras la
  reorganización; `GET /v1/health` responde byte a byte igual.
- **SC-002**: Cada regla de anillo y de módulo tiene un fixture que la viola y una prueba que
  confirma la falla; la verificación de arquitectura corre en menos de 10 segundos.
- **SC-003**: Un lote válido de 20 eventos se acepta con p95 por debajo de 50 ms en el perfil
  en memoria (medido en pruebas, sin SLA), y el reenvío del mismo lote reporta 20 duplicados.
- **SC-004**: El 100 % de los tipos de evento de 03 §4.1 está en el contrato, y un evento con
  un campo de más se rechaza con la ruta exacta del campo en el 100 % de los casos probados
  (raíz, contexto, anidado).
- **SC-005**: Ninguna prueba de aislamiento (FR-050) permite que un merchant vea, duplique o
  confirme algo de otro.
- **SC-006**: El equipo del SDK puede desarrollar contra `npm run contract:mock` las tres
  operaciones (salud, ingesta, exposición) sin ningún cambio en el backend.
- **SC-007**: `release-check` en verde: sin marcadores bloqueantes; el protocolo de decisión
  queda `PROPUESTO` (no bloquea) hasta la revisión del equipo del SDK.

## Assumptions

- **La respuesta de decisión viaja inline en la respuesta de ingesta** (una llamada por
  lote), en vez de una operación de decisión separada. Es lo más simple para el SDK y mantiene
  una sola conversación por lote; queda `PROPUESTO` y se convierte en ADR cuando el equipo del
  SDK la valide. Si prefieren una operación separada, cambia el contrato antes de la 010, no
  el dominio.
- La credencial de ingesta es pública (viaja en el tag del merchant, 02 §3); autentica al
  merchant, no al visitante. La protección real es la combinación credencial + origen
  registrado + (futuro) límites de tasa. Límites de tasa quedan fuera de esta feature.
- Los merchants de esta feature se cargan desde configuración (archivo o variables) en el
  perfil de memoria; el módulo `merchant` completo (configuración versionada, flags, kill
  switch) es la feature 008.
- Sin asignación experimental (005): la decisión no tiene brazo todavía; el ledger registra
  decisiones y exposiciones, no `ASSIGNED`.
- Sin persistencia real (006): todos los puertos tienen implementación en memoria acotada;
  la ventana de deduplicación y el registro se pierden al reiniciar, y eso está documentado
  como límite del perfil, no del diseño.
- La clase de dispositivo se limita a un valor de una lista corta (escritorio, móvil,
  tableta); nada que identifique el dispositivo (01 §10.2).
- Los identificadores del SDK (`eventId`, `sessionId`, `visitorId`) los genera el SDK con un
  formato acotado declarado en el contrato; el backend no los genera ni los interpreta.
- Las herramientas concretas (verificador de arquitectura, forma del contenedor, mecanismo
  de CORS) se eligen en el plan. Restricción: sin contenedor de inyección con decoradores ni
  metadata de reflexión (incompatible con la configuración del compilador y con la pureza del
  dominio, ADR-012).
