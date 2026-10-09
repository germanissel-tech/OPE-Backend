# Feature Specification: El contrato como artefacto para consumidores, y el operador con identidad

**Feature Branch**: `040-el-contrato-para-consumidores`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Lo que OPE-Web le pide al backend, escrito en los planes de sus features 005
(`specs/005-la-base-de-ope/plan.md`, «Dependencia con OPE-Backend: la feature 040») y 006
(`specs/006-el-merchant-completo/plan.md` y `contracts/constraints-artifact.md`), con la decisión del
dueño del 2026-10-09 de hacerla ahora, antes de la siguiente feature del panel. Cinco cosas, y nada más.

## Por qué existe

OPE-Console está construida contra este backend y funciona. Lo hace con **tres muletas**, escritas
como tales y con fecha de vencimiento: una sonda que llama a `listMerchants?limit=1` para saber que
una credencial sirve, porque no hay operación que diga **quién** es el operador; y un sincronizador
que, al no existir una carpeta de artefactos para consumidores, **emite por su cuenta** el módulo de
capacidades y las restricciones de cada cuerpo de pedido leyendo el bundle del contrato. Las tres
viven en el frontend porque el backend no las da; las tres se borran de un golpe el día que las dé.

Y hay dos cosas que el frontend muestra peor de lo que podría porque el backend no las manda. **Todo
aviso de error dice «sin identificador»**: el backend genera un identificador por pedido para sus
registros y no lo devuelve en la respuesta, así que «no anda» no se puede cruzar con nada. Y **un
rechazo de invariante llega sin decir qué campo**: `origin-already-registered` sabe cuál de los
orígenes está repetido (su error de dominio lleva el índice) y `rotation-grace-too-long` sabe que es la
gracia, pero el Problem Details sale sin `errors[]`, y el formulario tiene que mostrar el rechazo al
pie o en un aviso en vez de en el renglón.

Nada de esto es nuevo: cada punto está pedido por escrito en el plan de la feature que lo necesitó,
con la forma exacta que el frontend ya consume. Esta feature los construye.

## Lo decidido antes de la spec

1. **La forma de los artefactos la publica el consumidor, no se negocia acá.** OPE-Web escribió
   `contract-artifact.md` (bundle, tipos, catálogo de problemas, módulo de capacidades, identidad) y
   `constraints-artifact.md` (restricciones por cuerpo de pedido), y hoy los emite con esa forma. Esta
   feature emite **lo mismo** desde `contract:types`: cuando `generated/contract/` exista, el
   sincronizador del frontend copia en vez de emitir, y su comprobación de conformidad tiene que pasar
   sin cambiar una línea. Un formato distinto no sería un artefacto: sería una cuarta muleta.
2. **El operador tiene nombre, y la constitución VII se acota a las personas observadas.** «OPE observa
   comportamiento, no personas» protege al visitante y al comprador, que son anónimos por diseño. Los
   operadores son otra cosa: están identificados, autenticados y auditados por su `operatorId`, y
   mostrarles su nombre en la barra de la consola no observa a nadie. La constitución se enmienda para
   decirlo; el lint que prohíbe datos personales sigue prohibiendo todo en `public`, `sdk`, `platform` y
   `portal`, y gana **una** excepción, acotada al esquema del operador bajo `admin`, con nombre y razón.
   Decidido con el dueño al cerrar la spec de OPE-Web 005 (2026-10-07).
3. **Identificarse no exige una capacidad.** `getOperator` dice quién es el principal autenticado, y
   eso lo puede preguntar cualquier operador: lo que exige es una credencial válida, no un permiso. Es
   la primera operación `admin` sin capacidad, y la regla del contrato que exige capacidades a toda
   operación autenticada tiene que admitirlo **nombrando por qué** —identificarse no habilita ningún
   botón—, no aflojándose en general.
4. **El identificador de pedido es el que ya existe.** El servidor acuña uno por pedido para sus
   registros; esta feature lo expone, no inventa otro. Lo que el operador cite en un reporte es lo que
   el registro del servidor tiene.
5. **Lo que no se pide, no se construye**: ni CORS para `admin` (la consola habla con su propio origen
   y reenvía), ni un endpoint de telemetría (cerrado con el dueño en la 005), ni testigo de
   concurrencia (feature posterior; `TAN-10` de Tandilia como referencia), ni capacidades por operador
   (el alcance de OPE es por merchant, y la consola sigue al backend; `OW-7` de OPE-Web).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un consumidor del contrato toma sus artefactos sin emitir nada (Priority: P1)

Quien construye un frontend contra OPE corre el generador del backend y encuentra, en una carpeta
propia para consumidores, todo lo que necesita para compilar y verificar sin leer el bundle por su
cuenta: el bundle, los tipos, el catálogo de problemas, el módulo de capacidades (qué exige cada
operación del consumidor `admin` y si es idempotente), las restricciones de cada cuerpo de pedido y la
identidad del contrato del que todo eso salió.

**Why this priority**: es lo que saca las dos muletas más grandes del frontend y, sobre todo, lo que
evita que haya **dos** emisores del mismo módulo —uno acá, otro allá— que un día no coincidan. La
comprobación de conformidad del frontend ya compara identidad contra bundle; con esta historia compara
contra lo que el backend emitió.

**Independent Test**: correr `contract:types`, copiar `generated/contract/` a `contracts/ope/` de
OPE-Web, y correr su comprobación de conformidad: pasa, y su `README` dice «copiado del backend» en
vez de «emitido».

**Acceptance Scenarios**:

1. **Given** el contrato en su estado actual, **When** se corre el generador, **Then**
   `generated/contract/` contiene el bundle, `api.d.ts`, `problem-types.d.ts`, `capabilities.js`,
   `capabilities.d.ts`, `constraints.js`, `constraints.d.ts` e `identity.json`, cada uno con la
   cabecera que dice qué script lo generó.
2. **Given** `generated/contract/` recién emitida, **When** OPE-Web la sincroniza, **Then** copia sin
   emitir, y su conformidad pasa: la identidad coincide con el bundle, cada operación `admin` está en el
   módulo con sus capacidades, el vocabulario es la unión ordenada, y cada esquema de cuerpo de pedido
   está en las restricciones con su `required`.
3. **Given** una operación `admin` nueva en el contrato, **When** se regenera, **Then** el módulo la
   trae, y un `generated/contract/` viejo commiteado hace fallar la verificación de drift igual que los
   demás generados.
4. **Given** un cuerpo de pedido con una lista (`origins`), **When** se emiten las restricciones,
   **Then** la propiedad lleva `minItems`, `maxItems` y las restricciones de cada elemento en `items`,
   y una propiedad que referencia otro esquema lleva `{ type: 'object', ref: '<Nombre>' }`.

---

### User Story 2 - El operador sabe quién es, y el panel lo muestra (Priority: P1)

Un operador entra al panel con su credencial y ve en la barra su nombre, o su identificador si no
tiene nombre, y cuántos merchants alcanza. El panel lo averigua con una sola llamada que responde quién
es el principal autenticado.

**Why this priority**: hoy el panel sabe que la credencial sirve y nada más: la barra dice `operator`
para todos. Es la muleta que más se ve, y la única de las tres que un operador nota.

**Independent Test**: con una credencial válida, pedir `GET /v1/admin/operator` y recibir
`operatorId`, `scope` y, si el operador lo tiene configurado, `displayName`; con una credencial
inválida, `401`.

**Acceptance Scenarios**:

1. **Given** un operador configurado con alcance `*` y nombre, **When** pide `getOperator` con su
   credencial, **Then** recibe `{ operatorId, displayName, scope: "*" }`.
2. **Given** un operador configurado con una lista de merchants y sin nombre, **When** pide
   `getOperator`, **Then** recibe `{ operatorId, scope: [...] }` sin `displayName`, y nada inventa un
   nombre.
3. **Given** una credencial que ningún operador tiene, **When** pide `getOperator`, **Then** recibe
   `401` con el tipo de problema de siempre, igual que cualquier operación `admin`.
4. **Given** el archivo de operadores de desarrollo, **When** el servidor arranca, **Then** acepta
   entradas con `displayName` y sin él, y una entrada con cualquier otro dato personal sigue sin
   entrar al esquema del contrato.
5. **Given** el contrato, **When** se corre su lint, **Then** `getOperator` pasa sin declarar
   capacidad, y cualquier otra operación `admin` sin capacidad sigue fallando.

---

### User Story 3 - Un rechazo de invariante dice qué campo (Priority: P2)

Un operador manda un alta con dos orígenes y el segundo ya pertenece a otro merchant: el rechazo señala
**ese** renglón. Manda una rotación con una gracia por encima del máximo: el rechazo señala **la
gracia**. El formulario muestra el error donde se corrige.

**Why this priority**: el frontend ya tiene el camino construido —un `pointer` bajo `/body` cae en el
campo— y hoy lo recorre sólo con los `400` del validador del contrato. Cada `422` de esquema con un
campo identificable que llegue sin `errors[]` es un formulario que manda al operador a buscar.

**Independent Test**: crear un merchant con un origen ya registrado en la segunda posición y recibir
`422 origin-already-registered` con `errors: [{ pointer: '/body/origins/1', message }]`.

**Acceptance Scenarios**:

1. **Given** un merchant con `https://a.example`, **When** otro alta trae
   `["https://b.example", "https://a.example"]`, **Then** `422 origin-already-registered` con un
   `errors[]` cuyo único puntero es `/body/origins/1`.
2. **Given** una rotación con gracia mayor al máximo de la plataforma, **When** se pide, **Then**
   `422 rotation-grace-too-long` con `errors: [{ pointer: '/body/graceSeconds', message }]`.
3. **Given** un rechazo de invariante que **no** señala un campo (una regla de operación, o una de
   esquema sobre el cuerpo entero), **When** se responde, **Then** sigue sin `errors[]`: un puntero
   inventado es peor que ninguno.
4. **Given** el contrato, **When** se lee la declaración de cada invariante de esquema, **Then** dice
   si señala un campo y cuál, y la prueba de ese invariante afirma el puntero.

---

### User Story 4 - Todo error se puede citar (Priority: P2)

Un operador ve un error en el panel y el aviso trae un identificador; lo cita, y quien lo busca en los
registros del servidor encuentra ese pedido.

**Why this priority**: es lo que convierte «no anda» en algo que se puede diagnosticar. Hoy el
registro del servidor tiene el identificador y la respuesta no, así que el operador no tiene qué citar.
Va después de las otras porque el frontend ya muestra «sin identificador» de forma honesta: no mejora
mal, mejora poco.

**Independent Test**: cualquier respuesta trae `X-Request-Id`; un Problem Details trae además
`requestId` con el mismo valor; y ese valor es el `reqId` de las líneas del registro de ese pedido.

**Acceptance Scenarios**:

1. **Given** cualquier pedido, **When** se responde —`200`, `404`, `500`, lo que sea—, **Then** la
   respuesta lleva el encabezado `X-Request-Id`.
2. **Given** un pedido que termina en Problem Details, **When** se responde, **Then** el cuerpo lleva
   `requestId` igual al encabezado, y el esquema del contrato lo admite.
3. **Given** un identificador citado por un operador, **When** se buscan los registros del servidor,
   **Then** las líneas de ese pedido lo llevan como `reqId`.
4. **Given** un pedido que trae su propio `X-Request-Id`, **When** se responde, **Then** el servidor
   **no lo adopta**: el identificador es suyo, para que un valor pegado no se confunda con uno acuñado.

---

### Edge Cases

- **Un operador con nombre vacío o sólo espacios**: la configuración lo rechaza al arrancar, igual que
  cualquier otro valor con forma inválida; no se sirve `displayName: ""`.
- **El contrato cambia y `generated/contract/` no se regenera**: la verificación de drift falla, como
  con todo lo generado. Un consumidor nunca copia artefactos viejos sin que el backend lo sepa.
- **Un invariante de esquema con un campo que es una lista de objetos** (`duplicate-attribute-label`,
  `duplicate-order-item`): el puntero llega hasta el elemento repetido (`/body/labels/3`), no más
  adentro, porque es lo que el error de dominio sabe.
- **Dos orígenes repetidos en el mismo alta**: el puntero señala el primero que choca; el operador lo
  corrige y el siguiente intento señala el otro. Señalar los dos exigiría que el dominio evalúe de más
  después de la primera falla, y hoy no lo hace.
- **Un Problem Details que el servidor arma antes de tener identificador** (un pedido que no llegó a
  entrar al ciclo): lleva el encabezado igual, porque el identificador se acuña al recibir el pedido.
- **La excepción del lint de datos personales**: alcanza al esquema del operador bajo `admin` y a
  ningún otro. Un `displayName` en el esquema de un merchant, de una orden o del portal sigue fallando.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Toda respuesta HTTP MUST llevar el encabezado `X-Request-Id` con el identificador que el
  servidor acuñó para ese pedido, el mismo que sus registros llevan como `reqId`.
- **FR-002**: Todo Problem Details MUST llevar `requestId` con ese mismo valor, y el esquema
  `ProblemDetails` del contrato MUST admitirlo como miembro opcional y documentado.
- **FR-003**: El servidor MUST NOT adoptar un `X-Request-Id` que venga en el pedido.
- **FR-004**: El contrato MUST declarar `getOperator` (`GET /v1/admin/operator`, consumidor `admin`,
  esquema de seguridad `adminToken`) que responde `{ operatorId, displayName?, scope }` del principal
  autenticado, con `401` para una credencial desconocida y sin `403` posible.
- **FR-005**: `getOperator` MUST NOT exigir capacidad, y la regla del contrato que exige capacidades a
  toda operación autenticada MUST admitirlo por una declaración explícita y acotada, no por una
  excepción general.
- **FR-006**: La configuración de operadores (`OPE_ADMIN_OPERATORS`, `OPE_ADMIN_OPERATORS_FILE`,
  `config/dev-operators.json`) MUST aceptar `displayName` opcional por operador, no vacío, y su esquema
  MUST rechazar cualquier otro dato personal.
- **FR-007**: El registro de administración MUST seguir indexado por `operatorId`; `displayName` no
  entra en ninguna entrada de registro ni de auditoría.
- **FR-008**: La constitución VII MUST acotarse a las personas observadas (visitante y comprador) y
  declarar a los operadores como identificados y auditados, con versión nueva y fecha.
- **FR-009**: El lint `ope-no-pii` MUST seguir prohibiendo todo nombre de la lista en los consumidores
  `public`, `sdk`, `platform` y `portal`, y MUST admitir `displayName` **sólo** en el esquema del
  operador bajo `admin`, con la excepción escrita con nombre y razón donde el lint la lee, y con una
  fixture que verifique que fuera de ese esquema sigue fallando.
- **FR-010**: `contract:types` MUST emitir `generated/contract/` con el bundle, `api.d.ts`,
  `problem-types.d.ts`, `capabilities.{js,d.ts}`, `constraints.{js,d.ts}` e `identity.json`, con la
  forma **exacta** de `contract-artifact.md` y `constraints-artifact.md` de OPE-Web, cabecera
  `GENERATED by scripts/<x>.mjs` en cada archivo, y de forma determinista.
- **FR-011**: El módulo de capacidades MUST listar toda operación del consumidor `admin` con sus
  capacidades e idempotencia, y el vocabulario como la unión ordenada; una operación sin capacidad
  (`getOperator`) MUST figurar con la lista vacía, y el consumidor MUST poder distinguirla de una
  operación olvidada.
- **FR-012**: Las restricciones MUST cubrir todo esquema objeto que un cuerpo de pedido del consumidor
  `admin` referencie, directa o transitivamente, con `required`, `type`, `minLength`, `maxLength`,
  `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `items` recursivo, `enum`, `format` y
  `$ref` como `{ type: 'object', ref }`; sin `default` ni `description`.
- **FR-013**: `identity.json` MUST llevar la versión del contrato, el `sha256` del bundle y el commit
  del backend que lo emitió, y `CONTRACT` de los dos módulos MUST llevar la misma versión y `sha256`.
- **FR-014**: `generated/contract/` MUST versionarse, marcarse `linguist-generated`, tener su fila en el
  inventario de `generated/README.md`, y entrar en la verificación de drift (`contract:types:check`).
- **FR-015**: Todo `422` de un invariante **de esquema** que señale un campo identificable MUST llevar
  `errors[]` con un solo elemento cuyo `pointer` empiece por `/body` y llegue hasta el campo o el
  elemento de lista que el error de dominio conoce; `origin-already-registered` → `/body/origins/N`,
  `rotation-grace-too-long` → `/body/graceSeconds`.
- **FR-016**: Un invariante que no señala un campo MUST seguir respondiendo sin `errors[]`.
- **FR-017**: La declaración de cada `x-invariants` de esquema en el contrato MUST decir si señala un
  campo (`pointer`), y la prueba `[invariant:<slug>]` de cada uno MUST afirmar el puntero cuando lo hay.
- **FR-018**: El cambio del contrato MUST ser compatible (`1.11.0` → `1.12.0`): `requestId` y
  `displayName` opcionales, `getOperator` nueva, `errors[]` donde antes no había.
- **FR-019**: La operación nueva MUST pasar por el mapa del contrato (`planned` → `built`, con feature
  `040`), y la constitución, `CLAUDE.md`, los README con inventario y el glosario MUST decir lo que
  quedó.

### Key Entities

- **El operador (principal `admin`)**: `operatorId`, huellas de sus tokens, alcance (`*` o una lista
  de merchants) y, nuevo, `displayName` opcional. Es la única persona del sistema con nombre, y está
  identificada y auditada por su identificador, no por el nombre.
- **El artefacto para consumidores** (`generated/contract/`): lo que un frontend copia tal cual.
  Bundle, tipos, catálogo de problemas, módulo de capacidades, restricciones e identidad, todos del
  mismo bundle y con la misma identidad.
- **El puntero de un rechazo**: el camino desde la raíz del pedido (`/body/...`) hasta el campo o el
  elemento que un invariante de esquema señala; lo conoce el error de dominio y lo escribe el borde.
- **El identificador de pedido**: el que el servidor acuña al recibirlo y escribe en sus registros;
  desde esta feature, también en la respuesta.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **OPE-Web deja de emitir**: con `generated/contract/` copiada tal cual, su comprobación de
  conformidad pasa y su sincronizador dice «copiado del backend» para el módulo y las restricciones.
  Verificable corriendo `npm run contract:sync` y `npx ope-check` en OPE-Web contra este backend.
- **SC-002**: **La barra de la consola dice el nombre del operador**, o su identificador si no lo
  tiene, sin tocar la consola más que para reemplazar la sonda por la llamada. Verificable entrando a
  OPE-Console con el operador de desarrollo con `displayName` configurado.
- **SC-003**: **Un alta con un origen repetido marca el renglón** y una gracia excesiva marca el campo
  en el formulario de la consola, sin cambiar la consola. Verificable a mano contra `npm run dev`.
- **SC-004**: **Todo aviso de error de la consola trae un identificador** que aparece en el registro
  del servidor de ese pedido. Verificable citando el identificador de un aviso y buscándolo en el
  registro.
- **SC-005**: **Nada de lo que hoy se verifica deja de verificarse**: `contract:check`, `npm test`,
  `test:contract`, mutación y durabilidad en verde; `ope-no-pii` sigue fallando con un dato personal
  fuera de la excepción, y una operación `admin` nueva sin capacidad sigue fallando el lint.
- **SC-006**: **El contrato es compatible**: `contract:diff` lo clasifica como cambio menor, y la
  versión es `1.12.0`.

## Assumptions

- La forma de los artefactos es la que OPE-Web publicó y emite hoy; si al emitirla desde acá aparece
  algo que esa forma no expresa, se conversa con el dueño antes de cambiar la forma de un lado.
- El identificador de pedido que Fastify ya acuña (`reqId`) alcanza como identificador público: es
  único por proceso y por pedido, y lo que importa es que coincida con el registro. Si en producción
  hubiera más de un proceso, el prefijo que lo distinga es de despliegue, no de esta feature.
- `displayName` es un texto corto para mostrar, sin forma impuesta más que no vacío y un largo máximo
  razonable; no es un identificador y no se busca por él.
- El puntero de un invariante lo conoce el error de dominio (hoy `OriginAlreadyRegistered` ya lleva el
  índice); donde no lo lleve, se agrega al error, no se adivina en el borde.
- La prueba de conformidad de OPE-Web es el oráculo del artefacto: si pasa con lo copiado, el artefacto
  está bien.

## Out of Scope

- CORS para el consumidor `admin`: la consola habla con su propio origen y reenvía (`OW-6` de OPE-Web).
- Un endpoint de telemetría del frontend: cerrado con el dueño en la 005 de OPE-Web.
- El testigo de concurrencia (`If-Match`, `ETag`): feature posterior, `TAN-10` como referencia.
- Capacidades por operador: el alcance de OPE es por merchant (`ADR-031`), y la consola sigue al backend.
- Cambiar nada de lo que el panel ya muestra: esta feature da datos; cómo se muestran es de OPE-Web.
- Artefactos para otros consumidores (`portal`, `sdk`): la misma carpeta los traerá cuando exista quien
  los consuma; el emisor se escribe para `admin` sin cerrarse a uno.
