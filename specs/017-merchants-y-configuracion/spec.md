# Feature Specification: Merchants, configuración en tres niveles y administración (017)

**Feature Branch**: `017-merchants-y-configuracion`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Merchants, configuración en tres niveles, experimentos y
administración de la plataforma (feature 017 del mapa del contrato). OPE es una plataforma con
un solo código y N merchants: los datos de cada merchant están aislados y su comportamiento lo
gobierna su configuración (constitución I y XI). Nosotros (OPE) operamos todo: damos de alta
merchants, les configuramos, rotamos credenciales, abrimos y cerramos experimentos y apagamos
OPE en un merchant sin deploy. […] (1) una única fuente de verdad para los merchants detrás de
un puerto de escritura […]; (2) tres niveles de configuración resueltos valor por valor […];
(3) tokens por operador […] toda acción de administración se registra […]; (4) los puertos
expresan intenciones, no filas […]. Historias: US1 merchant y credenciales; US2 configuración
versionada en tres niveles; US3 experimentos; US4 configuración del SDK y diagnóstico de
anclajes."

## Contexto

**Hoy (lo que esta feature corrige)**: un merchant es una entrada de una variable de entorno
leída al arrancar; darlo de alta, rotarle una clave, cambiarle una política o apagarle OPE es
editar un JSON y reiniciar el servidor. Las políticas que gobiernan el comportamiento
—frescura del catálogo, umbrales del nivel de sincronización, ventanas de deduplicación,
memoria de sesión y de visitante— son constantes del código, y la constitución XI (1.4.0)
dice que ninguna política vive en el código. El consumidor `admin` existe en el mapa del
contrato con diez operaciones planificadas y ninguna construida; su esquema de seguridad
sigue `PROPUESTO` desde ADR-020.

**Con esta feature — principio**: **ninguna operación sobre un merchant requiere reinicio**.
Alta, credenciales, configuración, experimentos e interruptor son operaciones en caliente por
la API de administración y valen desde la siguiente solicitud. El servidor se reinicia sólo
con un deploy nuevo, y un deploy nuevo hace falta sólo cuando cambia el código o los valores
que viajan con él (nivel plataforma y defaults de tratamiento). Hasta la feature de
persistencia la fuente de verdad vive en memoria: un reinicio por deploy pierde lo creado por
API y el arranque vuelve a importar la variable de entorno; por eso la persistencia precede al
puerto de plataforma y a cualquier piloto.

Los documentos base fijan el objetivo: sumar un merchant es **onboarding, no desarrollo**
(`01 §3.1.1`); el kill switch se opera **sin deploy y sin tocar el sitio del merchant**
(`01 §14.2`); la configuración **se versiona y se estampa en cada decisión** del ledger, y se
**congela** durante el piloto tras una ventana de calibración (`01 §14.2`, `03 §4.10`, D-G
confirmada el 2026-09-20). Las decisiones del dueño del 2026-09-20 (sesión de la 016) fijan la
forma: una sola fuente de verdad para los merchants detrás de un puerto de la aplicación,
independiente del motor que la guarde; tres niveles de configuración de los que los dos
primeros van con el release y el tercero por API; operadores identificados con alcance y
registro de cada acción; y tres agregados con vidas distintas —identidad y credenciales,
configuración versionada, experimento— en lugar de un objeto "merchant" que se sobrescribe.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un merchant se opera, no se despliega (Priority: P1)

Como operador de OPE, quiero dar de alta un merchant, obtener sus credenciales una sola vez,
rotarlas cuando haga falta, apagarle OPE con un interruptor y darlo de baja conservando su
historia, todo por la API de administración con mi propio token, para que sumar o atender un
merchant sea una operación registrada y no un despliegue.

**Why this priority**: es el cimiento de todo lo demás: sin un merchant que exista como
registro operable, la configuración versionada (US2), los experimentos (US3) y la
configuración del SDK (US4) no tienen dónde vivir. Y es lo que convierte a OPE en una
plataforma operada: hoy no se puede sumar un merchant sin reiniciar el sistema.

**Independent Test**: con el sistema arrancado sin ningún merchant, un operador crea uno,
recibe su clave de ingesta y su clave y secreto de plataforma, el SDK y la plataforma de ese
merchant autentican con ellas; rota la clave de ingesta y la anterior deja de valer; apaga
OPE y el SDK sigue funcionando pero OPE no interviene; lo desactiva y nada del merchant
autentica, pero sus registros siguen existiendo. Cada paso aparece en el registro de
administración con el operador que lo hizo.

**Acceptance Scenarios**:

1. **Given** un operador con alcance a todos los merchants, **When** crea un merchant con sus
   orígenes permitidos, **Then** OPE acuña un identificador inmutable, responde **una sola vez**
   la clave de ingesta, la clave de plataforma y el secreto de firma, y a partir de ese instante
   el SDK autentica con la clave de ingesta y la plataforma con la clave y el secreto; ninguna
   lectura posterior devuelve las credenciales.
2. **Given** un merchant activo, **When** el operador rota su clave de ingesta, **Then** recibe la
   clave nueva una sola vez, la nueva autentica de inmediato, la anterior sigue valiendo durante
   la ventana de gracia declarada en la rotación y después es rechazada; la rotación queda en el
   registro de administración con actor e instante.
3. **Given** un merchant activo con tráfico, **When** el operador acciona el kill switch, **Then**
   desde la siguiente solicitud el SDK de ese merchant sigue recibiendo respuestas válidas pero
   toda decisión es `NO_OP` con el motivo "merchant apagado", ninguna intervención se emite, y
   las órdenes y devoluciones de la plataforma se siguen registrando (la medición no se rompe);
   al apagar el interruptor, OPE vuelve a decidir sin reinicio.
4. **Given** un merchant con decisiones, exposiciones y órdenes registradas, **When** el
   operador lo desactiva, **Then** ninguna credencial del merchant autentica, no se puede
   reactivar ni recrear con el mismo identificador, y todo lo registrado sigue existiendo y
   siendo consultable por administración.
5. **Given** dos operadores, uno con alcance a todos y otro con alcance sólo al merchant A,
   **When** el segundo intenta leer o modificar el merchant B, **Then** la operación se rechaza
   como prohibida sin revelar si B existe, y el intento queda registrado.
6. **Given** un token de operador desconocido, revocado o ausente, **When** llama a cualquier
   operación de administración, **Then** recibe "no autenticado" antes de que se valide el
   cuerpo, y nada cambia.
7. **Given** un entorno vacío arrancado con la variable de entorno de merchants de hoy, **When**
   el sistema arranca, **Then** esos merchants existen como si un operador "sistema" los hubiera
   creado por la API (misma validación, misma entrada en el registro de administración), y en un
   arranque posterior con merchants ya existentes la variable no pisa nada.

---

### User Story 2 - La configuración se versiona y ninguna política vive en el código (Priority: P2)

Como operador de OPE, quiero configurar cada merchant por API —estrategia de sincronización
por flujo, presupuestos de frescura, idiomas, políticas de decisión y comercial, perfil de
evidencia, superficies y barreras activas, fatiga— como versiones que nunca se sobrescriben, y
que lo que el merchant no declara se resuelva desde los defaults de tratamiento y los valores
de plataforma que viajan con el release, para que cada decisión del ledger diga con qué
configuración exacta se tomó y para que el código no tenga ninguna constante de comportamiento.

**Why this priority**: es la implementación del principio XI y de "la configuración se
versiona y se estampa" (`01 §14.2`): sin esto el piloto no puede afirmar bajo qué tratamiento
se tomó cada decisión, y cada ajuste operativo sigue siendo un cambio de código.

**Independent Test**: publicar una versión nueva de configuración para un merchant y verificar
que la siguiente decisión lleva esa versión y se comporta según ella; quitar un valor de la
versión y verificar que rige el default de tratamiento; leer por API la versión de plataforma y
de defaults activas; y verificar que no queda en el código ninguna constante de las que hoy
gobiernan frescura, nivel de sincronización, deduplicación ni memoria de sesión o visitante.

**Acceptance Scenarios**:

1. **Given** un merchant sin configuración declarada, **When** decide, **Then** la decisión se
   toma con los defaults de tratamiento y los valores de plataforma del release, y registra la
   versión efectiva (versión de plataforma + versión de defaults + "sin versión de merchant").
2. **Given** un merchant, **When** el operador publica una versión de configuración que declara
   sólo el presupuesto de frescura de stock y precio y los idiomas, **Then** la versión se numera,
   la anterior sigue consultable, la siguiente decisión estampa la versión nueva, la frescura
   usada es la declarada y todo lo no declarado sigue viniendo de los defaults.
3. **Given** una versión de configuración con un valor inválido (una tasa fuera de 0–1, una
   escalera no creciente, un idioma que no es una etiqueta de idioma, una estrategia con un modo
   que no existe), **When** se publica, **Then** se rechaza nombrando el campo y no se crea
   ninguna versión.
4. **Given** el release en ejecución, **When** un operador lee la configuración de plataforma o
   los defaults de tratamiento, **Then** obtiene los valores y la versión que el release declara;
   no existe ninguna operación para modificarlos en caliente.
5. **Given** el repositorio, **When** se construye el release, **Then** los archivos de
   plataforma y de defaults se validan contra el vocabulario del código (barreras, candidatos,
   claims, motivos, modos de sincronización): un valor que el código no conoce falla la
   construcción, no el arranque.
6. **Given** el código de la plataforma, **When** se busca cualquier constante con nombre que
   gobierne comportamiento (frescura, umbrales de nivel de sincronización, ventana de
   deduplicación, memoria de sesión y visitante, políticas por defecto), **Then** no hay ninguna:
   todas resuelven desde los tres niveles, y el gate de números mágicos lo sigue vigilando.
7. **Given** un cambio de configuración de merchant, **When** llega la siguiente solicitud del
   SDK, **Then** ya decide con la versión nueva sin reinicio y sin que el camino de decisión haga
   ninguna lectura fuera de memoria.

---

### User Story 3 - Un experimento se abre, se calibra, se congela y se cierra (Priority: P3)

Como operador de OPE, quiero abrir un experimento para un merchant, correr una ventana de
calibración en la que la configuración todavía se ajusta y nada cuenta, activarlo —y desde ahí
la configuración queda congelada—, y cerrarlo, para que el resultado del piloto sea
interpretable (D-G) y para que un ajuste a mitad del experimento sea imposible por accidente y
explícito por decisión.

**Why this priority**: es la garantía metodológica de D-G y de la constitución I (un
experimento por merchant); depende de que exista el merchant (US1) y su configuración
versionada (US2).

**Independent Test**: abrir un experimento, publicar configuración durante la calibración,
activarlo, intentar publicar otra versión y ver el rechazo, publicar una versión declarada
correctiva y ver el reinicio de la ventana de acumulación registrado, cerrar el experimento y
ver que ya no se asigna.

**Acceptance Scenarios**:

1. **Given** un merchant sin experimento activo, **When** el operador abre uno con reparto,
   semilla y muestra objetivo, **Then** el experimento nace en calibración: los visitantes se
   asignan y OPE decide e interviene, pero cada decisión queda marcada como de calibración y no
   cuenta para el análisis.
2. **Given** un experimento en calibración, **When** el operador publica versiones nuevas de
   configuración, **Then** se aceptan y se estampan normalmente.
3. **Given** un experimento en calibración, **When** el operador lo activa, **Then** la ventana de
   acumulación empieza en ese instante con la configuración vigente, y la versión efectiva queda
   congelada para ese merchant.
4. **Given** un experimento activo, **When** el operador publica una versión de configuración,
   **Then** se rechaza como "configuración congelada" y no se crea versión.
5. **Given** un experimento activo, **When** el operador publica una versión declarada
   **correctiva** con su motivo, **Then** se acepta, la ventana de acumulación se reinicia en ese
   instante, y el registro de administración guarda la versión, el motivo y el reinicio.
6. **Given** un merchant con un experimento activo, **When** el operador intenta abrir otro,
   **Then** se rechaza: como máximo un experimento activo o en calibración por merchant.
7. **Given** un experimento activo, **When** el operador lo cierra, **Then** ningún visitante
   nuevo se asigna, las decisiones resuelven `NO_OP` "sin experimento activo", lo registrado se
   conserva y el experimento no se puede reabrir.
8. **Given** el interruptor del merchant apagado, **When** hay un experimento activo, **Then**
   el experimento no cambia de estado: apagar OPE no cierra ni reinicia nada, y el registro de
   administración muestra el apagado dentro de la ventana.

---

### User Story 4 - El SDK recibe su configuración y reporta lo que no resuelve (Priority: P4)

Como SDK instalado en el sitio de un merchant, quiero obtener con mi clave de ingesta la
configuración que me corresponde —mapa de anclajes, superficies habilitadas, idiomas, si OPE
está encendido— y reportar los anclajes que dejaron de resolver, para que un rediseño del tema
del merchant se corrija en su perfil sin publicar el SDK y para que la degradación no sea
silenciosa (`01 §3.1.1`).

**Why this priority**: completa el circuito de "lo que varía por merchant es configuración,
no código" del lado del navegador; depende de US1 y US2.

**Independent Test**: con un merchant configurado, el SDK obtiene su configuración con la
versión, reporta un anclaje que no resuelve, y un operador ve ese diagnóstico en el merchant.

**Acceptance Scenarios**:

1. **Given** un merchant con configuración publicada, **When** el SDK pide su configuración con
   la clave de ingesta, **Then** recibe el mapa de anclajes, las superficies, los idiomas, el
   estado del interruptor y la versión de configuración; nunca políticas, márgenes, escalones,
   reparto del experimento ni nada que la constitución reserva al backend.
2. **Given** un merchant apagado, **When** el SDK pide su configuración, **Then** la obtiene con el
   interruptor en apagado y el SDK puede callar sin llamar a la ingesta.
3. **Given** el SDK verificando sus anclajes, **When** reporta que uno dejó de resolver, **Then**
   OPE lo guarda para ese merchant con el instante y la versión de configuración, sin datos de
   la persona ni de la página más allá del anclaje y el tipo de página, y un operador puede
   consultarlo.
4. **Given** una clave de ingesta de otro merchant, **When** pide configuración o reporta
   diagnóstico, **Then** sólo ve y afecta lo suyo.

---

### Edge Cases

- Un token de operador válido pero con alcance vacío: autentica y no puede hacer nada; todo
  intento se registra como prohibido.
- Rotar la clave de plataforma sin rotar el secreto de firma, y viceversa: son dos operaciones
  distintas; cada una tiene su ventana de gracia; durante la gracia las dos credenciales valen.
- Rotación repetida dentro de la ventana de gracia: la más vieja de las dos anteriores expira;
  como máximo dos credenciales vigentes por tipo (como hoy los secretos de firma).
- Crear un merchant con un origen ya registrado por otro: se rechaza; un origen pertenece a un
  merchant.
- Publicar una versión idéntica a la vigente: se acepta como repetición (misma versión, nada
  nuevo) y no reinicia ninguna ventana.
- Versión correctiva sin experimento activo: se acepta como versión normal; la marca de
  correctiva no tiene efecto y se registra igual.
- Cerrar un experimento en calibración: se cierra sin haber activado nunca; lo decidido en
  calibración conserva su marca.
- Apagar y desactivar el mismo merchant: desactivar prevalece; un merchant desactivado no
  tiene interruptor.
- La variable de entorno de merchants con un merchant inválido en un entorno vacío: el arranque
  falla nombrando el merchant y el campo (como hoy), sin crear ninguno.
- Un default de tratamiento que nombra un candidato que el código de ese release no conoce:
  falla la construcción del release, no el arranque.
- La clave de ingesta de un merchant desactivado llega en una solicitud: "no autenticado", no
  "prohibido": un merchant desactivado es indistinguible de uno inexistente para el borde.
- Diagnóstico de anclajes repetido en ráfaga: se conserva el último por anclaje y versión, con
  un contador; no crece sin límite.

## Requirements _(mandatory)_

### Functional Requirements

**Merchants y credenciales (US1)**

- **FR-001**: El sistema MUST mantener los merchants en una única fuente de verdad detrás de un
  puerto de la aplicación que expresa intenciones (crear, obtener, listar, rotar credencial,
  cambiar interruptor, desactivar), sin suponer ningún motor de almacenamiento; la implementación
  de hoy es en memoria y la durable llega con la feature de persistencia sin cambiar el núcleo.
- **FR-002**: OPE MUST acuñar el identificador del merchant al crearlo; es inmutable, sólo
  aparece en rutas del consumidor `admin` (constitución V) y nunca se reutiliza.
- **FR-003**: Las credenciales (clave de ingesta, clave de plataforma, secreto de firma) MUST
  generarse del lado de OPE y entregarse una sola vez en la respuesta que las crea o rota;
  ninguna lectura las devuelve. Las claves MUST guardarse de forma no recuperable (por huella);
  el secreto de firma, que OPE necesita para verificar la firma, MUST conservarse protegido y
  nunca exponerse.
- **FR-004**: La rotación de cada credencial MUST admitir una ventana de gracia declarada
  (acotada por un máximo de plataforma) durante la cual la anterior sigue valiendo; como máximo
  dos vigentes por tipo.
- **FR-005**: El interruptor (kill switch) MUST poder encenderse y apagarse sin reinicio: apagado,
  toda decisión del merchant es `NO_OP` con un motivo propio del catálogo, no se emite ninguna
  intervención, y las notificaciones de la plataforma (catálogo, órdenes, devoluciones) se
  siguen aceptando.
- **FR-006**: Desactivar un merchant MUST ser irreversible, invalidar todas sus credenciales y
  conservar todos sus registros; no existe borrado.
- **FR-007**: Todo operador MUST autenticar con un token propio, emitido fuera de banda y
  rotable, con un identificador de operador (nunca un dato personal) y un alcance explícito:
  todos los merchants o una lista; una operación fuera del alcance se rechaza como prohibida sin
  revelar la existencia del merchant.
- **FR-008**: Toda acción de administración MUST quedar registrada con operador, instante,
  operación, merchant, resultado y versión resultante cuando la haya; el registro es consultable
  por administración y no contiene credenciales ni datos personales.
- **FR-009**: La variable de entorno de merchants de hoy MUST dejar de ser fuente de verdad: en
  un entorno vacío se importa al arrancar por el mismo puerto y con la misma validación, a nombre
  del operador "sistema"; con merchants existentes no modifica nada. El entorno de desarrollo y
  las pruebas MUST entrar por ese mismo camino.

**Configuración en tres niveles (US2)**

- **FR-010**: La configuración efectiva de un merchant MUST resolverse valor por valor: lo que
  declara el merchant → si no, el default de tratamiento → y encima los valores de plataforma,
  que ningún merchant sobrescribe.
- **FR-011**: Los niveles plataforma y default de tratamiento MUST ser archivos versionados del
  repositorio, cargados al arrancar por un puerto, con versión declarada, validados en la
  construcción del release contra el vocabulario del código, y consultables por API sólo en
  lectura.
- **FR-012**: El nivel merchant MUST publicarse por API como versiones numeradas e inmutables;
  cada publicación crea una versión nueva, la anterior sigue consultable, y nada se sobrescribe.
- **FR-013**: El nivel merchant MUST admitir: estrategia de sincronización por flujo (catálogo,
  stock y precio, órdenes, devoluciones; modos `push`, `pull`, `subscribe`, de los que hoy sólo
  `push` está construido y los demás se aceptan como declaración), presupuestos de frescura por
  clase, idiomas del merchant e idioma de reserva, política de decisión, política comercial,
  perfil de evidencia, superficies y barreras activas, parámetros de fatiga y presupuesto por
  sesión, y el mapa de anclajes.
- **FR-014**: Toda versión MUST validarse con las invariantes del dominio (tasas 0–1, escalera
  creciente, techo ≥ escalón, etiquetas de idioma por forma, modos y vocabularios cerrados) y
  rechazarse nombrando el campo.
- **FR-015**: Cada decisión del ledger MUST registrar la versión efectiva con la que se tomó
  (plataforma, defaults, merchant o "sin versión"); el resultado de la asignación y la
  intervención no cambian de forma.
- **FR-016**: Ninguna constante de comportamiento MUST quedar en el código: frescura, umbrales y
  recepciones del nivel de sincronización, ventana de deduplicación, memoria de sesión y de
  visitante, y las políticas por defecto MUST resolverse desde los niveles; el código conserva
  invariantes y algoritmos.
- **FR-017**: El camino de decisión MUST seguir sin lecturas fuera de memoria: la configuración
  vigente se actualiza en el instante de la publicación (una sola instancia, `01 §9`).

**Experimentos (US3)**

- **FR-018**: Un experimento MUST crearse en calibración, activarse explícitamente y cerrarse;
  es inmutable en reparto y semilla; como máximo uno en calibración o activo por merchant.
- **FR-019**: Las decisiones tomadas en calibración MUST quedar marcadas como tales y excluidas
  del análisis; la ventana de acumulación empieza al activar.
- **FR-020**: Con un experimento activo, publicar una versión de configuración MUST rechazarse
  como "configuración congelada", salvo que se declare correctiva con motivo: entonces se acepta,
  la ventana de acumulación se reinicia y todo queda en el registro de administración.
- **FR-021**: Cerrar un experimento MUST detener la asignación de visitantes nuevos, conservar lo
  registrado y no permitir reabrirlo; apagar el interruptor no cambia el estado del experimento.

**Configuración del SDK y diagnóstico (US4)**

- **FR-022**: El SDK MUST poder obtener, con su clave de ingesta, la configuración que le
  corresponde —mapa de anclajes, superficies, idiomas, estado del interruptor, versión— y nada
  de lo que la constitución reserva al backend (políticas, márgenes, reparto, brazo).
- **FR-023**: El SDK MUST poder reportar anclajes que no resuelven; OPE los conserva por merchant
  con instante, versión y tipo de página, sin datos de la persona, acotados (último por anclaje
  y versión, con contador), consultables por administración.

**Transversales**

- **FR-024**: Toda operación nueva MUST existir primero como planificada en el mapa del
  contrato con consumidor, capacidades, feature y fuente; las que faltan (obtener y desactivar
  merchant, activar experimento, leer configuración de plataforma, defaults y versiones del
  merchant, leer registro de administración y diagnósticos) entran al mapa antes que al contrato.
- **FR-025**: El aislamiento entre merchants MUST probarse también en administración (un
  operador con alcance a A no ve ni toca a B) y en la configuración del SDK.
- **FR-026**: El esquema de seguridad del consumidor `admin` MUST quedar decidido (deja de ser
  `PROPUESTO` en ADR-020) con la forma de FR-007.

### Key Entities

- **Merchant**: identidad acuñada por OPE, estado (`active`, `off`, `deactivated`), orígenes
  permitidos, credenciales vigentes por tipo (hasta dos, con vencimiento de gracia), instante de
  creación. Cambia rara vez y sólo por operaciones de seguridad u operación.
- **Credencial**: clase (ingesta, plataforma, secreto de firma), huella no reversible, instante
  de emisión, vencimiento (sólo tras una rotación). Se muestra una vez.
- **Versión de configuración del merchant**: número secuencial por merchant, contenido
  declarado (sólo lo que el merchant sobrescribe), instante, operador, marca de correctiva y
  motivo. Inmutable.
- **Configuración de plataforma** y **defaults de tratamiento**: contenido y versión declarados
  en el release; sólo lectura en ejecución.
- **Configuración efectiva**: resultado de la resolución valor por valor; identificada por la
  terna de versiones (plataforma, defaults, merchant) que cada decisión estampa.
- **Experimento**: identificador, merchant, reparto y semilla inmutables, muestra objetivo y
  cortes, estado (`calibrating`, `active`, `closed`), instantes de creación, activación,
  reinicios de ventana y cierre.
- **Operador**: identificador (no personal), tokens vigentes (hasta dos, rotables), alcance
  (todos o lista de merchants).
- **Entrada del registro de administración**: operador, instante, operación, merchant,
  resultado (aceptada, rechazada, prohibida), versión o experimento resultante, motivo
  declarado si lo hubo.
- **Diagnóstico de anclaje**: merchant, anclaje, tipo de página, versión de configuración,
  último instante, contador.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un operador da de alta un merchant y lo deja listo para recibir tráfico (creado,
  credenciales entregadas, configuración publicada) con llamadas a la API en menos de cinco
  minutos y sin ningún reinicio ni despliegue.
- **SC-002**: Apagar o encender OPE en un merchant tiene efecto en la siguiente solicitud del
  SDK, sin reinicio; durante el apagado el SDK sigue recibiendo respuestas válidas y la
  plataforma sigue pudiendo notificar órdenes.
- **SC-003**: El 100 % de las decisiones registradas desde esta feature lleva la terna de
  versiones de configuración efectiva; una decisión de calibración es distinguible de una de
  la ventana de acumulación.
- **SC-004**: Con un experimento activo, el 100 % de las publicaciones no correctivas de
  configuración se rechazan; las correctivas quedan registradas con motivo y reinicio.
- **SC-005**: No queda en el código ninguna constante de comportamiento de las inventariadas en
  la evaluación del 2026-09-20 (frescura, nivel de sincronización, deduplicación, memoria de
  sesión y de visitante, políticas por defecto); un release cuyos archivos de plataforma o
  defaults nombran algo que el código no conoce no se construye.
- **SC-006**: El 100 % de los intentos de administración fuera del alcance del operador se
  rechazan sin revelar la existencia del merchant, y quedan registrados; las pruebas de
  aislamiento existentes siguen pasando con los merchants creados por la API.
- **SC-007**: Todos los gates del repositorio en verde al cierre de cada historia, con cero
  excepciones nuevas de lint, idioma o mutación.

## Assumptions

- Los tokens de operador se emiten fuera de banda como configuración del despliegue (una
  variable de entorno con operadores, huellas de token y alcance); no hay alta de operadores
  por API en esta feature.
- El kill switch apaga la **decisión**, no la **medición**: catálogo, órdenes y devoluciones se
  siguen aceptando para no romper la cadena de evidencia; el motivo de `NO_OP` es un valor nuevo
  del catálogo de motivos.
- La ventana de gracia de una rotación la declara el operador en cada rotación, con un máximo
  de plataforma; por defecto, sin gracia (la anterior deja de valer de inmediato).
- El mapa de anclajes es parte de la configuración versionada del merchant aunque no sea un
  tratamiento: cambiarlo durante un experimento activo cuenta como correctivo (es el caso que
  D-G prevé: devolver el sistema a lo que debía hacer).
- Los defaults de tratamiento y la configuración de plataforma se identifican por una versión
  declarada en el archivo (no por un hash), que el release valida y estampa.
- Las políticas de decisión y comercial que hoy existen (`default-1`, `commercial-default-1`)
  son el contenido inicial de los defaults; los merchants de desarrollo y de prueba las
  referencian y el comportamiento observable de hoy no cambia.
- La memoria de sesión y de visitante siguen siendo ventanas de plataforma (lo publica el
  contrato: TTL de 24 h); la ventana de deduplicación y la tolerancia de reloj, también.
- "Sin reinicio" significa dentro de una sola instancia del plano de decisión; multi-instancia
  e invalidación de caché quedan fuera (`01 §9`).
- El contrato está marcado en construcción: un cambio incompatible entra con bump MINOR.

## Fuera de alcance

- Persistencia durable de merchants, configuración, experimentos, registro de administración
  y diagnósticos (feature de persistencia: un solo motor, Postgres; un Postgres embebido para
  desarrollo como candidato a investigar).
- Construir los modos `pull` y `subscribe`, el refresco parcial de stock y precio, el
  planificador y el consumidor (feature del puerto de plataforma); aquí sólo se declaran.
- Catálogo de mensajes por idioma (los idiomas se configuran; el texto llega con esa feature).
- Portal del merchant, self-service del merchant y alta de operadores por API.
- Modificar en caliente la configuración de plataforma o los defaults (aditivo, si alguna vez
  hace falta).
- Multi-instancia, invalidación de caché y reparto del registro de administración.
