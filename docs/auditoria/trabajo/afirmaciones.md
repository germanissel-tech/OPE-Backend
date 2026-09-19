# Afirmaciones DECIDIDAS y su evidencia

Extraídas en la fase 0 (2026-09-19) de la constitución, los documentos del MVP y las specs 001–013. La columna `evidencia` se resuelve en la fase 4: prueba o gate con ruta y nombre, `hueco: …`, o `F-NNN` cuando el código contradice la afirmación. Los enunciados `PROPUESTO`/`ABIERTO` de los documentos van en la tabla final y no generan `high`.

## Constitución (principios I–X y Flujo de desarrollo)

| id    | origen                           | estado | afirmación                                                                                                                                             | evidencia |
| ----- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-001 | constitution#I                   | MUST   | Cada autoridad vive en su propio módulo con interfaz explícita y sin depender de las demás salvo por el contrato de entrada/salida que transporta el…  |           |
| A-002 | constitution#I                   | MUST   | El orquestador se limita a armar contexto e invocar autoridades en orden; no infiere barreras, no rankea candidatos ni elige mensajes                  |           |
| A-003 | constitution#I                   | MUST   | La política comercial es la única autoridad que emite el veredicto final; ninguna otra fuerza una intervención                                         |           |
| A-004 | constitution#I                   | MUST   | Composition root único; ningún módulo instancia infraestructura ni importa clientes concretos fuera de él                                              |           |
| A-005 | constitution#II                  | MUST   | Todo paso del pipeline puede terminar en NO_OP con motivo explícito y registrado; NO_OP no es excepción                                                |           |
| A-006 | constitution#II                  | MUST   | El stock es guardia, no claim: nunca se afirma disponibilidad ni cantidades                                                                            |           |
| A-007 | constitution#II                  | MUST   | Un claim inventado o contradictorio invalida el mensaje entero (UNACCEPTABLE); el quality gate es puro y no se relaja                                  |           |
| A-008 | constitution#II                  | MUST   | Sin configuración de margen la política bloquea todo candidato con componente económico; sin ledger la intervención se suprime                         |           |
| A-009 | constitution#II                  | MUST   | El perfil de datos se mide, no se declara: nivel efectivo = mínimo entre configurado y observado; degrada solo                                         |           |
| A-010 | constitution#III                 | MUST   | Asignación CONTROL/TREATMENT determinista y estable por visitorId, sin estado compartido, registrada al asignar                                        |           |
| A-011 | constitution#III                 | MUST   | CONTROL atraviesa el mismo pipeline; la política resuelve siempre NO_OP; toda diferencia de comportamiento entre brazos es un defecto                  |           |
| A-012 | constitution#III                 | MUST   | El aprendizaje no realimenta la decisión durante el experimento                                                                                        |           |
| A-013 | constitution#III                 | MUST   | La asignación experimental no es un feature flag: no comparten mecanismo                                                                               |           |
| A-014 | constitution#III                 | MUST   | La configuración del merchant se versiona y cada decisión del ledger estampa la versión con la que se tomó                                             |           |
| A-015 | constitution#III                 | MUST   | La observabilidad es un observador puro: no modifica una decisión                                                                                      |           |
| A-016 | constitution#III                 | MUST   | Cinco estados de la cadena de evidencia explícitos; ninguno se infiere del anterior; PENDING_CORRELATION / NOT_AVAILABLE nunca cero                    |           |
| A-017 | constitution#IV                  | MUST   | Plano de decisión síncrono, acotado, sin I/O de red saliente ni escrituras bloqueantes; objetivo < 150 ms medido por percentil                         |           |
| A-018 | constitution#IV                  | MUST   | Plano de medición asíncrono, durable, auditable; no comparte presupuesto de latencia                                                                   |           |
| A-019 | constitution#IV                  | MUST   | Redis es estado caliente con expiración, no fuente durable; PostgreSQL es la fuente durable                                                            |           |
| A-020 | constitution#IV                  | MUST   | Una sola instancia del plano de decisión; las garantías se declaran como de instancia única                                                            |           |
| A-021 | constitution#V                   | MUST   | merchantId se deriva siempre de la credencial; nunca del body, query ni path salvo la ruta de admin (ADR-020)                                          |           |
| A-022 | constitution#V                   | MUST   | merchantId forma parte de toda frontera de datos (clave o predicado de cada consulta y escritura)                                                      |           |
| A-023 | constitution#V                   | MUST   | Clave de ingesta por merchant, rotable y distinta de las credenciales del portal                                                                       |           |
| A-024 | constitution#V                   | MUST   | Toda feature que toca persistencia o API incluye pruebas de contaminación cruzada entre merchants                                                      |           |
| A-025 | constitution#V                   | MUST   | No hay estado global compartido entre merchants en proceso                                                                                             |           |
| A-026 | constitution#VI                  | MUST   | Cuatro identidades con un propósito cada una; orderId es la única identidad de idempotencia de compra; eventId nunca lo es                             |           |
| A-027 | constitution#VI                  | MUST   | Chequeo y registro de una orden ya procesada sin operación asíncrona intermedia                                                                        |           |
| A-028 | constitution#VI                  | MUST   | La pérdida de visitorId produce un visitante nuevo: se cuantifica y reporta, no se compensa con inferencias                                            |           |
| A-029 | constitution#VII                 | MUST   | El contrato de evento es una lista blanca; campos no declarados se rechazan con error ruidoso, no se limpian                                           |           |
| A-030 | constitution#VII                 | MUST   | Nunca se registran nombre, email, teléfono, dirección, formularios, pago, documentos, grabación, IP persistida ni huella identificatoria               |           |
| A-031 | constitution#VII                 | MUST   | El conector de órdenes se acota a orderId, monto, moneda, ítems (SKU, cantidad), fecha e identificador de OPE; campos adicionales se rechazan          |           |
| A-032 | constitution#VII                 | MUST   | La frase autorizada es 'OPE no almacena información identificatoria'; nunca 'no maneja datos personales'                                               |           |
| A-033 | constitution#VIII                | MUST   | Cero llamadas a modelos de lenguaje en el runtime; los mensajes son curados y versionados                                                              |           |
| A-034 | constitution#IX                  | MUST   | Toda cifra se reconstruye desde el ledger; el ledger es append-only; Decision guarda barrera, evidencia, candidatos, veredicto, brazo, versión y resu… |           |
| A-035 | constitution#X                   | MUST   | El puerto de plataforma tiene exactamente cuatro operaciones y el núcleo no sabe qué plataforma hay detrás                                             |           |
| A-036 | constitution#X                   | MUST   | Adaptador genérico y adaptador de prueba desde el día uno; Magento 2 primer adaptador real; VTEX documental                                            |           |
| A-037 | constitution#X                   | MUST   | Lo que varía por merchant es configuración versionada, no código                                                                                       |           |
| A-038 | constitution#X                   | MUST   | Mecanismo A es la única fuente autoritativa de atribución; B corrobora; C nunca es autoridad                                                           |           |
| A-039 | constitution#Contrato de datos   | MUST   | Porcentajes 0–100 sólo en el borde; tasas 0–1 adentro; la normalización ocurre una vez en el borde                                                     |           |
| A-040 | constitution#Contrato de datos   | MUST   | Frescura por merchant: un dato más viejo que su presupuesto se trata como ausente                                                                      |           |
| A-041 | constitution#Contrato de datos   | MUST   | Exactamente tres barreras (talle_calce, precio_valor, cambios_devoluciones)                                                                            |           |
| A-042 | constitution#Contrato de datos   | MUST   | Superficies: ficha entra; carrito construido con activación pendiente; home, listado y checkout fuera                                                  |           |
| A-043 | constitution#Contrato de datos   | MUST   | PENDING_CORRELATION y NOT_AVAILABLE son valores de primera clase, nunca null ni 0                                                                      |           |
| A-044 | constitution#Stack               | MUST   | TypeScript strict; sin any salvo en fronteras encapsuladas; un módulo por autoridad; DI explícita; composition root único; sin singletons              |           |
| A-045 | constitution#Stack               | MUST   | Tipos y validadores de runtime se generan desde el contrato, nunca a mano en paralelo                                                                  |           |
| A-046 | constitution#Stack               | MUST   | Logs estructurados con merchantId, sessionId, decisionId; latencia por percentil; tasa y motivo de NO_OP                                               |           |
| A-047 | constitution#Stack               | MUST   | Kill switch global por merchant, efectivo sin deploy (014 planificada)                                                                                 |           |
| A-048 | constitution#Flujo de desarrollo | MUST   | Cada autoridad tiene pruebas unitarias como función pura; cada endpoint pruebas de contrato contra el OpenAPI                                          |           |
| A-049 | constitution#Flujo de desarrollo | MUST   | Existe una prueba end-to-end evento → decisión → exposición → orden → atribución con el adaptador de prueba                                            |           |
| A-050 | constitution#Flujo de desarrollo | MUST   | Las pruebas de contaminación cruzada corren en cada build                                                                                              |           |
| A-051 | constitution#Flujo de desarrollo | MUST   | Nada se afirma como funcionando sin evidencia ejecutable; marcadores contables; sin cifras vivas en prosa                                              |           |

## 01-arquitectura-mvp.md (§4, §5, §6, §9, §10)

| id    | origen      | estado      | afirmación                                                                                                                                             | evidencia |
| ----- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-052 | mvp:01#4    | DECIDIDO    | Cinco pasos en orden fijo coordinados por el orquestador; cada paso puede terminar en NO_OP y eso es un resultado correcto                             |           |
| A-053 | mvp:01#4.1  | DECIDIDO    | Asignación determinista y estable por visitante, sin estado compartido, registrada al asignar; CONTROL atraviesa todo el pipeline y la política resue… |           |
| A-054 | mvp:01#4.2  | DECIDIDO    | Una barrera dominante entre exactamente tres (talle/calce, precio/valor, cambios/devoluciones); sin umbral superado ⇒ NO_OP por evidencia insuficiente |           |
| A-055 | mvp:01#4.3  | DECIDIDO    | Evidencia a nivel de variante exacta; el stock es guardia, no claim; la escasez numérica queda fuera; dato dudoso o viejo ⇒ no se afirma               |           |
| A-056 | mvp:01#4.4  | DECIDIDO    | Mensajes curados y versionados; el quality gate es puro; un claim inventado invalida el mensaje entero; una barrera por mensaje; sin estados internos… |           |
| A-057 | mvp:01#4.5  | DECIDIDO    | La política comercial es el último filtro y única autoridad del veredicto: techo del merchant, consciente de margen y de riesgo de devolución, alta i… |           |
| A-058 | mvp:01#4.6  | `PROPUESTO` | Objetivo < 150 ms como objetivo de diseño, no SLA; ninguna llamada de red ni escritura bloqueante en el camino crítico; catálogo y configuración desd… |           |
| A-059 | mvp:01#4.7  | DECIDIDO    | Degradación: backend no responde ⇒ el SDK calla; sin Redis ⇒ tiende a NO_OP; catálogo ausente ⇒ NO_OP; margen ausente ⇒ bloqueo económico; ledger no…  |           |
| A-060 | mvp:01#4.8  | DECIDIDO    | Cero llamadas a modelos de lenguaje en el runtime; los usos son offline y pre-generados                                                                |           |
| A-061 | mvp:01#5    | DECIDIDO    | Cinco estados de la cadena de evidencia (ASSIGNED, EXPOSED, VERIFIED_ORDER, ATTRIBUTED_ORDER, RETURNED); ninguno se infiere del anterior; el resultad… |           |
| A-062 | mvp:01#5.2  | DECIDIDO    | Estados explícitos de desconocimiento: PENDING_CORRELATION y NOT_AVAILABLE, visibles, nunca cero                                                       |           |
| A-063 | mvp:01#5.3  | DECIDIDO    | El titular económico es Incremental Contribution por ITT, con intervalo de confianza, tamaño de grupos y estado de acumulación (016)                   |           |
| A-064 | mvp:01#6    | DECIDIDO    | eventId dedup de ingesta; sessionId agrupa y expira; visitorId estabilidad de asignación y memoria; orderId identidad de compra e idempotencia de out… |           |
| A-065 | mvp:01#6    | DECIDIDO    | orderId es la única identidad válida para idempotencia de compra; chequeo y registro sin operación asíncrona intermedia; pérdida de visitorId = visit… |           |
| A-066 | mvp:01#9    | DECIDIDO    | Se garantiza durabilidad (017), idempotencia de orden con orderId, recuperación tras reinicio graceful, orden de escritura por merchant y reconstrucc… |           |
| A-067 | mvp:01#9    | DECIDIDO    | Una sola instancia del plano de decisión                                                                                                               |           |
| A-068 | mvp:01#10.1 | DECIDIDO    | OPE observa comportamiento, no personas: aplica a todo el producto                                                                                     |           |
| A-069 | mvp:01#10.2 | DECIDIDO    | Se registra: ids propios, página/producto/variante, interacción y momento, estado derivado, decisiones/exposiciones/NO_OP, hechos comerciales, config… |           |
| A-070 | mvp:01#10.3 | DECIDIDO    | Lista blanca en el contrato de evento; la ingesta rechaza (no limpia) campos no declarados; el conector de órdenes acotado a orderId, monto, moneda,…  |           |
| A-071 | mvp:01#10.4 | DECIDIDO    | Decir 'OPE no almacena información identificatoria'; no decir 'no maneja datos personales'                                                             |           |
| A-072 | mvp:01#10.5 | DECIDIDO    | El histórico de devoluciones sólo con clave seudónima del merchant; el principio gana sobre la funcionalidad; dentro de la sesión el riesgo se estima… |           |
| A-073 | mvp:01#10.7 | DECIDIDO    | merchantId siempre de la credencial; clave de ingesta rotable y distinta de las del portal; merchant en toda frontera de datos con pruebas de contami… |           |

## 02-integracion-ecommerce.md (§4, §5)

| id    | origen     | estado      | afirmación                                                                                                                                             | evidencia |
| ----- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-074 | mvp:02#4   | `PROPUESTO` | Ingesta periódica del catálogo completo más refresco de alta frecuencia de stock y precio                                                              |           |
| A-075 | mvp:02#4   | DECIDIDO    | Nunca se consulta a la plataforma dentro del camino crítico; el motor de evidencia lee de caché caliente y falla cerrado si está vieja                 |           |
| A-076 | mvp:02#4   | DECIDIDO    | El stock es guardia, no claim; perfil de datos por nivel (0–3) que se mide y degrada solo                                                              |           |
| A-077 | mvp:02#5.1 | DECIDIDO    | Mecanismo A: la plataforma notifica servidor a servidor con el identificador de sesión de OPE adjuntado al crear la orden; B corrobora desde el naveg… |           |
| A-078 | mvp:02#5.2 | DECIDIDO    | A autoritativo, B corroboración y disparador, C nunca autoridad; toda orden entra como VERIFIED_ORDER y sólo pasa a ATTRIBUTED_ORDER con correlación…  |           |
| A-079 | mvp:02#5.2 | DECIDIDO    | Sólo B ⇒ medición degradada si la pérdida de confirmaciones es equivalente entre brazos; sólo C ⇒ sin afirmación económica atribuida                   |           |
| A-080 | mvp:02#5.4 | DECIDIDO    | La devolución se vincula al orderId ya presente en el ledger; llega con días de retraso (plano asíncrono)                                              |           |
| A-081 | mvp:02#6.1 | DECIDIDO    | Un puerto de plataforma con cuatro operaciones (obtenerCatalogo, obtenerStockYPrecio, alConfirmarOrden, alRegistrarDevolucion); los conectores viven…  |           |
| A-082 | mvp:02#6.2 | DECIDIDO    | El adaptador genérico (catálogo por REST/archivo + notificación HTTP de orden) es la implementación de referencia desde el día uno                     |           |

## 03-alcance-mvp.md (§4.5, §4.7, §4.8, §4.11, §6, §10)

| id    | origen      | estado                                     | afirmación                                                                                                                                             | evidencia |
| ----- | ----------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-083 | mvp:03#4.5  | DECIDIDO                                   | Evidencia permitida: política de cambios/devoluciones, atributos autorizados, datos de calce del merchant, precio vigente. Fuera: escasez numérica, a… |           |
| A-084 | mvp:03#4.7  | DECIDIDO                                   | Memoria de sesión (secuencia, estado, cooldown, fatiga) y memoria entre sesiones del mismo visitante entran; riesgo de devolución por comportamiento…  |           |
| A-085 | mvp:03#4.8  | DECIDIDO                                   | Escalera información → reaseguro → reducción de incertidumbre → evidencia → incentivo; con precio dominante el incentivo entra de inmediato; techo de… |           |
| A-086 | mvp:03#4.8  | DECIDIDO                                   | Ante abandono de carrito sin señal previa la respuesta es reaseguro, con prioridad baja                                                                |           |
| A-087 | mvp:03#4.11 | DECIDIDO                                   | Registra ids propios, producto/variante, interacciones, barrera y decisión, orden (número, monto, ítems), configuración; nunca nombre/email/teléfono/… |           |
| A-088 | mvp:03#6    | DECIDIDO (técnico) / pendiente de producto | D-E evidencia limitada a catálogo y configuración; D-B abandono actúa sobre la barrera detectada, incentivo sólo si es precio; D-C histórico de devol… |           |
| A-089 | mvp:03#10   | DECIDIDO                                   | Criterio 2: las señales de §4.1 llegan al backend, deduplicadas y aisladas por merchant                                                                |           |
| A-090 | mvp:03#10   | DECIDIDO                                   | Criterio 3: cada visitante recibe asignación determinista y estable, registrada al asignar                                                             |           |
| A-091 | mvp:03#10   | DECIDIDO                                   | Criterio 4: el pipeline resuelve intervención o NO_OP para las tres barreras dentro del presupuesto de latencia, medido por percentil                  |           |
| A-092 | mvp:03#10   | DECIDIDO                                   | Criterio 5: las intervenciones se renderizan en los anclajes acordados y la exposición se confirma desde el navegador (backend: confirmExposure)       |           |
| A-093 | mvp:03#10   | DECIDIDO                                   | Criterio 6: una orden confirmada llega desde la plataforma, se correlaciona y queda VERIFIED_ORDER y, con correlación verificable, ATTRIBUTED_ORDER    |           |
| A-094 | mvp:03#10   | DECIDIDO                                   | Criterio 7: flags por merchant, configuración estampada en cada decisión del ledger, kill switch sin deploy (014)                                      |           |
| A-095 | mvp:03#10   | DECIDIDO                                   | Criterio 8: el perfil de datos efectivo se mide y degrada solo                                                                                         |           |
| A-096 | mvp:03#10   | DECIDIDO                                   | Criterio 9: cualquier cifra del reporte se reconstruye desde el ledger hasta el evento                                                                 |           |
| A-097 | mvp:03#10   | DECIDIDO                                   | Criterio 10: el portal muestra salud operativa y evolución del tramo (016)                                                                             |           |
| A-098 | mvp:03#10   | DECIDIDO                                   | Criterio 11: el aislamiento por merchant está probado contra contaminación cruzada                                                                     |           |
| A-099 | mvp:03#10   | DECIDIDO                                   | Criterio 1: tag y SDK (Zona A, fuera de este backend: se declara)                                                                                      |           |

## Specs 001–013 (FR y SC)

Estado por defecto `DECIDIDO` (una spec aprobada); los `FR` que la spec o su quickstart marcan como desvío o pendiente se anotan en la fase 4.

### 001-api-contract-toolchain

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-100 | spec:001#FR-001 | DECIDIDO | El contrato MUST estar en OpenAPI 3.1, dividido en múltiples archivos bajo `contracts/` (raíz + paths + componentes + webhooks + ejemplos), unidos po… |           |
| A-101 | spec:001#FR-002 | DECIDIDO | La verificación MUST producir un contrato empaquetado en un solo archivo, que es el artefacto que consumen tipos, mock, documentación y pruebas.       |           |
| A-102 | spec:001#FR-003 | DECIDIDO | El contrato MUST declarar su versión con semántica mayor.menor.parche en `info.version`, y las rutas MUST llevar prefijo de versión mayor (`/v1`).     |           |
| A-103 | spec:001#FR-004 | DECIDIDO | El contrato MUST declarar un catálogo cerrado de etiquetas (`tags`) y toda operación MUST usar exactamente una de ellas. Para esta feature el catálog… |           |
| A-104 | spec:001#FR-005 | DECIDIDO | El contrato MUST definir un esquema reutilizable de Problem Details conforme a RFC 9457 (`type`, `title`, `status`, `detail`, `instance`, más extensi… |           |
| A-105 | spec:001#FR-006 | DECIDIDO | El contrato MUST incluir la operación `getHealth` (`GET /v1/health`, tag `system`), sin autenticación, que responde `200` con estado del servicio, ve… |           |
| A-106 | spec:001#FR-010 | DECIDIDO | Un único comando MUST ejecutar toda la verificación del contrato y terminar con código distinto de cero ante cualquier violación.                      |           |
| A-107 | spec:001#FR-011 | DECIDIDO | La verificación MUST fallar ante violaciones de estilo y estructura de OpenAPI (referencias rotas, esquemas inválidos, rutas duplicadas).              |           |
| A-108 | spec:001#FR-012 | DECIDIDO | La verificación MUST fallar si una operación carece de `operationId`, `summary`, `description` o `tags`, o si un `operationId` está duplicado o no es… |           |
| A-109 | spec:001#FR-013 | DECIDIDO | La verificación MUST fallar si una propiedad de esquema carece de `description`.                                                                       |           |
| A-110 | spec:001#FR-014 | DECIDIDO | La verificación MUST fallar si un request body o una respuesta `2xx` con cuerpo carece de al menos un ejemplo.                                         |           |
| A-111 | spec:001#FR-015 | DECIDIDO | La verificación MUST fallar si un esquema usado como request body (o cualquier objeto anidado en él) no declara `additionalProperties: false`.         |           |
| A-112 | spec:001#FR-016 | DECIDIDO | La verificación MUST fallar si cualquier esquema, parámetro o header declara una propiedad cuyo nombre coincide (sin distinguir mayúsculas) con la li… |           |
| A-113 | spec:001#FR-017 | DECIDIDO | La verificación MUST fallar si `merchantId` (sin distinguir mayúsculas ni separadores) aparece como parámetro de path, query, header o cookie, o como… |           |
| A-114 | spec:001#FR-018 | DECIDIDO | La verificación MUST fallar si una respuesta `4xx` o `5xx` no usa el tipo de contenido `application/problem+json` con el esquema Problem Details del…  |           |
| A-115 | spec:001#FR-019 | DECIDIDO | La verificación MUST fallar si una operación no declara `500`; si una operación autenticada no declara `401`; si una operación con request body no de… |           |
| A-116 | spec:001#FR-020 | DECIDIDO | La verificación MUST comparar el contrato empaquetado con el de la rama principal y fallar ante cambios incompatibles cuando la versión mayor no aume… |           |
| A-117 | spec:001#FR-021 | DECIDIDO | Cada violación reportada MUST indicar regla, archivo y posición, y una frase que explique cómo corregirla.                                             |           |
| A-118 | spec:001#FR-030 | DECIDIDO | Un comando MUST generar los tipos de request/response de todas las operaciones a partir del contrato empaquetado, de forma determinista, en un direct… |           |
| A-119 | spec:001#FR-031 | DECIDIDO | La verificación MUST fallar si los tipos commiteados difieren de la regeneración.                                                                      |           |
| A-120 | spec:001#FR-032 | DECIDIDO | Un comando MUST generar documentación navegable estática desde el contrato empaquetado, y MUST rehusarse si la verificación del contrato falla.        |           |
| A-121 | spec:001#FR-033 | DECIDIDO | El repositorio MUST proveer un cliente HTTP tipado para consumidores (SDK, portal) derivado de los mismos tipos generados, con presupuesto de peso co… |           |
| A-122 | spec:001#FR-040 | DECIDIDO | El servidor MUST cargar el contrato al arrancar y rehusarse a arrancar si el contrato no es válido.                                                    |           |
| A-123 | spec:001#FR-041 | DECIDIDO | El servidor MUST rutear cada request al manejador registrado bajo el `operationId` correspondiente. No MUST existir otro mecanismo de registro de rut… |           |
| A-124 | spec:001#FR-042 | DECIDIDO | El servidor MUST validar parámetros, headers y cuerpo del request contra el contrato antes de invocar el manejador; ante violación responde `400` o `… |           |
| A-125 | spec:001#FR-043 | DECIDIDO | El servidor MUST validar la respuesta del manejador contra el contrato antes de enviarla; ante violación responde `500` con Problem Details y registr… |           |
| A-126 | spec:001#FR-044 | DECIDIDO | El servidor MUST responder `404` Problem Details ante rutas no declaradas, `405` ante métodos no declarados y `501` ante operaciones declaradas sin m… |           |
| A-127 | spec:001#FR-045 | DECIDIDO | El servidor MUST responder `500` con Problem Details genérico ante excepciones no controladas, sin exponer detalles internos.                          |           |
| A-128 | spec:001#FR-046 | DECIDIDO | Los manejadores MUST recibir y devolver los tipos generados; un manejador con tipo de respuesta incompatible MUST fallar la compilación.               |           |
| A-129 | spec:001#FR-047 | DECIDIDO | El manejador de `getHealth` MUST estar implementado y responder conforme al contrato.                                                                  |           |
| A-130 | spec:001#FR-050 | DECIDIDO | El repositorio MUST incluir pruebas unitarias del manejador de `getHealth` y pruebas de integración del servidor que cubran los escenarios de aceptac… |           |
| A-131 | spec:001#FR-051 | DECIDIDO | El repositorio MUST incluir pruebas de contrato generadas automáticamente desde el contrato contra el servidor levantado, ejecutables con un comando.  |           |
| A-132 | spec:001#FR-052 | DECIDIDO | El repositorio MUST incluir una prueba que ejercite cada regla de verificación del contrato (FR-012 a FR-020) con un caso que viola y verifica la fal… |           |
| A-133 | spec:001#FR-060 | DECIDIDO | Un flujo de integración continua MUST ejecutar, en cada cambio propuesto: verificación del contrato, comparación de compatibilidad contra la rama pri… |           |
| A-134 | spec:001#FR-061 | DECIDIDO | El repositorio MUST documentar en su guía para agentes los comandos y el orden de trabajo (contrato → verificación → tipos → manejador → pruebas).     |           |
| A-135 | spec:001#SC-001 | DECIDIDO | Cada una de las reglas FR-012 a FR-020 tiene una prueba que demuestra que un contrato que la viola falla la verificación; 100 % de las reglas cubiert… |           |
| A-136 | spec:001#SC-002 | DECIDIDO | Un agente que agrega una operación que viola una regla recibe la falla en menos de 30 segundos de ejecución local, con archivo y línea, sin necesidad… |           |
| A-137 | spec:001#SC-003 | DECIDIDO | `GET /v1/health` responde conforme al contrato en el servidor real, en el mock y en la documentación generada, sin que ningún texto de la operación e… |           |
| A-138 | spec:001#SC-004 | DECIDIDO | La verificación completa (contrato + compatibilidad + tipos + compilación + pruebas) corre en integración continua en menos de 5 minutos sobre el est… |           |
| A-139 | spec:001#SC-005 | DECIDIDO | Ninguna ruta puede servirse sin estar en el contrato: una prueba lo demuestra intentando registrar un manejador con un `operationId` inexistente y ve… |           |
| A-140 | spec:001#SC-006 | DECIDIDO | Dos generaciones consecutivas de tipos y de documentación sobre el mismo contrato producen artefactos byte a byte idénticos.                           |           |
| A-141 | spec:001#SC-007 | DECIDIDO | Un consumidor puede hacer un request tipado a `getHealth` con el cliente generado, y un uso con tipo incorrecto no compila.                            |           |

### 002-gobernanza-contrato-codigo

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-142 | spec:002#FR-001 | DECIDIDO | El contrato MUST permitir declarar invariantes sobre un esquema o una operación, cada una con: tipo de error (identificador del catálogo), código HTT… |           |
| A-143 | spec:002#FR-002 | DECIDIDO | La verificación MUST fallar si una invariante carece de alguno de los cuatro campos, si su tipo no está en el catálogo, o si su código HTTP no coinci… |           |
| A-144 | spec:002#FR-003 | DECIDIDO | La verificación MUST fallar si una invariante declarada no tiene una prueba del servidor cuyo nombre contenga su tipo; el mensaje indica el tipo y dó… |           |
| A-145 | spec:002#FR-004 | DECIDIDO | La verificación MUST fallar si una operación declara una respuesta `422` cuyo ejemplo o descripción referencia el tipo genérico `unprocessable`; toda… |           |
| A-146 | spec:002#FR-005 | DECIDIDO | La verificación MUST listar, con el contrato actual, cero invariantes sin fallar.                                                                      |           |
| A-147 | spec:002#FR-010 | DECIDIDO | El repositorio MUST tener un glosario con una nota por término, con término en castellano, término en inglés, fuente y estado; la fuente es una refer… |           |
| A-148 | spec:002#FR-011 | DECIDIDO | La verificación MUST fallar si un segmento de ruta o un título de esquema del contrato no resuelve (sin distinguir mayúsculas, singular/plural ni suf… |           |
| A-149 | spec:002#FR-012 | DECIDIDO | La verificación MUST fallar si una nota carece de fuente o la fuente no existe.                                                                        |           |
| A-150 | spec:002#FR-013 | DECIDIDO | La verificación MUST fallar si una nota no se usa en el contrato y no declara `uso: disponible` o `uso: pendiente`.                                    |           |
| A-151 | spec:002#FR-014 | DECIDIDO | La lista de vocabulario técnico MUST vivir en un solo lugar y ser ampliable.                                                                           |           |
| A-152 | spec:002#FR-020 | DECIDIDO | El repositorio MUST tener un registro de decisiones numerado (`ADR-NNN`) con estado, fecha y fuente por decisión, y las decisiones transversales de l… |           |
| A-153 | spec:002#FR-021 | DECIDIDO | La verificación MUST fallar si cualquier documento del repo cita un `ADR-NNN` que no existe.                                                           |           |
| A-154 | spec:002#FR-022 | DECIDIDO | Un comando MUST listar todos los marcadores `ABIERTO`, `PROPUESTO` y `PLACEHOLDER` presentes en el contrato y en la documentación, con archivo y líne… |           |
| A-155 | spec:002#FR-023 | DECIDIDO | Un comando de puerta de release MUST fallar si queda al menos un `ABIERTO` o `PLACEHOLDER`, y pasar con aviso si sólo hay `PROPUESTO`.                 |           |
| A-156 | spec:002#FR-024 | DECIDIDO | La guía de agentes MUST prohibir cifras sobre el estado del sistema en prosa viva y nombrar el comando que las informa.                                |           |
| A-157 | spec:002#FR-030 | DECIDIDO | La verificación MUST fallar si un media type de request o respuesta lleva el esquema inline en vez de una referencia a componentes.                    |           |
| A-158 | spec:002#FR-031 | DECIDIDO | La verificación MUST fallar si una operación con seguridad no vacía no declara una lista no vacía de capacidades requeridas, y si una operación públi… |           |
| A-159 | spec:002#FR-040 | DECIDIDO | El código MUST organizarse en cuatro capas con dirección de dependencia fija: dominio (no importa de ninguna otra capa ni de dependencias externas sa… |           |
| A-160 | spec:002#FR-041 | DECIDIDO | Una verificación ejecutable MUST fallar ante cualquier import que viole FR-040, nombrando archivo, import y regla, y MUST correr en el chequeo previo… |           |
| A-161 | spec:002#FR-042 | DECIDIDO | El código de la 001 MUST reubicarse en esas capas sin cambiar comportamiento: toda prueba de la 001 pasa sin modificar sus aserciones (sólo rutas de…  |           |
| A-162 | spec:002#FR-050 | DECIDIDO | Cada regla nueva (FR-002, FR-003, FR-004, FR-011, FR-012, FR-013, FR-021, FR-023, FR-030, FR-031, FR-041) MUST tener un caso que la viola y una prueb… |           |
| A-163 | spec:002#FR-051 | DECIDIDO | Todas las verificaciones nuevas MUST integrarse al comando único de verificación del contrato o al de pruebas, de modo que la integración continua la… |           |
| A-164 | spec:002#SC-001 | DECIDIDO | El 100 % de las reglas nuevas tiene una prueba que demuestra la falla ante la violación (mismo criterio que la 001).                                   |           |
| A-165 | spec:002#SC-002 | DECIDIDO | La verificación completa del contrato (la de la 001 más las nuevas) sigue corriendo localmente en menos de 30 segundos.                                |           |
| A-166 | spec:002#SC-003 | DECIDIDO | Toda la suite de la 001 pasa sin modificar ninguna aserción tras la reubicación en capas; el servidor responde byte a byte igual en los escenarios de… |           |
| A-167 | spec:002#SC-004 | DECIDIDO | Un agente nuevo puede encontrar cualquier decisión transversal de la 001 en el registro de decisiones sin abrir el research de la 001.                 |           |
| A-168 | spec:002#SC-005 | DECIDIDO | El comando de listado de marcadores devuelve cero bloqueantes sobre el estado de esta feature (lo abierto de la constitución, D3–D6, se registra como… |           |
| A-169 | spec:002#SC-006 | DECIDIDO | Con el contrato actual, el glosario contiene sólo los términos que el contrato usa (`health` es vocabulario técnico) y la verificación pasa; la prime… |           |

### 003-calidad-de-codigo

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-170 | spec:003#FR-001 | DECIDIDO | Un comando MUST analizar `src/`, `tests/`, `scripts/` y las funciones custom del contrato y fallar ante: `any` explícito; uso, asignación, llamada, r… |           |
| A-171 | spec:003#FR-002 | DECIDIDO | Toda excepción a una regla MUST ser inline, en la línea afectada, con un motivo escrito; una desactivación sin motivo o una desactivación que ya no a… |           |
| A-172 | spec:003#FR-003 | DECIDIDO | El comando MUST informar la cantidad de excepciones vigentes.                                                                                          |           |
| A-173 | spec:003#FR-004 | DECIDIDO | El lint MUST NOT contener reglas de formato; el formato es de una sola herramienta.                                                                    |           |
| A-174 | spec:003#FR-010 | DECIDIDO | Un comando MUST formatear TypeScript, JavaScript, JSON, YAML y Markdown según una única configuración, y otro MUST fallar si algún archivo difiere de… |           |
| A-175 | spec:003#FR-011 | DECIDIDO | Los archivos generados y los fixtures con violaciones deliberadas MUST quedar excluidos, en una lista única.                                           |           |
| A-176 | spec:003#FR-012 | DECIDIDO | El formato MUST ser idempotente y normalizar el fin de línea a LF.                                                                                     |           |
| A-177 | spec:003#FR-020 | DECIDIDO | Los scripts de `scripts/` y las funciones de `contracts/rules/functions/` MUST verificarse con tipos con el mismo comando de typecheck, sin cambiar s… |           |
| A-178 | spec:003#FR-021 | DECIDIDO | Las utilidades compartidas de esos scripts MUST tener sus firmas anotadas para que los consumidores se verifiquen.                                     |           |
| A-179 | spec:003#FR-030 | DECIDIDO | La configuración del compilador MUST exigir acceso explícito a index signatures, imports con efectos secundarios resolubles, sintaxis de módulos verb… |           |
| A-180 | spec:003#FR-040 | DECIDIDO | Un hook de pre-commit MUST correr formato y lint sobre los archivos staged y el typecheck, y rechazar el commit ante fallas; MUST NOT correr la verif… |           |
| A-181 | spec:003#FR-041 | DECIDIDO | El repositorio MUST tener `.editorconfig` coherente con el formateador.                                                                                |           |
| A-182 | spec:003#FR-050 | DECIDIDO | `lint` y `format:check` MUST correr en integración continua y figurar en la guía de agentes con el orden de trabajo actualizado.                       |           |
| A-183 | spec:003#FR-051 | DECIDIDO | Cada regla o verificación nombrada en FR-001, FR-002, FR-010, FR-020 y FR-030 MUST tener un caso que la viola y una prueba que confirma la falla.      |           |
| A-184 | spec:003#FR-052 | DECIDIDO | Toda la suite existente MUST pasar sin modificar aserciones; el servidor responde igual.                                                               |           |
| A-185 | spec:003#SC-001 | DECIDIDO | El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y una prueba que confirma la falla.                                       |           |
| A-186 | spec:003#SC-002 | DECIDIDO | `lint`, `format:check` y `typecheck` juntos corren localmente en menos de 60 segundos sobre el estado de esta feature; el hook de pre-commit sobre un… |           |
| A-187 | spec:003#SC-003 | DECIDIDO | El código existente pasa el lint con cero excepciones no justificadas; las justificadas están contadas y cada una nombra su motivo.                    |           |
| A-188 | spec:003#SC-004 | DECIDIDO | Toda la suite anterior pasa sin modificar aserciones; los escenarios manuales de la 001 (§3, §4) responden igual.                                      |           |
| A-189 | spec:003#SC-005 | DECIDIDO | Un agente nuevo que clona el repo e instala dependencias tiene formato, lint, typecheck y hook funcionando sin ningún paso manual adicional.           |           |

### 004-protocolo-sdk-ingesta

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-190 | spec:004#FR-001 | DECIDIDO | El código MUST organizarse en anillos con dirección de dependencia fija hacia adentro: dominio (puro) ← aplicación (casos de uso y los puertos que de… |           |
| A-191 | spec:004#FR-002 | DECIDIDO | Dentro de cada anillo el código MUST agruparse por módulo del sistema (`shared-kernel`, `system`, `merchant`, `ingestion`, `ledger` en esta feature;…  |           |
| A-192 | spec:004#FR-003 | DECIDIDO | La composición MUST ser un contenedor tipado de puertos con perfiles (memoria ahora; producción después) y reemplazos puntuales; MUST devolver la apl… |           |
| A-193 | spec:004#FR-004 | DECIDIDO | La verificación de arquitectura MUST cubrir anillos y módulos, con un fixture por regla, y correr en el chequeo previo a commit y en integración cont… |           |
| A-194 | spec:004#FR-005 | DECIDIDO | La reorganización MUST mantener la operación existente y toda la suite anterior sin modificar aserciones.                                              |           |
| A-195 | spec:004#FR-010 | DECIDIDO | El contrato MUST declarar la operación de ingesta de lotes, autenticada con la credencial de ingesta del merchant (pública, rotable, distinta de las…  |           |
| A-196 | spec:004#FR-011 | DECIDIDO | El contrato de evento MUST ser una lista blanca cerrada: tipo (exactamente los de 03 §4.1: vista de producto, vista de listado, interacción con selec… |           |
| A-197 | spec:004#FR-012 | DECIDIDO | La ingesta MUST rechazar el lote completo ante cualquier violación del contrato, nombrando cada violación; MUST NOT limpiar ni descartar campos silen… |           |
| A-198 | spec:004#FR-013 | DECIDIDO | La ingesta MUST deduplicar por `eventId` dentro del merchant: un evento repetido se reporta como duplicado y no se registra dos veces; el mismo `even… |           |
| A-199 | spec:004#FR-014 | DECIDIDO | La respuesta MUST informar, por evento, si entró o era duplicado, y el total.                                                                          |           |
| A-200 | spec:004#FR-015 | DECIDIDO | El tamaño máximo de lote y la tolerancia de instante (pasado/futuro) MUST estar declarados en el contrato y hacerse cumplir.                           |           |
| A-201 | spec:004#FR-016 | DECIDIDO | Ningún dato fuera de la lista blanca MUST registrarse ni escribirse en logs; la dirección IP del request MUST NOT persistirse ni loguearse.            |           |
| A-202 | spec:004#FR-017 | DECIDIDO | Las credenciales de ingesta MUST resolverse a través de un puerto del módulo `merchant`, con implementación en memoria cargada desde configuración (m… |           |
| A-203 | spec:004#FR-020 | DECIDIDO | Toda respuesta de ingesta aceptada MUST incluir una decisión con identificador único, resultado (`NO_OP` en esta feature) y motivo de un catálogo pro… |           |
| A-204 | spec:004#FR-021 | DECIDIDO | Una decisión MUST registrarse en el ledger (puerto, implementación en memoria) al emitirse, con su merchant, sesión, visitante, motivo e instante.     |           |
| A-205 | spec:004#FR-030 | DECIDIDO | El contrato MUST declarar la operación de confirmación de exposición (`decisionId`, `sessionId`, `visitorId`, instante, anclaje), autenticada igual q… |           |
| A-206 | spec:004#FR-031 | DECIDIDO | Una exposición MUST registrarse como `EXPOSED` sólo si la decisión existe para ese merchant y fue una intervención; una decisión inexistente, de otro… |           |
| A-207 | spec:004#FR-040 | DECIDIDO | El backend MUST responder a las peticiones previas de autorización del navegador aceptando únicamente los orígenes registrados del merchant identific… |           |
| A-208 | spec:004#FR-050 | DECIDIDO | Las pruebas MUST demostrar aislamiento entre merchants en: deduplicación, visibilidad de decisiones, exposiciones y orígenes.                          |           |
| A-209 | spec:004#FR-051 | DECIDIDO | Todo sustantivo nuevo del contrato MUST tener su nota en el glosario con fuente antes de usarse (`event`, `session`, `visitor`, `exposure`, `decision… |           |
| A-210 | spec:004#FR-052 | DECIDIDO | Toda regla no expresable por esquema MUST declararse como invariante con su tipo propio y prueba nombrada: al menos exposición de decisión inexistent… |           |
| A-211 | spec:004#FR-053 | DECIDIDO | La latencia de la ingesta MUST medirse por percentil en las pruebas (p50/p95) sobre el perfil en memoria y reportarse; no es un SLA.                   |           |
| A-212 | spec:004#SC-001 | DECIDIDO | Toda la suite de las features 001–003 pasa sin modificar aserciones tras la reorganización; `GET /v1/health` responde byte a byte igual.               |           |
| A-213 | spec:004#SC-002 | DECIDIDO | Cada regla de anillo y de módulo tiene un fixture que la viola y una prueba que confirma la falla; la verificación de arquitectura corre en menos de…  |           |
| A-214 | spec:004#SC-003 | DECIDIDO | Un lote válido de 20 eventos se acepta con p95 por debajo de 50 ms en el perfil en memoria (medido en pruebas, sin SLA), y el reenvío del mismo lote…  |           |
| A-215 | spec:004#SC-004 | DECIDIDO | El 100 % de los tipos de evento de 03 §4.1 está en el contrato, y un evento con un campo de más se rechaza con la ruta exacta del campo en el 100 % d… |           |
| A-216 | spec:004#SC-005 | DECIDIDO | Ninguna prueba de aislamiento (FR-050) permite que un merchant vea, duplique o confirme algo de otro.                                                  |           |
| A-217 | spec:004#SC-006 | DECIDIDO | El equipo del SDK puede desarrollar contra `npm run contract:mock` las tres operaciones (salud, ingesta, exposición) sin ningún cambio en el backend.  |           |
| A-218 | spec:004#SC-007 | DECIDIDO | `release-check` en verde: sin marcadores bloqueantes; el protocolo de decisión queda `PROPUESTO` (no bloquea) hasta la revisión del equipo del SDK.    |           |

### 005-auditoria-calidad

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-219 | spec:005#FR-001 | DECIDIDO | Todo texto legible por un desarrollador o por un consumidor de la API MUST estar en inglés: comentarios, strings, mensajes de error y de log, descrip… |           |
| A-220 | spec:005#FR-002 | DECIDIDO | Una verificación MUST fallar ante texto en español en el alcance de FR-001, nombrando archivo, línea y fragmento; MUST detectar tanto caracteres prop… |           |
| A-221 | spec:005#FR-003 | DECIDIDO | Una excepción MUST declararse en la línea afectada con motivo escrito; sin motivo MUST fallar; el resumen MUST contar las excepciones vigentes.        |           |
| A-222 | spec:005#FR-004 | DECIDIDO | Los artefactos generados y los fixtures con español deliberado MUST quedar excluidos en la misma lista única que hoy usan lint y formato.              |           |
| A-223 | spec:005#FR-005 | DECIDIDO | Todo el texto existente en el alcance de FR-001 MUST migrarse en esta feature; las descripciones del contrato traducidas MUST ser compatibles hacia a… |           |
| A-224 | spec:005#FR-006 | DECIDIDO | La regla de idioma y su motivo MUST registrarse como decisión transversal y en la guía de agentes.                                                     |           |
| A-225 | spec:005#FR-010 | DECIDIDO | El lint MUST fallar ante una función con complejidad cognitiva mayor que 15, anidamiento mayor que 3 niveles, más de 4 parámetros o más de 60 líneas,… |           |
| A-226 | spec:005#FR-011 | DECIDIDO | El lint MUST fallar ante funciones idénticas, ramas idénticas de un condicional, condiciones repetidas en una cadena, condicionales anidados colapsab… |           |
| A-227 | spec:005#FR-012 | DECIDIDO | El lint MUST fallar ante un número literal distinto de 0, 1 y −1 en código de producción; MUST NOT aplicarlo en pruebas.                               |           |
| A-228 | spec:005#FR-013 | DECIDIDO | Cada límite numérico de configuración MUST llevar al lado su justificación.                                                                            |           |
| A-229 | spec:005#FR-020 | DECIDIDO | Una verificación MUST fallar ante fragmentos estructuralmente iguales de al menos 5 líneas (o su equivalente en tokens) entre archivos de producción,… |           |
| A-230 | spec:005#FR-021 | DECIDIDO | Una verificación MUST fallar ante archivos de producción sin importador, exports sin uso y dependencias declaradas sin uso, con exclusiones explícita… |           |
| A-231 | spec:005#FR-030 | DECIDIDO | Una verificación MUST analizar por mutación sólo las líneas de producción introducidas o modificadas por el cambio respecto de la rama principal, y M… |           |
| A-232 | spec:005#FR-031 | DECIDIDO | Un análisis de mutación sobre el repositorio completo MUST correr de forma programada e informativa, publicando su reporte sin bloquear.               |           |
| A-233 | spec:005#FR-032 | DECIDIDO | Archivos sin lógica (tipos, constantes, punto de composición, generados) MUST quedar fuera del análisis por lista explícita.                           |           |
| A-234 | spec:005#FR-033 | DECIDIDO | Sin líneas de producción en el cambio, o sin base de comparación, la verificación MUST pasar informándolo.                                             |           |
| A-235 | spec:005#FR-040 | DECIDIDO | La prueba de arquitectura MUST fallar ante un archivo de dominio o de aplicación de más de 300 líneas, un controller que atienda más de una operación… |           |
| A-236 | spec:005#FR-041 | DECIDIDO | Cada regla de FR-040 y la regla existente de importación por API pública de módulo MUST tener un fixture que la viola y una prueba que confirma la fa… |           |
| A-237 | spec:005#FR-050 | DECIDIDO | Un único comando MUST ejecutar todas las verificaciones nuevas y fallar ante la primera roja nombrándola; MUST correr en integración continua; la guí… |           |
| A-238 | spec:005#FR-051 | DECIDIDO | Cada regla o verificación de FR-002, FR-010, FR-011, FR-012, FR-020, FR-021, FR-030 y FR-040 MUST tener un caso que la viola y una prueba que confirm… |           |
| A-239 | spec:005#FR-052 | DECIDIDO | El código existente MUST pasar todas las verificaciones al cierre, con cero excepciones sin motivo; la suite existente MUST pasar sin modificar aserc… |           |
| A-240 | spec:005#FR-060 | DECIDIDO | Un procedimiento invocable sobre un módulo, un directorio o el cambio contra la rama principal MUST ejecutar primero los gates deterministas y report… |           |
| A-241 | spec:005#FR-061 | DECIDIDO | Los criterios de diseño (una responsabilidad por módulo, dependencia sólo de abstracciones, sustitución de implementaciones, interfaces pequeñas, con… |           |
| A-242 | spec:005#FR-062 | DECIDIDO | Cada hallazgo MUST traer archivo y línea, regla violada con fuente, evidencia, severidad por criterio fijo (Alta: viola constitución o ADR; Media: vi… |           |
| A-243 | spec:005#FR-063 | DECIDIDO | Cada hallazgo de diseño MUST pasar una segunda revisión que intenta refutarlo; sólo los confirmados MUST aparecer en el reporte.                       |           |
| A-244 | spec:005#FR-064 | DECIDIDO | Antes de emitirse, cada hallazgo MUST verificarse mecánicamente: archivo y línea existen, y la regla citada existe.                                    |           |
| A-245 | spec:005#FR-065 | DECIDIDO | El estado global MUST derivarse de una regla fija (gate rojo o hallazgo Alto ⇒ Rechazado; Medio ⇒ Requiere cambios; si no ⇒ Aprobado); MUST NOT exist… |           |
| A-246 | spec:005#FR-066 | DECIDIDO | Tres escenarios de evaluación con fixtures (controller que instancia infraestructura; dos funciones idénticas en dominio; bloque de captura de error…  |           |
| A-247 | spec:005#FR-070 | DECIDIDO | El compilador que ejecuta `build` y `typecheck` MUST ser la versión mayor vigente de TypeScript; las herramientas que necesitan la API programática M… |           |
| A-248 | spec:005#FR-071 | DECIDIDO | Los diagnósticos nuevos del compilador vigente sobre código existente MUST corregirse en el código; las pruebas que afirman sobre códigos de diagnóst… |           |
| A-249 | spec:005#FR-072 | DECIDIDO | Toda dependencia declarada MUST estar en su última versión publicada al cierre, o llevar una nota con motivo y condición de actualización; la convive… |           |
| A-250 | spec:005#SC-001 | DECIDIDO | El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y una prueba que confirma la falla.                                       |           |
| A-251 | spec:005#SC-002 | DECIDIDO | Al cierre, la verificación de idioma pasa sobre todo el alcance de FR-001 con cero excepciones sin motivo, y una búsqueda manual de texto en español…  |           |
| A-252 | spec:005#SC-003 | DECIDIDO | El comando de calidad completo corre localmente en menos de 3 minutos sobre el estado de esta feature, excluida la verificación de mutación; la verif… |           |
| A-253 | spec:005#SC-004 | DECIDIDO | Toda la suite anterior pasa; las únicas aserciones modificadas son las que afirman sobre textos traducidos, y cada una queda listada en el cierre de…  |           |
| A-254 | spec:005#SC-005 | DECIDIDO | Los tres escenarios de evaluación producen su hallazgo esperado en tres ejecuciones consecutivas del procedimiento de auditoría (repetible, no ocasio… |           |
| A-255 | spec:005#SC-006 | DECIDIDO | El 100 % de los hallazgos de un reporte de auditoría resuelve a archivo, línea y regla existentes (verificado mecánicamente).                          |           |
| A-256 | spec:005#SC-007 | DECIDIDO | El contrato traducido pasa la comparación de compatibilidad contra la versión publicada sin ningún cambio incompatible.                                |           |
| A-257 | spec:005#SC-008 | DECIDIDO | `tsc --version` reporta la versión mayor vigente de TypeScript, y el 100 % de las dependencias declaradas está en su última versión publicada o tiene… |           |

### 006-mapa-del-contrato

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-258 | spec:006#FR-001 | DECIDIDO | MUST existir un mapa del contrato, en un archivo gobernado del directorio del contrato, con una entrada por operación: `operationId`, método y ruta,…  |           |
| A-259 | spec:006#FR-002 | DECIDIDO | El mapa MUST cubrir toda la superficie que los documentos del MVP implican para el backend: SDK (configuración y mapa de anclajes, autodiagnóstico de… |           |
| A-260 | spec:006#FR-003 | DECIDIDO | Un chequeo MUST fallar si el contrato declara una operación ausente del mapa, si el mapa marca como construida una ausente del contrato, si tag, segu… |           |
| A-261 | spec:006#FR-004 | DECIDIDO | El chequeo MUST correr dentro de `contract:check` y en CI, e informar el conteo por estado.                                                            |           |
| A-262 | spec:006#FR-005 | DECIDIDO | La documentación publicada del contrato MUST mostrar las operaciones planeadas como tales, sin confundirlas con las construidas y sin que el servidor… |           |
| A-263 | spec:006#FR-010 | DECIDIDO | El contrato MUST declarar un esquema de seguridad por consumidor: SDK (credencial pública, existente), plataforma del merchant (secreto compartido se… |           |
| A-264 | spec:006#FR-011 | DECIDIDO | Una decisión escrita MUST fijar, por consumidor: dónde viaja la credencial, qué identifica (merchant, persona, operador), qué garantiza, cómo se rota… |           |
| A-265 | spec:006#FR-012 | DECIDIDO | Una regla del ruleset MUST exigir que el esquema de seguridad de una operación sea el que corresponde a su tag (tag ⇒ consumidor ⇒ esquema), y que `s… |           |
| A-266 | spec:006#FR-013 | DECIDIDO | Las capacidades requeridas MUST provenir de un catálogo cerrado por consumidor (archivo gobernado); una capacidad fuera del catálogo o de otro consum… |           |
| A-267 | spec:006#FR-020 | DECIDIDO | Una decisión escrita MUST fijar la convención de idempotencia de las notificaciones servidor a servidor: identidad de la notificación (la autoritativ… |           |
| A-268 | spec:006#FR-021 | DECIDIDO | Una regla del ruleset MUST exigir que toda operación con tag `outcomes` declare su clave de idempotencia y las dos respuestas, mediante una extensión… |           |
| A-269 | spec:006#FR-030 | DECIDIDO | El contrato MUST definir esquemas reutilizables para paginar (parámetros y envoltorio de página) y para la ventana de tiempo, con límite máximo por p… |           |
| A-270 | spec:006#FR-031 | DECIDIDO | Una regla del ruleset MUST exigir que toda operación de lectura que devuelva una colección use esos esquemas.                                          |           |
| A-271 | spec:006#FR-040 | DECIDIDO | Los estados del mapa MUST ser un conjunto cerrado: planeada, construida, depreciada, retirada; la decisión escrita MUST definir qué implica cada tran… |           |
| A-272 | spec:006#FR-041 | DECIDIDO | Una operación depreciada MUST llevar la marca de depreciación en el contrato y el estado en el mapa, verificados juntos; una retirada MUST conservar…  |           |
| A-273 | spec:006#FR-050 | DECIDIDO | Toda regla nueva del ruleset MUST tener su fixture que la viola y su caso de prueba, como el resto de las reglas.                                      |           |
| A-274 | spec:006#FR-051 | DECIDIDO | Todo sustantivo nuevo que el mapa introduzca (los de las operaciones planeadas) MUST tener su nota en el glosario con fuente antes de que su operació… |           |
| A-275 | spec:006#FR-052 | DECIDIDO | La guía de agentes MUST incorporar el mapa al flujo: antes de cambiar el contrato, la operación tiene que existir en el mapa como planeada; construir… |           |
| A-276 | spec:006#FR-053 | DECIDIDO | Esta feature MUST NOT agregar código de servidor ni cambiar el comportamiento de las operaciones construidas; el contrato de las tres existentes MUST… |           |
| A-277 | spec:006#SC-001 | DECIDIDO | El 100 % de las operaciones que los documentos del MVP implican para el backend tiene entrada en el mapa con consumidor, seguridad, feature y fuente;… |           |
| A-278 | spec:006#SC-002 | DECIDIDO | Agregar una operación al contrato sin entrada en el mapa, o cambiarle el tag o el esquema, hace fallar `contract:check` en la primera corrida.         |           |
| A-279 | spec:006#SC-003 | DECIDIDO | Cada convención (autenticación por consumidor, capacidades, idempotencia, paginación, ciclo de vida) tiene una decisión escrita y al menos una regla…  |           |
| A-280 | spec:006#SC-004 | DECIDIDO | Un integrador puede responder, sólo con la documentación publicada, qué operaciones existen hoy, cuáles vendrán y cómo se autentica cada consumidor.   |           |
| A-281 | spec:006#SC-005 | DECIDIDO | `contract:check`, `release-check` y la suite completa pasan; las tres operaciones construidas responden igual que antes (Schemathesis sin cambios).    |           |

### 007-asignacion-experimental

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-282 | spec:007#FR-001 | DECIDIDO | Cada merchant MUST poder tener como máximo un experimento activo, definido por configuración en esta feature (identificador, reparto TREATMENT/CONTRO… |           |
| A-283 | spec:007#FR-002 | DECIDIDO | La asignación de un visitante a un brazo MUST ser una función pura de merchant, experimento, semilla y visitante, sin consultar estado compartido ni…  |           |
| A-284 | spec:007#FR-003 | DECIDIDO | Sobre una muestra grande de visitantes distintos, la proporción asignada a TREATMENT MUST aproximarse al reparto configurado con una tolerancia decla… |           |
| A-285 | spec:007#FR-004 | DECIDIDO | Las asignaciones de dos merchants para el mismo visitante MUST ser independientes; las de dos experimentos del mismo merchant también.                 |           |
| A-286 | spec:007#FR-005 | DECIDIDO | La semilla y el reparto de un experimento MUST NOT poder modificarse: un cambio es un experimento nuevo con otro identificador. La asignación MUST NO… |           |
| A-287 | spec:007#FR-010 | DECIDIDO | La asignación MUST registrarse en el ledger en el momento en que ocurre —el primer lote aceptado del visitante en el experimento—, con merchant, expe… |           |
| A-288 | spec:007#FR-011 | DECIDIDO | Registrar la misma asignación otra vez MUST ser idempotente: una sola asignación por merchant, experimento y visitante; el brazo registrado MUST coin… |           |
| A-289 | spec:007#FR-012 | DECIDIDO | Un lote rechazado (contrato o invariante) MUST NOT producir asignación.                                                                                |           |
| A-290 | spec:007#FR-013 | DECIDIDO | Las asignaciones MUST ser consultables por merchant, experimento y visitante a través de un puerto; una consulta de otro merchant MUST devolver "no e… |           |
| A-291 | spec:007#FR-020 | DECIDIDO | Toda decisión MUST registrar el brazo y el identificador del experimento del visitante, además de lo que ya registra.                                  |           |
| A-292 | spec:007#FR-021 | DECIDIDO | Un visitante de CONTROL MUST atravesar el mismo pipeline que uno de TREATMENT y resolver siempre `NO_OP` con el motivo "brazo de control", del catálo… |           |
| A-293 | spec:007#FR-022 | DECIDIDO | Sin experimento activo, la decisión MUST ser `NO_OP` con el motivo "sin experimento activo", del catálogo, y no se registra asignación.                |           |
| A-294 | spec:007#FR-023 | DECIDIDO | El brazo y el identificador del experimento MUST NOT aparecer como campos en ninguna respuesta HTTP ni aceptarse en ningún request; el motivo de `NO_… |           |
| A-295 | spec:007#FR-024 | DECIDIDO | La resolución de la asignación MUST NOT agregar I/O de red ni escritura bloqueante al camino crítico.                                                  |           |
| A-296 | spec:007#FR-030 | DECIDIDO | Una decisión de arquitectura MUST fijar, antes de la persistencia real, que toda escritura al ledger (asignación, decisión, exposición) es diferida y… |           |
| A-297 | spec:007#FR-031 | DECIDIDO | Ante un ledger no disponible, el orquestador MUST fallar cerrado: `NO_OP` con el motivo "ledger no disponible", sin intervención, sin error 5xx, con…  |           |
| A-298 | spec:007#FR-032 | DECIDIDO | La implementación en memoria MUST cumplir el contrato del puerto (aceptar siempre); el camino de degradación MUST probarse con una implementación fal… |           |
| A-299 | spec:007#FR-033 | DECIDIDO | El motivo "ledger no disponible" y el motivo "brazo de control" y "sin experimento activo" MUST agregarse al catálogo de motivos de `NO_OP` sin cambi… |           |
| A-300 | spec:007#FR-040 | DECIDIDO | MUST existir una prueba de carga con comando propio, fuera de la suite corriente, que levante el servidor real con el perfil en memoria y reporte lot… |           |
| A-301 | spec:007#FR-041 | DECIDIDO | Las cifras obtenidas MUST registrarse en el quickstart de la feature con fecha y máquina, como línea base para la 008.                                 |           |
| A-302 | spec:007#FR-050 | DECIDIDO | Las pruebas MUST demostrar aislamiento entre merchants (mismo visitante, dos merchants; asignaciones no visibles) y entre experimentos del mismo merc… |           |
| A-303 | spec:007#FR-051 | DECIDIDO | Todo sustantivo nuevo MUST tener su nota en el glosario con fuente: experimento, asignación, brazo, control, tratamiento, intención de tratar.         |           |
| A-304 | spec:007#FR-052 | DECIDIDO | Las propiedades de la asignación (determinismo, estabilidad, reparto, independencia) y del registro (idempotencia) MUST verificarse con pruebas nombr… |           |
| A-305 | spec:007#FR-053 | DECIDIDO | La suite anterior MUST seguir pasando sin modificar aserciones.                                                                                        |           |
| A-306 | spec:007#SC-001 | DECIDIDO | Un millón de asignaciones repetidas del mismo visitante dan un millón de veces el mismo brazo; con cien mil visitantes distintos la proporción de TRE… |           |
| A-307 | spec:007#SC-002 | DECIDIDO | Tras cualquier secuencia de lotes de un visitante, el ledger tiene exactamente una asignación para él en el experimento activo, creada con su primer…  |           |
| A-308 | spec:007#SC-003 | DECIDIDO | Ninguna respuesta HTTP de la suite de integración contiene un campo con el brazo ni el identificador del experimento (verificado sobre todas las resp… |           |
| A-309 | spec:007#SC-004 | DECIDIDO | Con el ledger no disponible, el 100 % de los lotes válidos recibe `NO_OP` con motivo "ledger no disponible" y ninguno recibe 5xx; con el ledger dispo… |           |
| A-310 | spec:007#SC-005 | DECIDIDO | La latencia de la ingesta con asignación no supera en más de 10 % la medida en la 004 (p95 en el perfil de memoria), y no difiere entre brazos.        |           |
| A-311 | spec:007#SC-006 | DECIDIDO | La prueba de carga corre con un comando, reporta las cinco cifras y termina con éxito; las cifras están en el quickstart.                              |           |
| A-312 | spec:007#SC-007 | DECIDIDO | `release-check` en verde; la suite de las features 001–006 pasa sin modificar aserciones; el glosario resuelve todo sustantivo nuevo.                  |           |

### 008-casos-de-uso-y-errores

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-313 | spec:008#FR-001 | DECIDIDO | MUST existir un contrato común de caso de uso: una interfaz genérica con un único método de ejecución que recibe un request tipado y devuelve una pro… |           |
| A-314 | spec:008#FR-002 | DECIDIDO | Todo caso de uso MUST ser una clase con sufijo `UseCase`, en la carpeta de casos de uso de su módulo, que implementa el contrato; una por archivo.     |           |
| A-315 | spec:008#FR-003 | DECIDIDO | Lo que un caso de uso necesita para operar MUST llegar por el constructor como un único objeto cuyo tipo es una interfaz de dependencias nombrada, co… |           |
| A-316 | spec:008#FR-004 | DECIDIDO | El número de campos de una interfaz de dependencias MUST tener un límite declarado y verificado (por defecto seis); superarlo falla la verificación.   |           |
| A-317 | spec:008#FR-005 | DECIDIDO | Los controllers HTTP MUST recibir los casos de uso por su contrato y limitarse a traducir DTO ↔ request/response.                                      |           |
| A-318 | spec:008#FR-010 | DECIDIDO | Un caso de uso MUST NOT importar ni invocar a otro caso de uso; la verificación de arquitectura lo hace cumplir.                                       |           |
| A-319 | spec:008#FR-011 | DECIDIDO | La lógica compartida entre casos de uso que necesita puertos MUST ser un servicio de aplicación con interfaz propia, en la carpeta de servicios de su… |           |
| A-320 | spec:008#FR-012 | DECIDIDO | Un servicio de aplicación MUST NOT importar casos de uso.                                                                                              |           |
| A-321 | spec:008#FR-020 | DECIDIDO | MUST existir una raíz común de errores de negocio en el núcleo compartido del dominio: una clase abstracta que extiende `Error` con `code` (slug esta… |           |
| A-322 | spec:008#FR-021 | DECIDIDO | Cada módulo MUST definir sus errores en un archivo de errores de su dominio, como clases que extienden la raíz con `code` y `module` literales; `modu… |           |
| A-323 | spec:008#FR-022 | DECIDIDO | El tipo de resultado MUST cerrarse sobre la raíz (`Result<T, E extends                                                                                 |           |
| A-324 | spec:008#FR-023 | DECIDIDO | Los errores de negocio MUST devolverse, nunca lanzarse; un `throw` de una instancia de la raíz MUST fallar el lint en dominio y aplicación; un `catch… |           |
| A-325 | spec:008#FR-024 | DECIDIDO | Los códigos MUST ser únicos entre módulos y cada uno MUST existir en el catálogo de tipos de problema del contrato con su status, verificado por prue… |           |
| A-326 | spec:008#FR-025 | DECIDIDO | Los errores existentes MUST migrar: invariantes del lote y de la exposición, ledger no disponible (que pasa a ser un error del módulo `ledger` devuel… |           |
| A-327 | spec:008#FR-030 | DECIDIDO | El adaptador HTTP MUST exponer una única función que convierte cualquier error de la raíz en Problem Details (`type` desde `code`, `status` y `title`… |           |
| A-328 | spec:008#FR-031 | DECIDIDO | Las respuestas HTTP de las operaciones construidas MUST NOT cambiar (mismos status, tipos y cuerpos; Schemathesis sin cambios).                        |           |
| A-329 | spec:008#FR-040 | DECIDIDO | MUST existir un decorador de registro operativo que envuelve cualquier caso de uso y registra nombre, duración y resultado (éxito o código) sin reque… |           |
| A-330 | spec:008#FR-050 | DECIDIDO | Toda regla nueva (arquitectura o lint) MUST tener fixture que la viola y prueba.                                                                       |           |
| A-331 | spec:008#FR-051 | DECIDIDO | Una decisión de arquitectura MUST registrar el contrato, la separación caso de uso / servicio, la jerarquía de errores y la traducción; la guía de ag… |           |
| A-332 | spec:008#FR-052 | DECIDIDO | La migración MUST NOT cambiar comportamiento: la suite de 001–007 pasa sin modificar aserciones; los cambios en pruebas se limitan a cómo se construy… |           |
| A-333 | spec:008#SC-001 | DECIDIDO | El 100 % de los casos de uso (los cinco actuales) son clases `*UseCase` con el contrato común, dependencias por interfaz y errores tipados; ninguno i… |           |
| A-334 | spec:008#SC-002 | DECIDIDO | Cada regla nueva tiene al menos un fixture que la viola y falla en la primera corrida (sufijo/contrato, dependencias no interfaz, límite de dependenc… |           |
| A-335 | spec:008#SC-003 | DECIDIDO | Los códigos de error de dominio son únicos y el 100 % existe en el catálogo con su status (prueba de réplica en verde).                                |           |
| A-336 | spec:008#SC-004 | DECIDIDO | Las pruebas de integración y Schemathesis de 004–007 pasan sin cambios en aserciones ni en el contrato.                                                |           |
| A-337 | spec:008#SC-005 | DECIDIDO | Un caso de uso nuevo se escribe siguiendo la guía en un solo archivo de aplicación más su archivo de errores, sin tocar el adaptador HTTP para su tra… |           |
| A-338 | spec:008#SC-006 | DECIDIDO | `quality`, `test:mutation` y `release-check` en verde.                                                                                                 |           |

### 009-dominio-rico

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-339 | spec:009#FR-001 | DECIDIDO | `EventBatch`, `Decision`, `Experiment` y `Merchant` MUST ser clases con constructor privado, fábrica `of(...)` que devuelve `Result<T, E>` con los er… |           |
| A-340 | spec:009#FR-002 | DECIDIDO | `EventBatch.of` MUST hacer cumplir las invariantes publicadas en el contrato: misma sesión y visitante en todos los eventos, e instantes dentro de la… |           |
| A-341 | spec:009#FR-003 | DECIDIDO | `Decision` MUST ser una unión discriminada por `outcome`: `NO_OP` con `reason` del catálogo tipado y sin intervención; `INTERVENE` con intervención o… |           |
| A-342 | spec:009#FR-004 | DECIDIDO | `Experiment` MUST guardar el reparto como tasa 0–1 (`treatmentShare`), MUST rechazar tasas fuera de rango y semillas vacías, y MUST exponer `assign(v… |           |
| A-343 | spec:009#FR-005 | DECIDIDO | `Merchant` MUST exponer `owns(key)` y `allowsOrigin(origin)`; los orígenes MUST ser un value object `Origin` normalizado una única vez al construir;…  |           |
| A-344 | spec:009#FR-006 | DECIDIDO | Los valores sin reglas (`Exposure`, `Assignment`, identificadores marcados, `Arm`, `ServiceHealth`) MUST seguir siendo tipos.                          |           |
| A-345 | spec:009#FR-010 | DECIDIDO | `src/domain/` MUST NOT exportar funciones sueltas; excepciones declaradas en la regla: los constructores de identificadores del núcleo compartido y `… |           |
| A-346 | spec:009#FR-011 | DECIDIDO | Los casos de uso y servicios MUST invocar el comportamiento por su dueño (`experiment.assign`, `merchant.allowsOrigin`, `decision.isIntervention`) y…  |           |
| A-347 | spec:009#FR-020 | DECIDIDO | La configuración y los gateways de configuración MUST construir entidades por su fábrica y traducir un fallo a `ConfigError` fail-closed que nombra e… |           |
| A-348 | spec:009#FR-021 | DECIDIDO | La guarda de instantes no parseables MUST vivir en la traducción DTO → dominio del adaptador HTTP, no en el dominio.                                   |           |
| A-349 | spec:009#FR-030 | DECIDIDO | La ventana de deduplicación MUST declararse en el módulo de ingesta de la aplicación y entregarse al gateway; el gateway MUST NOT definirla.           |           |
| A-350 | spec:009#FR-031 | DECIDIDO | Toda operación de todo puerto MUST devolver `Promise`; ningún puerto MUST admitir respuesta síncrona.                                                  |           |
| A-351 | spec:009#FR-040 | DECIDIDO | El contrato HTTP y el mapa MUST NOT cambiar; las respuestas de las operaciones construidas MUST ser idénticas (Schemathesis y pruebas de integración…  |           |
| A-352 | spec:009#FR-041 | DECIDIDO | La asignación experimental MUST ser bit a bit la misma que en la 007 (prueba de regresión sobre la muestra de 100 000 visitantes con brazos precomput… |           |
| A-353 | spec:009#FR-042 | DECIDIDO | Una decisión de arquitectura MUST registrar el criterio (qué es clase, qué es tipo, fábrica/rehidratación, dueño de las reglas, políticas publicadas,… |           |
| A-354 | spec:009#SC-001 | DECIDIDO | El 100 % de los conceptos con invariantes (`EventBatch`, `Decision`, `Experiment`, `Merchant`) sólo se construyen por fábrica o rehidratación; cero f… |           |
| A-355 | spec:009#SC-002 | DECIDIDO | Cero reglas de negocio en gateways y configuración: los gateways de configuración sólo traducen registros a llamadas de fábrica (revisión + prueba de… |           |
| A-356 | spec:009#SC-003 | DECIDIDO | 100 000 visitantes de la muestra de la 007 reciben el mismo brazo que antes del refactor.                                                              |           |
| A-357 | spec:009#SC-004 | DECIDIDO | Pruebas de integración y Schemathesis de 004–008 pasan sin cambios en aserciones; el contrato no cambia.                                               |           |
| A-358 | spec:009#SC-005 | DECIDIDO | `quality`, `test:mutation` y `release-check` en verde.                                                                                                 |           |
| A-359 | spec:009#SC-006 | DECIDIDO | Una entidad nueva se escribe siguiendo la guía en un archivo de dominio (clase + errores) sin tocar aplicación ni adaptadores para validarla.          |           |

### 010-catalogo-y-stock

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-360 | spec:010#FR-001 | DECIDIDO | El sistema MUST aceptar por merchant un snapshot completo del catálogo con productos (identificador, nombre, atributos nombre/valor) y variantes (ide… |           |
| A-361 | spec:010#FR-002 | DECIDIDO | Un snapshot MUST cumplir por construcción: toda variante referencia un producto del mismo snapshot; identificadores de producto únicos y de variante…  |           |
| A-362 | spec:010#FR-003 | DECIDIDO | El upsert MUST reemplazar el snapshot vigente del merchant por completo y MUST ser idempotente; un snapshot con `capturedAt` anterior al vigente MUST… |           |
| A-363 | spec:010#FR-004 | DECIDIDO | El sistema MUST NOT almacenar ni exponer cantidades de stock: la disponibilidad es un booleano por variante (01 §4.3, DECIDIDO).                       |           |
| A-364 | spec:010#FR-005 | DECIDIDO | MUST existir una consulta de verdad de producto por merchant, producto y variante que devuelva la variante (talle, color, disponibilidad, precio, atr… |           |
| A-365 | spec:010#FR-006 | DECIDIDO | Los presupuestos de frescura MUST ser políticas de aplicación publicadas y distintas por clase: catálogo y variantes en el orden de un día; stock y p… |           |
| A-366 | spec:010#FR-007 | DECIDIDO | La consulta de verdad MUST leer de la caché caliente y MUST NOT tocar ninguna plataforma externa (constitución: sin I/O de red en el camino crítico).  |           |
| A-367 | spec:010#FR-010 | DECIDIDO | El sistema MUST derivar por merchant el nivel de sincronización observado (0–3) a partir de la cadencia de los snapshots recibidos y de la edad del v… |           |
| A-368 | spec:010#FR-011 | DECIDIDO | El nivel observado MUST informarse en la respuesta del upsert y MUST poder consultarse por merchant desde la aplicación (la salud del merchant lo exp… |           |
| A-369 | spec:010#FR-020 | DECIDIDO | `upsertCatalogSnapshot` (`PUT /v1/catalog`) MUST pasar de `planned` a `built` en el mapa, bajo el consumidor `platform`, tag `outcomes`, capacidad `c… |           |
| A-370 | spec:010#FR-021 | DECIDIDO | `platformKey` MUST decidirse y construirse: clave por merchant (una o dos, rotación) configurada en `OPE_MERCHANTS` junto a las de ingesta, en un hea… |           |
| A-371 | spec:010#FR-022 | DECIDIDO | El servidor MUST verificar `x-required-capabilities` de toda operación autenticada contra las capacidades del consumidor de la credencial, antes de v… |           |
| A-372 | spec:010#FR-023 | DECIDIDO | Con el segundo esquema de seguridad, cada esquema MUST declarar su header en el cableado, y los headers admitidos por CORS y las rutas redactadas del… |           |
| A-373 | spec:010#FR-024 | DECIDIDO | La respuesta del upsert MUST devolver el resumen: productos, variantes, instante de recepción y nivel observado; MUST NOT devolver el snapshot.        |           |
| A-374 | spec:010#FR-030 | DECIDIDO | El snapshot de un merchant MUST NOT ser visible ni reemplazable desde otro; el mismo `productId` en dos merchants MUST ser dos productos distintos; p… |           |
| A-375 | spec:010#FR-031 | DECIDIDO | Las claves de plataforma MUST NOT aparecer en logs ni en respuestas.                                                                                   |           |
| A-376 | spec:010#FR-040 | DECIDIDO | Glosario: `catalogo` (snapshot), `disponibilidad`, `precio`, `frescura`, `perfil-de-datos`; notas de `producto` y `variante` actualizadas con su uso…  |           |
| A-377 | spec:010#FR-041 | DECIDIDO | Una decisión de arquitectura MUST registrar: `platformKey` y la verificación de capacidades; el snapshot completo con reemplazo idempotente y rechazo… |           |
| A-378 | spec:010#FR-042 | DECIDIDO | El módulo `catalog` MUST seguir ADR-023/024: aggregate `CatalogSnapshot` con fábrica y rehidratación, errores en su `errors.ts`, caso de uso `UpsertC… |           |
| A-379 | spec:010#SC-001 | DECIDIDO | Un snapshot válido se refleja en la verdad consultable en la misma operación (lectura inmediatamente posterior consistente) en el 100 % de los casos…  |           |
| A-380 | spec:010#SC-002 | DECIDIDO | El 100 % de las invariantes del snapshot tiene tipo de problema, `x-invariants` y prueba `[invariant:<slug>]`; ninguna regla vive sólo en código.      |           |
| A-381 | spec:010#SC-003 | DECIDIDO | Con el reloj controlado, la frescura y el nivel observado responden exactamente según los umbrales publicados en todos los escenarios de las historia… |           |
| A-382 | spec:010#SC-004 | DECIDIDO | Un snapshot de 5 000 productos y 50 000 variantes se acepta en una sola operación en menos de 2 segundos en el perfil local (cifra informativa, no SL… |           |
| A-383 | spec:010#SC-005 | DECIDIDO | La suite de aislamiento cubre catálogo y credenciales de plataforma; la de latencia de ingesta no cambia (el catálogo no toca la ingesta).             |           |
| A-384 | spec:010#SC-006 | DECIDIDO | `contract:check` en verde con el mapa en 4 built; `quality`, `test:mutation`, `test:contract` y `release-check` en verde; `check:markers` sin el PROP… |           |

### 011-plano-de-decision-i

| id    | origen          | estado   | afirmación                                                                                                                                               | evidencia |
| ----- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A-385 | spec:011#FR-001 | DECIDIDO | Por cada lote aceptado de un visitante asignado, el sistema MUST ejecutar en este orden: inferencia de barrera con la política del merchant → verific…   |           |
| A-386 | spec:011#FR-002 | DECIDIDO | La inferencia MUST ejecutarse y registrarse para ambos brazos; sólo TREATMENT puede recibir `INTERVENE`; CONTROL registra `NO_OP control-arm` con la…    |           |
| A-387 | spec:011#FR-003 | DECIDIDO | El motivo de `NO_OP` MUST ser uno del catálogo, con estos nuevos: `barrier-unclear`, `evidence-missing`, `evidence-stale`, `variant-unavailable`, `hi…   |           |
| A-388 | spec:011#FR-010 | DECIDIDO | Las barreras MUST ser exactamente tres: `fit` (talle y calce), `price` (precio y valor), `returns` (cambios y devoluciones).                             |           |
| A-389 | spec:011#FR-011 | DECIDIDO | El vocabulario de hechos MUST ser cerrado y derivarse sólo de lo que OPE captura: conteo de eventos por tipo (y por subtipo: bloque, interacción de f…   |           |
| A-390 | spec:011#FR-012 | DECIDIDO | La inferencia MUST producir, para cada barrera, una confianza 0–1 a partir de los pesos de las reglas que se cumplen (acotada a 1), elegir la dominan…   |           |
| A-391 | spec:011#FR-013 | DECIDIDO | La inferencia MUST ser una regla pura del dominio (sin puertos, sin reloj, sin aleatoriedad): mismo contexto y misma política ⇒ mismo resultado, en c…   |           |
| A-392 | spec:011#FR-020 | DECIDIDO | `DecisionPolicy` MUST contener: `version` (texto no vacío), reglas (`when`: condición; `then`: barrera y peso 0–1; `strength`: fuerte/apoyo), umbral…    |           |
| A-393 | spec:011#FR-021 | DECIDIDO | Las condiciones MUST ser un álgebra cerrada: `all(...)`, `any(...)`, `not(...)` sobre predicados del vocabulario (`eventCount(type[, subtype]) ≥ n`,…    |           |
| A-394 | spec:011#FR-022 | DECIDIDO | La política MUST construirse por fábrica con las invariantes: hechos, subtipos, bloques y barreras existentes; pesos y umbral en 0–1; prioridad compl…   |           |
| A-395 | spec:011#FR-023 | DECIDIDO | Un merchant sin política MUST usar la política por defecto, cuya versión es `default-1`; la política por defecto MUST codificar los valores propuesto…   |           |
| A-396 | spec:011#FR-024 | DECIDIDO | Cambiar la política de un merchant MUST cambiar `version`; cada decisión MUST registrar `policyVersion`, barrera candidata, confianza y señales cumpl…   |           |
| A-397 | spec:011#FR-025 | DECIDIDO | La política de un merchant MUST NOT afectar las decisiones de otro (aislamiento probado).                                                                |           |
| A-398 | spec:011#FR-030 | DECIDIDO | Antes de `INTERVENE`, el sistema MUST consultar la verdad de producto del producto y la variante del contexto de página del lote: ausente ⇒ `evidence…   |           |
| A-399 | spec:011#FR-031 | DECIDIDO | La evidencia consultada (frescura por clase, disponibilidad) MUST registrarse en la decisión.                                                            |           |
| A-400 | spec:011#FR-040 | DECIDIDO | `INTERVENE` MUST llevar anclaje por barrera (`fit → size_selector`, `price →                                                                             |           |
| A-401 | spec:011#FR-041 | DECIDIDO | `confirmExposure` de una decisión del plano MUST responder `201` (cadena `DECIDED → EXPOSED`).                                                           |           |
| A-402 | spec:011#FR-050 | DECIDIDO | El sistema MUST mantener por merchant y sesión: agregó al carrito, entró al checkout, intervenciones decididas y las señales acumuladas necesarias pa…   |           |
| A-403 | spec:011#FR-060 | DECIDIDO | El módulo `decision` MUST absorber el motivo provisional de `EventBatch` (`noOpReason()` desaparece) y el vocabulario de intervención (`Anchor`, `Int…   |           |
| A-404 | spec:011#FR-061 | DECIDIDO | Sin operaciones ni schemas nuevos; `contracts/no-op-reasons.yaml` gana los motivos de FR-003 con su emisor y descripción; la réplica del dominio se a…   |           |
| A-405 | spec:011#FR-062 | DECIDIDO | Glosario: `barrera`, `señal`, `evidencia`, `confianza`, `política de decisión`, `intención`; ADR-026 con la decisión sobre el motor de reglas y su cr…   |           |
| A-406 | spec:011#SC-001 | DECIDIDO | Con la política por defecto, los escenarios de las historias 1 y 2 producen exactamente la decisión y el motivo esperados (tabla de casos, 100 %).       |           |
| A-407 | spec:011#SC-002 | DECIDIDO | La inferencia es determinista: 1 000 evaluaciones del mismo contexto dan el mismo veredicto; y pura: no consulta reloj ni puertos (verificado por arq…   |           |
| A-408 | spec:011#SC-003 | DECIDIDO | Toda política inválida de un conjunto de al menos 8 casos (hecho, bloque, barrera, subtipo inexistentes; peso/umbral fuera de rango; prioridad incomp…   |           |
| A-409 | spec:011#SC-004 | DECIDIDO | El flujo completo ingesta → `INTERVENE` → `confirmExposure 201` pasa en integración, y la latencia p95 de ingesta se mantiene ≤ 50 ms con la inferenc…   |           |
| A-410 | spec:011#SC-005 | DECIDIDO | Aislamiento: políticas y estado de sesión de A no afectan a B (suite de aislamiento ampliada).                                                           |           |
| A-411 | spec:011#SC-006 | DECIDIDO | `contract:check`, `quality`, `test:mutation`, `test:contract`, `release-check` en verde; `check:markers` sin los dos `PROPUESTO` de ADR-024 (y con el d… |           |

### 012-plano-de-decision-ii

| id    | origen          | estado   | afirmación                                                                                                                                             | evidencia |
| ----- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| A-412 | spec:012#FR-001 | DECIDIDO | El camino crítico MUST ejecutar, en este orden y sólo con barrera inferida: selección de candidatos → quality gate → política comercial → registro; n… |           |
| A-413 | spec:012#FR-002 | DECIDIDO | Selección + gate y política comercial MUST vivir en módulos propios; el orquestador sólo transporta el contexto.                                       |           |
| A-414 | spec:012#FR-003 | DECIDIDO | Ambos brazos MUST atravesar selección, gate y política; CONTROL registra el resultado y responde `control-arm`.                                        |           |
| A-415 | spec:012#FR-010 | DECIDIDO | Los candidatos MUST ser un vocabulario cerrado de OPE por barrera, cada uno con `candidateId` (`msg_<barrera>_<anclaje>_<escalón>_v0` hasta la 015),…  |           |
| A-416 | spec:012#FR-011 | DECIDIDO | Todo candidato MUST hacer claims de una sola barrera y MUST NOT exponer estados ni scores internos (por construcción: los claims no incluyen confianz… |           |
| A-417 | spec:012#FR-020 | DECIDIDO | El gate MUST ser una función pura: candidato + evidencia + perfil del merchant ⇒ `acceptable` \| `unacceptable { reason }`, sin reloj ni puertos.      |           |
| A-418 | spec:012#FR-021 | DECIDIDO | Motivos de rechazo cerrados: `stale-price` (precio vigente sin stock/precio fresco), `no-fit-data`, `no-returns-policy`, `attribute-unknown`, `attrib… |           |
| A-419 | spec:012#FR-022 | DECIDIDO | El perfil del merchant MUST declarar `returnsPolicy: boolean`, `fitData: boolean`, `authorizedAttributes: string[]`; ausente ⇒ todo falso (fail-close… |           |
| A-420 | spec:012#FR-023 | DECIDIDO | Sin ningún candidato aceptable ⇒ `NO_OP no-acceptable-candidate`; el gate MUST NOT relajarse por configuración.                                        |           |
| A-421 | spec:012#FR-030 | DECIDIDO | `CommercialPolicy` por merchant, versionada (`version`), con: `maxIncentivePercent` (0–100), `incentiveLadderPercent` (lista creciente, todos ≤ techo… |           |
| A-422 | spec:012#FR-031 | DECIDIDO | Selección: el primer candidato aceptable del escalón más bajo; con barrera `price` y `directIncentiveOnPrice`, el de incentivo; con abandono confirma… |           |
| A-423 | spec:012#FR-032 | DECIDIDO | Bloqueos, en orden: alta intención (`high-intent`), cooldown o presupuesto por sesión (`session-budget-exhausted`), fatiga por visitante (`visitor-fa… |           |
| A-424 | spec:012#FR-033 | DECIDIDO | El valor del incentivo MUST ser el primer escalón ≤ techo, y la respuesta MUST llevar `intervention.incentive { kind: "percent", value }`; ningún otr… |           |
| A-425 | spec:012#FR-034 | DECIDIDO | La política de decisión de la 011 MUST perder `highIntent`, `abandonment` e `interventionsPerSession` (pasan a la comercial) y el comportamiento por…  |           |
| A-426 | spec:012#FR-035 | DECIDIDO | Política comercial por defecto (`commercial-default-1`): techo 10, escalones [5, 10], sin margen (⇒ sin incentivos hasta configurarlo), `directIncent… |           |
| A-427 | spec:012#FR-040 | DECIDIDO | El sistema MUST contar intervenciones por merchant y visitante en una ventana de un día, detrás de un puerto en memoria, sin cruzar merchants; sólo c… |           |
| A-428 | spec:012#FR-041 | DECIDIDO | El estado de sesión MUST recordar el instante de la última intervención para el cooldown.                                                              |           |
| A-429 | spec:012#FR-050 | DECIDIDO | Sin operaciones nuevas; `Intervention.incentive?` como adición compatible; motivos NO_OP nuevos: `no-acceptable-candidate`, `commercial-policy-blocke… |           |
| A-430 | spec:012#FR-051 | DECIDIDO | La decisión MUST registrar `candidates[] { candidateId, step, verdict, reason? }`, `chosen?`, `commercialVerdict { blocked, reason? }`, `commercialPo… |           |
| A-431 | spec:012#FR-052 | DECIDIDO | Glosario: candidato, claim, quality gate, escalera del incentivo, política comercial, techo, margen, riesgo de devolución, cooldown, fatiga. ADR-027.  |           |
| A-432 | spec:012#FR-053 | DECIDIDO | Aislamiento probado: política comercial y estado por visitante de A no afectan a B.                                                                    |           |
| A-433 | spec:012#SC-001 | DECIDIDO | Los escenarios de las historias 1–3 dan el veredicto y motivo exactos (tabla, 100 %).                                                                  |           |
| A-434 | spec:012#SC-002 | DECIDIDO | El gate es puro y determinista: 1 000 evaluaciones del mismo candidato y evidencia dan el mismo veredicto; ninguna combinación de perfil relaja un re… |           |
| A-435 | spec:012#SC-003 | DECIDIDO | Toda política comercial inválida de ≥ 8 casos (techo fuera de rango, escalón > techo, escalones no crecientes, margen fuera de rango, cooldown negati… |           |
| A-436 | spec:012#SC-004 | DECIDIDO | La suite de integración de la 011 pasa sin cambios de expectativa (mismo comportamiento por defecto), salvo las claves nuevas del ledger.              |           |
| A-437 | spec:012#SC-005 | DECIDIDO | p95 de ingesta ≤ 50 ms con las cinco autoridades activas.                                                                                              |           |
| A-438 | spec:012#SC-006 | DECIDIDO | Aislamiento y gates (`quality`, `contract:check`, `test:mutation`, `test:contract`, `release-check`) en verde.                                         |           |

### 013-outcomes-ordenes-y-devoluciones

| id    | origen          | estado   | afirmación                                                                                                                                               | evidencia |
| ----- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A-439 | spec:013#FR-001 | DECIDIDO | El ledger MUST distinguir, por orden y por merchant, los estados `VERIFIED_ORDER` (compra confirmada por la plataforma), `ATTRIBUTED_ORDER` (verifica…   |           |
| A-440 | spec:013#FR-002 | DECIDIDO | La correlación MUST establecerse únicamente por el mecanismo A: `sessionId` en la notificación de la plataforma que existe en el ledger del mismo mer…   |           |
| A-441 | spec:013#FR-003 | DECIDIDO | Una orden atribuida MUST guardar la asignación de la sesión (experimento y brazo) cuando existe; sin asignación queda atribuida a la sesión sin grupo…   |           |
| A-442 | spec:013#FR-004 | DECIDIDO | El estado de una orden MUST ser inmutable salvo por la devolución: una orden no pasa de pendiente a atribuida después de registrada.                     |           |
| A-443 | spec:013#FR-005 | DECIDIDO | El resultado causal MUST NOT ser un estado del ledger ni una respuesta de esta feature.                                                                  |           |
| A-444 | spec:013#FR-010 | DECIDIDO | La plataforma MUST poder notificar una orden confirmada servidor a servidor con la credencial de plataforma y la capacidad `orders:write`.               |           |
| A-445 | spec:013#FR-011 | DECIDIDO | La notificación MUST llevar exactamente: `orderId`, monto y moneda, ítems (SKU y cantidad ≥ 1, al menos uno), instante de confirmación, y opcionalmen…   |           |
| A-446 | spec:013#FR-012 | DECIDIDO | Ningún esquema de esta feature MUST admitir datos del comprador (nombre, email, teléfono, dirección, documento, pago) ni ningún campo de la lista de…    |           |
| A-447 | spec:013#FR-013 | DECIDIDO | La respuesta MUST decir el estado (`ATTRIBUTED_ORDER` o `PENDING_CORRELATION`) y el identificador de la orden; MUST NOT llevar brazo, experimento, vi…   |           |
| A-448 | spec:013#FR-014 | DECIDIDO | `orderId` MUST ser único por merchant, no global; dos merchants pueden usar el mismo `orderId`.                                                          |           |
| A-449 | spec:013#FR-020 | DECIDIDO | Órdenes y devoluciones MUST ser idempotentes por `orderId`: primera recepción `201`, repetición con el mismo contenido canónico `200` con el mismo re…   |           |
| A-450 | spec:013#FR-021 | DECIDIDO | La igualdad de contenido MUST ser canónica: independiente del orden de claves y del formato del documento; sensible a cualquier valor.                   |           |
| A-451 | spec:013#FR-022 | DECIDIDO | El chequeo de existencia y el registro MUST ocurrir sin operación asíncrona intermedia (01 §6): dos notificaciones simultáneas de la misma orden prod…   |           |
| A-452 | spec:013#FR-030 | DECIDIDO | El SDK MUST poder corroborar una compra con la credencial de ingesta y la capacidad `orders:corroborate`, con `orderId`, `sessionId`, `visitorId` e i…   |           |
| A-453 | spec:013#FR-031 | DECIDIDO | Una corroboración MUST registrarse como evidencia bajo el merchant de la credencial; MUST NOT crear una orden ni cambiar el estado de ninguna.           |           |
| A-454 | spec:013#FR-032 | DECIDIDO | Cuando existen la orden y la corroboración del mismo `orderId` y merchant, en cualquier orden de llegada, el ledger MUST vincularlas.                    |           |
| A-455 | spec:013#FR-033 | DECIDIDO | La corroboración MUST responder `202` tanto la primera vez como repetida (un solo registro por `orderId` y sesión); `503` con `Retry-After` si el led…   |           |
| A-456 | spec:013#FR-035 | DECIDIDO | La plataforma MUST poder notificar la devolución de una orden con la credencial de plataforma y la capacidad `returns:write`, con `orderId`, instante…   |           |
| A-457 | spec:013#FR-036 | DECIDIDO | La devolución de un `orderId` desconocido para ese merchant MUST rechazarse con `422 order-unknown` (invariante propia, sin registrar); un SKU devuel…   |           |
| A-458 | spec:013#FR-037 | DECIDIDO | La orden devuelta MUST pasar a `RETURNED` conservando su correlación y asignación; la respuesta MUST decir `RETURNED` y si la orden estaba atribuida…    |           |
| A-459 | spec:013#FR-038 | DECIDIDO | Una notificación de devolución por orden en el MVP (idempotente por `orderId`, FR-020); devoluciones parciales sucesivas quedan fuera y la segunda di…   |           |
| A-460 | spec:013#FR-040 | DECIDIDO | La notificación de orden MAY declarar el incentivo aplicado con la misma forma que el contrato usa para concederlo (`incentive { kind, value }`).        |           |
| A-461 | spec:013#FR-041 | DECIDIDO | OPE MUST cruzar el incentivo declarado con la decisión de la sesión atribuida que lo concedió y registrar el resultado: coincide, no coincide (valore…   |           |
| A-462 | spec:013#FR-042 | DECIDIDO | El `PROPUESTO` de la redención en el contrato MUST cerrarse: la mecánica del cupón en la plataforma se marca como de la 014 en la descripción del campo. |           |
| A-463 | spec:013#FR-050 | DECIDIDO | Cada merchant MAY configurar uno o dos secretos de firma junto a sus claves de plataforma (rotación). Con secreto configurado, toda operación de plat…   |           |
| A-464 | spec:013#FR-051 | DECIDIDO | OPE MUST verificar firma e instante **antes** de validar el cuerpo y antes de cualquier caso de uso; fallo ⇒ `401` con un motivo propio que distinga…    |           |
| A-465 | spec:013#FR-052 | DECIDIDO | Un merchant sin secreto MUST seguir autenticando sólo con la clave de plataforma (compatibilidad con la 010); la firma nunca reemplaza a la clave, la…   |           |
| A-466 | spec:013#FR-053 | DECIDIDO | El secreto MUST NOT aparecer en logs, respuestas ni errores; la firma y el instante se redactan como todo header.                                        |           |
| A-467 | spec:013#FR-060 | DECIDIDO | Órdenes, correlaciones, corroboraciones, devoluciones y redenciones MUST ser registros del ledger con `merchantId` en toda frontera, detrás de puerto…   |           |
| A-468 | spec:013#FR-061 | DECIDIDO | Todo registro MUST devolver disponibilidad o indisponibilidad, nunca lanzar; una notificación de plataforma o una corroboración con el ledger caído M…   |           |
| A-469 | spec:013#FR-070 | DECIDIDO | `notifyOrder`, `corroborateOrder` y `notifyReturn` MUST pasar de `planned` a `built` en el mapa del contrato, con sus capacidades, tags y consumidore…   |           |
| A-470 | spec:013#FR-071 | DECIDIDO | Las reglas que el esquema no expresa (orden desconocida, ítems fuera de la orden, conflicto de idempotencia, firma) MUST ser `x-invariants` con tipo…    |           |
| A-471 | spec:013#FR-072 | DECIDIDO | Glosario: orden verificada, orden atribuida, correlación pendiente, corroboración, devolución, mecanismo de correlación, firma de plataforma. ADR-028…   |           |
| A-472 | spec:013#FR-073 | DECIDIDO | Aislamiento probado: una orden con `sessionId` de otro merchant no se atribuye; corroboraciones y devoluciones no cruzan merchants; el mismo `orderId…   |           |
| A-473 | spec:013#SC-001 | DECIDIDO | Los escenarios de las historias 1–5 dan el estado, el código y el registro exactos (tabla, 100 %).                                                       |           |
| A-474 | spec:013#SC-002 | DECIDIDO | 100 notificaciones repetidas de la misma orden (secuenciales y simultáneas) producen exactamente un registro y ninguna respuesta distinta de `201` la…   |           |
| A-475 | spec:013#SC-003 | DECIDIDO | Toda notificación con un campo fuera del contrato o con cualquiera de los datos personales prohibidos se rechaza sin registrar nada (verificado por e…   |           |
| A-476 | spec:013#SC-004 | DECIDIDO | Ninguna respuesta ni log de esta feature contiene brazo, experimento, visitante, secreto ni firma.                                                       |           |
| A-477 | spec:013#SC-005 | DECIDIDO | Con secreto configurado, ninguna notificación sin firma válida y en ventana se registra; sin secreto, el catálogo de la 010 y la suite existente pasa…   |           |
| A-478 | spec:013#SC-006 | DECIDIDO | Una notificación de orden se responde en menos de 50 ms (p95) con el ledger en memoria; no toca el camino crítico de decisión.                           |           |
| A-479 | spec:013#SC-007 | DECIDIDO | Aislamiento entre merchants y gates (`quality`, `contract:check`, `test:mutation`, `test:contract`, `release-check`) en verde.                           |           |

## Enunciados `PROPUESTO` / `ABIERTO` (no generan high)

| origen      | estado          | enunciado                                                                                                | dónde se trata                           |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| mvp:01#0.1  | `ABIERTO`       | El nombre 'SDK'                                                                                          | fuera del backend                        |
| mvp:01#4.6  | `PROPUESTO`     | < 150 ms como objetivo de diseño, no SLA                                                                 | fase 2/3 (latencia informativa)          |
| mvp:01#6    | `ABIERTO`       | Identidad cross-device                                                                                   | riesgo, fuera del MVP                    |
| mvp:01#7    | `PROPUESTO`     | Decision como entidad central del ledger con barrera, evidencia, candidatos, veredicto, brazo, resultado | fase 4 junto a constitución IX           |
| mvp:01#10.6 | `PROPUESTO`     | Plazos de retención junto con D5                                                                         | ADR-010; riesgo 017                      |
| mvp:01#13   | `ABIERTO`       | D3–D6                                                                                                    | ADR-010                                  |
| mvp:02#4    | `PROPUESTO`     | Ingesta periódica + refresco de alta frecuencia                                                          | ADR-025 eligió snapshot completo; fase 4 |
| mvp:03#4.3  | pendiente (D-A) | Activación del carrito                                                                                   | fuera del backend hasta V2               |
| ADR-014     | `PROPUESTO`     | Protocolo de decisión inline hasta validación con el SDK                                                 | check:markers                            |
| ADR-020     | `PROPUESTO`     | portalSession / adminToken                                                                               | 014/016                                  |
