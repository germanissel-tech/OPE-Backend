# Feature Specification: Cadena de herramientas del contrato API

**Feature Branch**: `001-api-contract-toolchain`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Cadena de herramientas del contrato API (API-first). El repositorio debe tener un contrato OpenAPI 3.1 multi-archivo en contracts/ como única fuente de verdad de toda superficie HTTP, con verificación automática que falle ante: violaciones de estilo, ausencia de operationId/descripciones/ejemplos, esquemas de request abiertos, campos con nombre de dato personal, merchantId como parámetro o campo de request, respuestas de error que no sean Problem Details (RFC 9457), y cambios incompatibles sin nueva versión mayor. Desde el contrato se generan tipos para el backend y clientes, se sirve un mock para desarrollar SDK y portal en paralelo, se genera documentación navegable, y el servidor valida en runtime request y response contra el contrato, ruteando por operationId. Pruebas de contrato automáticas verifican que el servidor cumple el spec. Incluye una única operación GET /v1/health que recorre todo el pipeline. Sin operaciones de dominio."

## Contexto

Todo el backend de OPE se construye con agentes de IA bajo la constitución del repositorio. La
constitución exige API-first: el contrato precede al código, y las reglas de aislamiento por
merchant, ausencia de datos personales y fail-closed tienen que ser **verificables por
herramienta**, no por lectura. Esta feature construye esa verificación y la deja demostrada con
una única operación trivial. No incluye ninguna operación de dominio (ingesta, decisión,
outcomes, portal): esas son features posteriores que dependen de esta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El contrato frena al agente que lo viola (Priority: P1)

Un agente (o desarrollador) agrega o modifica una operación en el contrato. Antes de escribir
código, corre la verificación del contrato. Si la operación viola una regla de la constitución
o de estilo, la verificación falla con un mensaje que nombra la regla, el archivo y la línea, y
el agente corrige el contrato antes de continuar.

**Why this priority**: Es la razón de existir de la feature. Sin esto, las reglas de la
constitución son prosa, y un agente que no las lee las viola sin enterarse.

**Independent Test**: Se agrega deliberadamente al contrato una operación que viola cada
regla (una por vez) y se verifica que la verificación falla identificando esa regla; se
restaura el contrato y se verifica que pasa.

**Acceptance Scenarios**:

1. **Given** un contrato válido, **When** se corre la verificación, **Then** termina con éxito
   y sin advertencias.
2. **Given** una operación sin `operationId`, o con `operationId` duplicado, **When** se corre
   la verificación, **Then** falla nombrando la operación.
3. **Given** una operación sin `description`, o un esquema con propiedades sin `description`,
   **When** se corre la verificación, **Then** falla nombrando el elemento.
4. **Given** una operación con request body o respuesta 2xx sin ejemplo, **When** se corre la
   verificación, **Then** falla.
5. **Given** un esquema de request body que no declara `additionalProperties: false`, **When**
   se corre la verificación, **Then** falla nombrando el esquema.
6. **Given** un esquema con una propiedad cuyo nombre está en la lista de datos personales
   prohibidos (al menos: `email`, `name`, `firstName`, `lastName`, `phone`, `address`,
   `document`, `dni`, `ip`, `ipAddress`, `card`, `cardNumber`, `password` fuera de
   autenticación), **When** se corre la verificación, **Then** falla nombrando la propiedad,
   aunque sea opcional.
7. **Given** una operación con `merchantId` como parámetro de path, query o header, o como
   propiedad de un request body, **When** se corre la verificación, **Then** falla nombrando la
   regla de aislamiento por merchant.
8. **Given** una respuesta de error (4xx o 5xx) cuyo contenido no es `application/problem+json`
   con el esquema Problem Details, **When** se corre la verificación, **Then** falla.
9. **Given** una operación que no declara al menos las respuestas `401` y `500`, o una
   operación con request body que no declara `400` y `422`, **When** se corre la verificación,
   **Then** falla.
10. **Given** una operación con una etiqueta (`tag`) fuera del catálogo cerrado del contrato,
    **When** se corre la verificación, **Then** falla.
11. **Given** un cambio en el contrato que rompe compatibilidad (eliminar una operación,
    quitar un campo de respuesta, volver obligatorio un campo de request, cambiar un tipo)
    respecto de la versión en la rama principal, **When** se corre la verificación **sin** que
    la versión mayor del contrato haya aumentado, **Then** falla listando cada cambio
    incompatible.
12. **Given** el mismo cambio incompatible **con** la versión mayor aumentada, **When** se
    corre la verificación, **Then** pasa y reporta el cambio como esperado.

---

### User Story 2 - El backend sólo puede exponer lo que el contrato declara (Priority: P1)

Un agente implementa el manejador de una operación. El servidor resuelve qué manejador atiende
cada request a partir del `operationId` del contrato, valida el request contra el contrato
antes de invocar el manejador y valida la respuesta antes de enviarla. No existe forma de
exponer una ruta que no esté en el contrato, ni de responder algo que el contrato no describa.

**Why this priority**: Es lo que hace que exista una sola verdad. Sin validación en runtime
desde el contrato, el código y el contrato divergen en silencio.

**Independent Test**: Se levanta el servidor con el contrato y un manejador para
`getHealth`; se verifica que responde según el contrato; se envía un request inválido y se
verifica el rechazo como Problem Details; se hace que el manejador devuelva algo fuera del
contrato y se verifica que el servidor lo rechaza en vez de enviarlo.

**Acceptance Scenarios**:

1. **Given** el servidor levantado, **When** se pide `GET /v1/health`, **Then** responde `200`
   con un cuerpo que valida contra el esquema declarado en el contrato.
2. **Given** el servidor levantado, **When** se pide una ruta que no existe en el contrato,
   **Then** responde `404` con `application/problem+json`.
3. **Given** una operación del contrato sin manejador implementado, **When** se la invoca,
   **Then** el servidor responde `501` con Problem Details, nunca con un `200` vacío.
4. **Given** un request con un parámetro o cuerpo que no cumple el contrato, **When** se lo
   envía, **Then** el servidor responde `400` (forma) o `422` (semántica) con Problem Details
   que enumera cada violación, sin invocar el manejador.
5. **Given** un manejador que devuelve un cuerpo que no cumple el esquema de respuesta,
   **When** se invoca la operación, **Then** el servidor responde `500` con Problem Details y
   registra el error; el cuerpo inválido no llega al cliente.
6. **Given** un request con un campo no declarado en el esquema, **When** se lo envía,
   **Then** el servidor lo rechaza con `400`; no lo ignora ni lo descarta silenciosamente.
7. **Given** los tipos generados desde el contrato, **When** un manejador intenta devolver un
   valor de tipo distinto al declarado, **Then** la compilación falla.

---

### User Story 3 - SDK y portal se desarrollan contra el contrato, sin backend (Priority: P2)

Un agente que trabaja en el SDK o en el portal necesita un servidor que responda según el
contrato antes de que el backend real exista, y un cliente tipado generado desde el mismo
contrato. Ambos se obtienen con un comando, sin escribir nada a mano.

**Why this priority**: Permite paralelizar el trabajo de agentes sobre el mismo contrato. No es
bloqueante para el backend, por eso P2.

**Independent Test**: Se levanta el mock desde el contrato y se verifica que `GET /v1/health`
responde con el ejemplo declarado; se genera el cliente y se verifica que compila y que un uso
con tipo incorrecto no compila.

**Acceptance Scenarios**:

1. **Given** el contrato, **When** se levanta el servidor mock, **Then** `GET /v1/health`
   responde `200` con el ejemplo declarado en el contrato.
2. **Given** el mock levantado, **When** se envía un request que viola el contrato, **Then**
   el mock lo rechaza con el mismo código de error que el servidor real.
3. **Given** el contrato, **When** se generan los tipos, **Then** el archivo generado se
   produce de forma determinista (dos generaciones consecutivas son idénticas) y se commitea.
4. **Given** tipos generados desactualizados respecto del contrato, **When** se corre la
   verificación, **Then** falla indicando que hay que regenerar.
5. **Given** el archivo de tipos generados, **When** alguien lo edita a mano, **Then** la
   verificación falla (el archivo lleva encabezado de generado y se compara contra la
   regeneración).

---

### User Story 4 - Cualquiera puede leer el contrato como documentación (Priority: P2)

El equipo técnico de un merchant, o un integrador, recibe una página navegable generada desde
el contrato, con cada operación, sus esquemas, ejemplos y errores posibles. Nadie escribe ni
mantiene esa documentación a mano.

**Why this priority**: El contrato de webhooks es lo primero técnico que ve un merchant. Debe
ser impecable y no costar mantenimiento.

**Independent Test**: Se genera la documentación y se verifica que contiene la operación
`getHealth` con su descripción, ejemplo de respuesta y respuestas de error.

**Acceptance Scenarios**:

1. **Given** el contrato, **When** se genera la documentación, **Then** se produce un artefacto
   estático autocontenido que muestra todas las operaciones, esquemas, ejemplos y errores.
2. **Given** un contrato que no pasa la verificación, **When** se intenta generar la
   documentación, **Then** la generación falla; no se publica documentación de un contrato
   inválido.

---

### User Story 5 - Pruebas automáticas demuestran que el servidor cumple el contrato (Priority: P2)

Además de las pruebas escritas por el agente, una herramienta genera requests a partir del
contrato (válidos e inválidos, en los bordes de cada esquema) y verifica que el servidor real
responde siempre conforme al contrato: códigos declarados, cuerpos que validan, errores en
Problem Details.

**Why this priority**: Encuentra lo que las pruebas escritas a mano no cubren. Es la red que
detecta divergencia contrato–código que la validación en runtime no atrapa (por ejemplo,
respuestas con códigos no declarados).

**Independent Test**: Se corre la herramienta contra el servidor levantado con `getHealth` y
termina sin fallas; se introduce un código de respuesta no declarado en el manejador y la
herramienta lo detecta.

**Acceptance Scenarios**:

1. **Given** el servidor levantado, **When** se corren las pruebas de contrato generadas,
   **Then** terminan sin fallas.
2. **Given** un manejador que responde con un código no declarado en el contrato, **When** se
   corren las pruebas de contrato, **Then** fallan identificando la operación y el código.

---

### Edge Cases

- **Contrato multi-archivo con referencia rota**: la verificación falla nombrando el archivo y
  la referencia; el bundle no se produce.
- **Referencia circular entre esquemas**: se permite si la herramienta la resuelve; la
  verificación no debe colgarse.
- **Primer contrato (no hay versión previa en la rama principal)**: la comparación de
  compatibilidad se omite con un aviso explícito, no falla.
- **Cambio compatible (agregar campo opcional, agregar operación, agregar valor de enum en
  respuesta)**: la comparación pasa sin exigir versión mayor.
- **Agregar valor de enum en un campo de request**: se trata como compatible. Quitar un valor
  de enum en request, o agregar uno en respuesta que un cliente estricto no conoce, se trata
  como incompatible.
- **`merchantId` en una respuesta**: permitido (el servidor puede devolverlo); la regla sólo
  prohíbe que entre por el request.
- **`password` en el esquema de autenticación del portal**: la única excepción permitida a la
  lista de datos personales; el ruleset la acota al esquema de credenciales de login, que en
  esta feature aún no existe. Cualquier otra aparición falla.
- **Servidor sin contrato o con contrato inválido al arrancar**: el servidor no arranca y
  reporta el motivo. Nunca arranca "parcialmente".
- **Manejador que lanza una excepción**: el servidor responde `500` con Problem Details
  genérico, sin exponer el mensaje interno ni el stack.
- **Request a `GET /v1/health` con query params no declarados**: se rechaza con `400`
  (los parámetros desconocidos son violación, igual que los campos desconocidos en el body).

## Requirements *(mandatory)*

### Functional Requirements

**Contrato**

- **FR-001**: El contrato MUST estar en OpenAPI 3.1, dividido en múltiples archivos bajo
  `contracts/` (raíz + paths + componentes + webhooks + ejemplos), unidos por referencias.
- **FR-002**: La verificación MUST producir un contrato empaquetado en un solo archivo, que es
  el artefacto que consumen tipos, mock, documentación y pruebas.
- **FR-003**: El contrato MUST declarar su versión con semántica mayor.menor.parche en
  `info.version`, y las rutas MUST llevar prefijo de versión mayor (`/v1`).
- **FR-004**: El contrato MUST declarar un catálogo cerrado de etiquetas (`tags`) y toda
  operación MUST usar exactamente una de ellas. Para esta feature el catálogo es
  `system`; features posteriores lo amplían (`ingest`, `decision`, `outcomes`, `portal`,
  `admin`).
- **FR-005**: El contrato MUST definir un esquema reutilizable de Problem Details conforme a
  RFC 9457 (`type`, `title`, `status`, `detail`, `instance`, más extensiones documentadas) y un
  catálogo de `type` URIs bajo un espacio de nombres propio.
- **FR-006**: El contrato MUST incluir la operación `getHealth` (`GET /v1/health`, tag
  `system`), sin autenticación, que responde `200` con estado del servicio, versión del
  contrato y marca de tiempo, y declara `500` como Problem Details.

**Verificación del contrato (falla el build)**

- **FR-010**: Un único comando MUST ejecutar toda la verificación del contrato y terminar con
  código distinto de cero ante cualquier violación.
- **FR-011**: La verificación MUST fallar ante violaciones de estilo y estructura de OpenAPI
  (referencias rotas, esquemas inválidos, rutas duplicadas).
- **FR-012**: La verificación MUST fallar si una operación carece de `operationId`,
  `summary`, `description` o `tags`, o si un `operationId` está duplicado o no es `camelCase`.
- **FR-013**: La verificación MUST fallar si una propiedad de esquema carece de `description`.
- **FR-014**: La verificación MUST fallar si un request body o una respuesta `2xx` con cuerpo
  carece de al menos un ejemplo.
- **FR-015**: La verificación MUST fallar si un esquema usado como request body (o cualquier
  objeto anidado en él) no declara `additionalProperties: false`.
- **FR-016**: La verificación MUST fallar si cualquier esquema, parámetro o header declara una
  propiedad cuyo nombre coincide (sin distinguir mayúsculas) con la lista de datos personales
  prohibidos. La lista MUST vivir en un solo lugar del repositorio y ser ampliable.
- **FR-017**: La verificación MUST fallar si `merchantId` (sin distinguir mayúsculas ni
  separadores) aparece como parámetro de path, query, header o cookie, o como propiedad de un
  request body.
- **FR-018**: La verificación MUST fallar si una respuesta `4xx` o `5xx` no usa el tipo de
  contenido `application/problem+json` con el esquema Problem Details del contrato.
- **FR-019**: La verificación MUST fallar si una operación no declara `500`; si una operación
  autenticada no declara `401`; si una operación con request body no declara `400` y `422`.
- **FR-020**: La verificación MUST comparar el contrato empaquetado con el de la rama
  principal y fallar ante cambios incompatibles cuando la versión mayor no aumentó. La lista
  de cambios incompatibles MUST cubrir al menos: eliminar operación, eliminar o renombrar
  campo de respuesta, volver obligatorio un campo de request, cambiar tipo o formato, quitar
  valor de enum en request, agregar respuesta de error nueva a una operación existente.
- **FR-021**: Cada violación reportada MUST indicar regla, archivo y posición, y una frase
  que explique cómo corregirla.

**Generación**

- **FR-030**: Un comando MUST generar los tipos de request/response de todas las operaciones
  a partir del contrato empaquetado, de forma determinista, en un directorio marcado como
  generado.
- **FR-031**: La verificación MUST fallar si los tipos commiteados difieren de la regeneración.
- **FR-032**: Un comando MUST generar documentación navegable estática desde el contrato
  empaquetado, y MUST rehusarse si la verificación del contrato falla.
- **FR-033**: El repositorio MUST proveer un cliente HTTP tipado para consumidores (SDK,
  portal) derivado de los mismos tipos generados, con presupuesto de peso compatible con un
  tag de navegador.

**Servidor**

- **FR-040**: El servidor MUST cargar el contrato al arrancar y rehusarse a arrancar si el
  contrato no es válido.
- **FR-041**: El servidor MUST rutear cada request al manejador registrado bajo el
  `operationId` correspondiente. No MUST existir otro mecanismo de registro de rutas.
- **FR-042**: El servidor MUST validar parámetros, headers y cuerpo del request contra el
  contrato antes de invocar el manejador; ante violación responde `400` o `422` con Problem
  Details que enumera cada violación.
- **FR-043**: El servidor MUST validar la respuesta del manejador contra el contrato antes de
  enviarla; ante violación responde `500` con Problem Details y registra el error.
- **FR-044**: El servidor MUST responder `404` Problem Details ante rutas no declaradas, `405`
  ante métodos no declarados y `501` ante operaciones declaradas sin manejador.
- **FR-045**: El servidor MUST responder `500` con Problem Details genérico ante excepciones no
  controladas, sin exponer detalles internos.
- **FR-046**: Los manejadores MUST recibir y devolver los tipos generados; un manejador con
  tipo de respuesta incompatible MUST fallar la compilación.
- **FR-047**: El manejador de `getHealth` MUST estar implementado y responder conforme al
  contrato.

**Pruebas**

- **FR-050**: El repositorio MUST incluir pruebas unitarias del manejador de `getHealth` y
  pruebas de integración del servidor que cubran los escenarios de aceptación de la historia 2.
- **FR-051**: El repositorio MUST incluir pruebas de contrato generadas automáticamente desde
  el contrato contra el servidor levantado, ejecutables con un comando.
- **FR-052**: El repositorio MUST incluir una prueba que ejercite cada regla de verificación
  del contrato (FR-012 a FR-020) con un caso que viola y verifica la falla, para que las
  reglas propias no se rompan sin que se note.

**Integración continua**

- **FR-060**: Un flujo de integración continua MUST ejecutar, en cada cambio propuesto:
  verificación del contrato, comparación de compatibilidad contra la rama principal, chequeo de
  tipos generados, compilación, pruebas unitarias e integración, y pruebas de contrato.
- **FR-061**: El repositorio MUST documentar en su guía para agentes los comandos y el orden
  de trabajo (contrato → verificación → tipos → manejador → pruebas).

### Key Entities

- **Contrato**: el conjunto de archivos bajo `contracts/`; tiene versión semántica, catálogo de
  etiquetas, catálogo de tipos de error y operaciones identificadas por `operationId`.
- **Contrato empaquetado**: el contrato resuelto en un único archivo; es la entrada de todo lo
  generado y de la comparación de compatibilidad.
- **Regla de verificación**: una restricción nombrada sobre el contrato, con severidad
  `error`, mensaje y forma de corregir. Las reglas propias de OPE viven junto a las de estilo.
- **Lista de datos personales prohibidos**: nombres de propiedad que nunca pueden aparecer en
  el contrato; única fuente, ampliable.
- **Problem Details**: esquema único de error para toda la API, con catálogo de `type`.
- **Tipos generados**: artefacto derivado del contrato empaquetado; commiteado, nunca editado.
- **Manejador**: función que atiende un `operationId`, tipada por los tipos generados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cada una de las reglas FR-012 a FR-020 tiene una prueba que demuestra que un
  contrato que la viola falla la verificación; 100 % de las reglas cubiertas.
- **SC-002**: Un agente que agrega una operación que viola una regla recibe la falla en menos
  de 30 segundos de ejecución local, con archivo y línea, sin necesidad de levantar el servidor.
- **SC-003**: `GET /v1/health` responde conforme al contrato en el servidor real, en el mock y
  en la documentación generada, sin que ningún texto de la operación esté duplicado fuera de
  `contracts/`.
- **SC-004**: La verificación completa (contrato + compatibilidad + tipos + compilación +
  pruebas) corre en integración continua en menos de 5 minutos sobre el estado de esta feature.
- **SC-005**: Ninguna ruta puede servirse sin estar en el contrato: una prueba lo demuestra
  intentando registrar un manejador con un `operationId` inexistente y verificando que el
  servidor lo rechaza al arrancar.
- **SC-006**: Dos generaciones consecutivas de tipos y de documentación sobre el mismo contrato
  producen artefactos byte a byte idénticos.
- **SC-007**: Un consumidor puede hacer un request tipado a `getHealth` con el cliente
  generado, y un uso con tipo incorrecto no compila.

## Assumptions

- El contrato es la única fuente de verdad: no existe generación de contrato desde código.
  Esto es DECIDIDO por la constitución y no se revisa en esta feature.
- Los "usuarios" de esta feature son agentes/desarrolladores del backend, del SDK y del portal,
  y el equipo técnico del merchant como lector del contrato. No hay usuario final.
- Esta feature no define autenticación: `getHealth` es pública. La regla FR-019 sobre `401`
  queda definida para operaciones autenticadas pero no tiene operación que la ejercite hasta
  la feature de ingesta; la prueba de FR-052 la ejercita con un contrato de fixture.
- La lista inicial de datos personales prohibidos es la de la historia 1, escenario 6; se
  amplía en features posteriores sin cambiar esta spec.
- La comparación de compatibilidad se hace contra el contrato empaquetado de la rama
  principal; en el primer contrato se omite con aviso.
- Las herramientas concretas (linter, bundler, generador de tipos, mock, comparador,
  validador en runtime, generador de pruebas) se eligen en el plan, no aquí. La spec sólo exige
  el comportamiento.
- El stack es Node.js LTS + TypeScript estricto (D1, DECIDIDO). Las herramientas que no sean
  de ese ecosistema (por ejemplo, un comparador de contratos o un generador de pruebas en
  otro lenguaje) son aceptables si se invocan desde los mismos comandos del repositorio y
  corren en integración continua sin instalación manual.
- No se definen en esta feature: persistencia, Redis, PostgreSQL, autenticación, ni ninguna
  operación de dominio. Aparecen en features posteriores.
