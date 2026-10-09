# Research — fase 0 (041, el merchant con identidad)

Lo que había que mirar antes de planificar: dónde vive hoy el merchant, qué cambia de forma al darle
nombre y contacto, qué ya hace la herramienta con un dato personal, y qué no alcanza. Cada hallazgo
termina en una decisión, con lo que se descartó.

## R-01 — El almacén guarda el merchant como documento: no hay migración

**Lo que hay.** `sqliteMerchantStore` escribe cada merchant en una columna `document` (JSON de
`merchant.record()`, con los instantes marcados por `toDocument`) y dos columnas indexadas
(`merchant_id`, `status`), más la tabla `merchant_origins` para la unicidad de orígenes (ADR-041).
Lee de memoria: el índice se llena al arrancar con `Merchant.rehydrate(fromDocument(...))`.

**Decisión.** Los cuatro campos viajan **dentro del documento**, como parte de `MerchantRecord`: ni
columna ni migración nuevas, y nada que indexar (no se busca por nombre: fuera de alcance). Un
documento viejo sin los campos rehidrata un merchant sin identidad, que es exactamente lo que la spec
pide (decisión 4). La prueba de durabilidad afirma que la identidad sobrevive un reinicio.

**Lo que se descartó.** Columnas propias (`display_name`, …): sólo servirían para consultar por
ellas, y no se consulta. Una tabla aparte `merchant_profiles`: dos escrituras para un agregado que ya
va entero en una transacción (R-02).

## R-02 — La identidad es parte del agregado, no otro agregado

**Lo que hay.** El `Merchant` (ADR-031) es un agregado con `merchantId`, `status`, `origins`,
`credentials`, `createdAt`; sus reglas son de seguridad y operación (`rotated`, `switched`,
`deactivated`). Su configuración y sus experimentos son agregados aparte porque tienen **otra vida**:
versiones, ventanas, fases.

**Decisión.** La identidad **no tiene otra vida**: se lee con el merchant (lista y ficha), se escribe
con su alcance y en su misma transacción, y no se versiona. Va en el agregado como un **valor**
`MerchantProfile` (clase, porque tiene reglas, ADR-024), con `Merchant.withProfile(profile)` que
devuelve el merchant con la identidad reemplazada y no falla (la validez la juzgó `MerchantProfile.of`).
`Merchant.of` lo acepta opcional al crear. Un merchant desactivado admite `withProfile`: la relación
comercial no depende del estado operativo (spec, historia 2, escenario 6).

**Lo que se descartó.** Un agregado `MerchantProfile` con su store y su puerto: tres archivos más para
un dato que nunca se lee sin el merchant, y una segunda escritura que el aislamiento tendría que
cubrir aparte.

## R-03 — La edición es un reemplazo, y por eso es `PUT`

**Lo que hay.** Las escrituras `admin` sobre un merchant son `PUT` de un recurso chico con semántica
de reemplazo (`kill-switch` con `{ enabled }`) o `POST` de una acción (`deactivate`, las tres
rotaciones). No hay ningún `PATCH` en el contrato, y el helper `admin()` de las pruebas conoce `GET`,
`POST` y `PUT`.

**Decisión.** `PUT /v1/admin/merchants/{merchantId}/profile` con `operationId: updateMerchantProfile`,
cuerpo `MerchantProfileInput` (`displayName` obligatorio; `storeUrl`, `contact`, `notes` opcionales;
**ausente es vacío**), respuesta `200` con el `Merchant` entero como lo deja. Capacidad
`merchants:write`, la que ya existe; es `admin` y escribe, así que el contrato manda auditarla sin
que nadie lo elija (ADR-023, feature 021). El alcance lo aplica `ScopedMerchantService.find`, con
`403 merchant-out-of-scope` sin revelar existencia, como `setKillSwitch`.

**Lo que se descartó.** `PATCH` con semántica de parche: obligaría a definir «ausente» contra
«vacío» por campo, a un media type `merge-patch`, y a un helper nuevo; el beneficio sería ahorrarle a
la consola mandar cuatro campos que ya tiene en pantalla. Y editar por `PUT /v1/admin/merchants/{id}`
entero: mezclaría la identidad con orígenes, estado y credenciales, que tienen sus reglas y sus
operaciones (spec, decisión 5).

## R-04 — Qué juzga el esquema y qué juzga el dominio

**Lo que hay.** El validador del contrato responde `400` con `errors[]` y puntero bajo `/body` para
todo lo que el esquema expresa (largos, patrones, `required`, propiedades no declaradas), y
`ajv-formats` está cargado (`build-server.ts`): `format: email` y `format: uri` **se validan**. Un
invariante que el esquema no expresa va con tipo propio en el catálogo y responde `422` con puntero
(ADR-007; feature 040 para el `/body`).

**Decisión.** El esquema lleva todo lo que puede: `required`, `minLength`, `maxLength`, `format:
email` en `contact.email`, `pattern: ^https?://` en `storeUrl`, `additionalProperties: false`. El
dominio juzga lo que el esquema no dice: un texto **sin espacios en los bordes** (`displayName`,
`contact.name`; un `pattern` para «sin espacios en los bordes» es ilegible y se copia mal) y una URL
**parseable** (`new URL` la acepta; el patrón sólo mira el prefijo). Un solo invariante de esquema,
`invalid-merchant-profile` (`422`), con `pointer` al campo (`displayName`, `storeUrl`,
`contact.name`), sobre `MerchantCreate` y `MerchantProfileInput`; el error de dominio
`InvalidMerchantProfile(field)` lleva `details.pointer`, y el borde lo publica como `/body/<campo>`.
La prueba `[invariant:invalid-merchant-profile]` nombra `/body/displayName`, que es lo que
`check:invariant-tests` exige desde la 040.

**Lo que se descartó.** Juzgar todo en el dominio y dejar el esquema laxo: el consumidor pierde las
restricciones de capa 1 que la 040 le acaba de dar. Y recortar espacios en vez de rechazar: un valor
que entra distinto de como se escribió no es lo que el operador tecleó, y «se guarda como se escribió»
es la regla de `storeUrl` también.

## R-05 — El lint ya prohíbe `name`, `email` y `phone`; la excepción admite una propiedad

**Lo que hay.** `pii-denylist.json` lleva `email`, `name`, `displayName`, `firstName`, `lastName`,
`phone`, `address`, …; `noPii` recorre el documento resuelto y excusa **una** propiedad por esquema,
la que `x-personal-datum: { property, reason }` nombra (feature 040). `role` no está en la lista y no
es un dato personal: es un cargo.

**Decisión.** `x-personal-datum` admite **un objeto o una lista de objetos** `{ property, reason }`,
cada uno con su razón; una lista vacía, una entrada sin razón o una que nombra una propiedad que el
esquema no declara, fallan. Se declara en `MerchantContact.yaml` para `name`, `email` y `phone`, con
razones que digan lo mismo que la constitución (persona identificada de la relación comercial, servida
sólo a `admin`). Fixtures: `email` en `Order` o en un evento falla; dos propiedades excusadas en el
esquema del contacto pasan; una lista con una entrada sin razón falla. `displayName` del merchant
**no es un dato personal** (es el nombre de una tienda), pero está en la lista desde la 040 porque en
cualquier otro esquema sería un nombre de persona: en `Merchant`, `MerchantCreate` y
`MerchantProfileInput` se excusa también, con la razón «nombre de la tienda o razón social, no de una
persona».

**Lo que se descartó.** Sacar `displayName` de la lista: volvería a pasar en un esquema de orden o de
evento sin que nadie lo note. Y nombrar las excepciones en el ruleset: la 040 ya encontró que el
documento resuelto copia el esquema bajo cada operación, y la marca sobre el esquema viaja con cada
copia.

## R-06 — El registro de administración no lleva valores, y ya es así

**Lo que hay.** `AuditedUseCase` escribe operador, operación, `merchantId` (del request), resultado
(`accepted` / `rejected` / `denied`), `code` cuando falla, y opcionalmente `result` (`AdminResult`:
versión de configuración, experimento, ventana) y `reason` por lectores que cada operación declara
en `served(...)`. `LoggedUseCase` registra nombre, duración y `ok` o `code`, **nunca el request**;
el logging de pedidos no escribe cuerpos ni encabezados (`request-logging.ts`).

**Decisión.** `updateMerchantProfile` se cablea sin lectores: la entrada dice quién, qué operación y
sobre qué merchant, y nada más. Ningún cambio en `AdminEntry` ni en `AdminResult`. La prueba de
privacidad de registros (`logging-privacy.test.ts`) gana un caso: una edición con contacto no deja
nombre, email ni teléfono en el registro del servidor. `MerchantProfile` **no** se incluye en
`LoggedUseCase` por construcción: el decorador no mira el request.

## R-07 — OPE-Web lee lo que `generated/contract/` le dé; la consola es suya

**Lo que hay.** `contract:sync` copia `generated/contract/` tal cual (feature 040; OPE-Web PR #3).
`conformity` exige que cada clave de `CONSTRAINTS` sea un esquema objeto del bundle y que cada cuerpo
de pedido `admin` esté; una `$ref` a un objeto anidado se emite como `{ type: 'object', ref }` y el
objeto entra con su nombre. La consola lista merchants por `merchantId` y primer origen, y la ficha
muestra lo que `Merchant` trae.

**Decisión.** `MerchantContact` es un esquema objeto nombrado: entra a `CONSTRAINTS` con su
`required` y sus largos, y `contact` en `MerchantCreate` y `MerchantProfileInput` llega como `{ type:
'object', ref: 'MerchantContact' }`. `conformity` pasa sin tocarla. Listar por nombre y mostrar la
ficha es un cambio de pantallas de OPE-Web (su feature siguiente), fuera de ésta; SC-001 se verifica
corriendo `contract:sync` y `ope-check` allá.

## R-08 — La constitución cambia de redacción, y la decisión va a un ADR

**Lo que hay.** VII (1.5.0) dice que las personas protegidas son las observadas y nombra al operador
como la persona identificada con nombre para mostrar; la viñeta dice «salvo en el del operador». La
fuente del MVP (01 §10.2) enumera lo que no se registra del visitante y del comprador; no habla del
contacto del merchant, porque el MVP no tenía backoffice (01 §13: «al tercer merchant»).

**Decisión.** VII pasa a **1.5.1** (PATCH): la viñeta dice «las personas identificadas de la relación
comercial: el operador y el contacto del merchant», y que sus datos se sirven sólo a `admin`. No
cambia a quién protege ni qué prohíbe. **ADR-045 — El merchant con identidad** registra las
decisiones de esta investigación (R-02, R-03, R-04, R-05) y que la persona de contacto es una persona
identificada; ADR-031 gana una nota fechada; `docs/dominio/merchant.md` describe la identidad.

**Lo que se descartó.** MINOR: no se agrega una sección ni se amplía la guía materialmente; se nombra
a la segunda persona de una categoría que la 1.5.0 ya abrió.

## R-09 — `displayName` obligatorio en el alta es un cambio que `contract:diff` marca

**Lo que hay.** Agregar una propiedad **obligatoria** a un cuerpo de pedido es incompatible para
`contract:diff` (un cliente viejo deja de poder crear). El contrato lleva `info.x-stability:
building` (ADR-003): un cambio incompatible entra con bump MINOR, se reporta y `release-check` avisa.
Ningún consumidor externo crea merchants hoy salvo OPE-Console, que se adapta en su feature.

**Decisión.** `displayName` obligatorio en `MerchantCreate`, versión **1.13.0**, y el reporte de
`contract:diff` se cita en el quickstart y en el ADR. Es lo que la marca `building` existe para
admitir; se decide con el dueño al acordar este plan, porque es la primera vez que la marca se usa
para un `required` nuevo y no para un rename.

**Lo que se descartó.** `displayName` opcional en el alta «para no romper»: dejaría al problema de
la spec —merchants sin nombre— abierto para siempre, con un campo que nadie completa.

## R-10 — La semilla de desarrollo entra por la misma puerta

**Lo que hay.** `OPE_MERCHANTS` / `config/dev-merchants.json` se importa con `ImportMerchantsUseCase`
sobre un almacén vacío; `MerchantSeed` lleva identificadores, credenciales y orígenes, y
`merchants-seed.schema.json` (escrito a mano, con `$ref` a los generados) lo valida.

**Decisión.** `MerchantSeed` gana los cuatro campos opcionales con las mismas reglas (pasan por
`MerchantProfile.of`); el esquema de la semilla los admite; `dev-merchants.json` trae `displayName:
"Tienda de desarrollo"` y `storeUrl: "http://localhost:3000"`, sin contacto (un contacto de prueba
es una persona inventada en un archivo versionado, y no hace falta para nada).
