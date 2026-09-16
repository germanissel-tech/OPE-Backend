# Research — Feature 004: protocolo del SDK e ingesta

**Fecha**: 2026-09-16 · **Estado**: completo. Decisiones transversales → ADR-013 (anillos,
módulos y composición) y ADR-014 (protocolo del SDK: credencial pública, orígenes, decisión
inline) durante la implementación.

## R-01 Anillos, módulos y mapa de contextos → dependency-cruiser (verificado)

- **Decisión (DECIDIDO → ADR-013)**: dos familias de reglas conviven en `.dependency-cruiser.cjs`:
  - **Anillos**: `domain` no importa nada de afuera; `application` no importa
    `interface-adapters|infrastructure|composition|main`; `interface-adapters` no importa
    `infrastructure|composition|main`; `infrastructure` no importa `composition|main`; nadie
    importa `main.ts`. `composition` importa todo; sólo `main.ts` y las pruebas lo importan.
  - **Módulos** (dentro de `domain/` y `application/`): `modules-only-via-index` — un módulo
    importa de otro sólo `<otro>/index.ts` (con `$2` capturando el módulo origen en
    `pathNot`); y una regla `context-map:<módulo>` generada por módulo desde un objeto
    `CONTEXT_MAP` (módulo → módulos permitidos), que es el mapa de contextos como código.
- **Verificado** (dependency-cruiser 18.3.1, árbol de prueba con 19 módulos): las seis
  violaciones deliberadas se detectan con el nombre de la regla (`domain-is-pure`,
  `application-inward`, `adapters-inward` ×2, `context-map:ingestion`,
  `context-map:shared-kernel`, `modules-only-via-index`); el import legítimo vía `index.ts` no
  se marca; el back-reference `$2` funciona en `pathNot`.
- **Mapa de contextos inicial** (PROPUESTO en la spec; acá DECIDIDO para esta feature):

  | Módulo          | Depende de                                                                           |
  | --------------- | ------------------------------------------------------------------------------------ |
  | `shared-kernel` | —                                                                                    |
  | `system`        | `shared-kernel`                                                                      |
  | `merchant`      | `shared-kernel`                                                                      |
  | `ingestion`     | `shared-kernel`, `merchant`                                                          |
  | `ledger`        | `shared-kernel`, `ingestion` (una decisión nace de un lote de eventos de una sesión) |

  Agregar un módulo = agregar una entrada; un import fuera del mapa falla el build.

- **Módulos también en `interface-adapters`**: `http/controllers/<módulo>/` y
  `gateways/<módulo>/`; ahí no se aplica el mapa (un gateway implementa el puerto de su módulo
  y nada más) pero sí "un gateway no importa otro gateway" y "controllers no importan gateways".

## R-02 Composición: contenedor tipado y perfiles (DI manual)

- **Decisión (DECIDIDO → ADR-013)**: `src/composition/ports.ts` declara `interface Ports`
  con un campo por puerto (`clock`, `ids`, `merchants`, `eventDedup`, `decisions`,
  `exposures`); `src/composition/profiles/memory.ts` exporta `memoryPorts(config): Ports`;
  `src/composition/bootstrap.ts` exporta `bootstrap(config, overrides?: { ports?: Partial<Ports>; handlers?: Handlers })`
  que devuelve `{ app, ports, close }`. Los casos de uso se instancian en
  `composition/use-cases.ts` recibiendo puertos por parámetro; los controllers reciben casos
  de uso. `main.ts` queda en lectura de configuración, `bootstrap`, `listen`, señales.
- **Por qué no un contenedor**: inversify/tsyringe requieren decoradores y `reflect-metadata`
  (incompatibles con `erasableSyntaxOnly` y con la pureza del dominio); awilix resuelve por
  nombre en runtime. Con un `interface Ports`, el compilador exige que cada perfil provea cada
  puerto (FR-003): un perfil incompleto no compila.
- **Ciclo de vida**: cada gateway puede exponer `close()`; `bootstrap` los cierra en orden
  inverso al arranque. En memoria no hay nada que cerrar; el contrato queda para la 006.

## R-03 Credencial de ingesta → `apiKey` en header, resuelta por security handler (verificado)

- **Decisión (DECIDIDO → ADR-014)**: `securitySchemes.ingestKey: { type: apiKey, in: header,
name: X-OPE-Ingest-Key }`; `ingestEvents` y `confirmExposure` declaran
  `security: [{ ingestKey: [] }]` y `x-required-capabilities: [events:write]`.
  openapi-backend `registerSecurityHandler("ingestKey", …)` resuelve la clave con el puerto
  `MerchantDirectory` y devuelve `{ merchantId, origins }`, disponible en el handler como
  `c.security.ingestKey`; si devuelve `false`, openapi-backend invoca `unauthorizedHandler`
  → `401 urn:ope:problem:unauthorized`.
- **Verificado** (openapi-backend 5.20.3): clave válida → handler recibe `{ merchantId }`;
  inválida o ausente → `unauthorizedHandler`; **la seguridad se evalúa antes que la
  validación del body** (clave inválida + body inválido → 401, no 400: un cliente no
  autenticado no puede sondear el esquema); una operación con `security: []` no pasa por el
  handler (`authorized: false`, sin error).
- **La clave es pública** (viaja en el tag): identifica al merchant. No se guarda en texto
  plano en logs ni en respuestas; el gateway en memoria la compara en constante (`timingSafeEqual`
  sobre hash) para no cambiar de hábito cuando llegue Postgres. Dos claves activas por
  merchant (rotación): el directorio devuelve el merchant si cualquiera coincide y no venció.

## R-04 Orígenes por merchant → `@fastify/cors` + verificación del par en el request (verificado)

- **Problema**: el preflight (`OPTIONS`) del navegador **no** trae la credencial; sólo
  `Origin` y los headers que va a usar. No se puede saber en el preflight de qué merchant es.
- **Decisión (DECIDIDO → ADR-014)**: dos capas.
  1. Preflight: `@fastify/cors@11` con `origin: (origin, cb)` que consulta al directorio si el
     origen está registrado **para algún merchant** (`merchants.isRegisteredOrigin(origin)`);
     si no, no autoriza. Métodos `GET, POST`; headers `content-type, x-ope-ingest-key`;
     `maxAge` 600.
  2. Request real: el security handler, además de resolver la clave, comprueba que si viene
     `Origin`, esté entre los orígenes **de ese merchant**; si no → `403
urn:ope:problem:origin-not-allowed`. Sin `Origin` (servidor a servidor, pruebas) pasa.
- **Verificado** (`@fastify/cors` 11.3.0 con `inject`): preflight desde origen registrado →
  204 con `access-control-allow-origin` y `allow-headers`; desde no registrado → sin headers
  CORS (el navegador bloquea); request real con `Origin` registrado → 202 y header; sin
  `Origin` → 202 sin header.
- **Conflicto de rutas a resolver en implementación**: el plugin registra su propia ruta
  `OPTIONS`; la ruta comodín del servidor debe **excluir `OPTIONS`** de sus métodos (hoy lo
  incluye). El 405 de openapi-backend para `OPTIONS` deja de ser alcanzable: correcto.

## R-05 Esquema de evento: `oneOf` + `discriminator` (verificado, con dos restricciones)

- **Decisión (DECIDIDO)**: `Event` es `oneOf` de un esquema por tipo, con
  `discriminator: { propertyName: type, mapping: { <valor de cable>: <schema> } }` **explícito
  en el contrato**, y cada esquema declara `type: { enum: [<valor>] }`. El adaptador HTTP
  **quita `discriminator.mapping`** del documento en memoria antes de dárselo a openapi-backend.
- **Restricción 1 — sin `const`**: openapi-backend en `strict: true` valida el documento
  contra el meta-esquema de OpenAPI **3.0** (`openapi-schema-validator`), donde `const` no
  existe: falla el arranque ("must NOT have additional properties: const"). Se usa
  `enum: [valor]`, equivalente y válido en 3.0 y 3.1. Regla para todo el contrato: **sólo el
  subconjunto de JSON Schema que 3.0 admite** (sin `const`, sin `type: [..., "null"]` —
  campos opcionales en vez de nulos).
- **Restricción 2 — `mapping`, conflicto entre herramientas**: Ajv (`ajvOpts.discriminator:
true`) rechaza `discriminator.mapping` al compilar ("mapping is not supported"); pero
  openapi-typescript 7, cuando **no** hay `mapping`, infiere el valor del discriminador a partir
  del **nombre del esquema** y **reemplaza** el `enum` de cada rama: los tipos generados dirían
  `type: "ProductViewed"` cuando el cable lleva `product_viewed`. Verificado con el diseño de
  esta feature bundleado: sin `mapping` → `type: "ProductViewed"`; con `mapping` →
  `type: "product_viewed"`. Alternativas descartadas: (a) quitar el `discriminator` y dejar
  `oneOf` pelado — tipos correctos pero errores de validación ruidosos (una lista por rama) y
  peor documentación; (b) transformar el bundle antes de generar tipos — mueve la corrección a
  un script y deja el contrato semánticamente incompleto. La salida elegida deja el contrato
  correcto y explícito (Redocly y Spectral en verde; Redocly reescribe los refs del `mapping` a
  `#/components/schemas/<Nombre>` en el bundle) y confina la limitación de Ajv a una función
  del adaptador (`stripDiscriminatorMappings`, con prueba unitaria: el documento cargado no
  tiene ningún `mapping`, y `init()` falla si lo tiene). Registrar en ADR-014.
- **Verificado** (Ajv 8 vía openapi-backend, `discriminator: true`, `ajv-formats`, documento
  sin `mapping`): campo extra → un solo error `/requestBody/events/0 must NOT have additional
properties` (sin `discriminator: true`, un error por cada rama); tipo desconocido →
  `value of tag "type" must be in oneOf`; campo propio faltante de la rama → `must have
required property 'dwellMs'`; `occurredAt` inválido → `must match format "date-time"`. Los
  punteros son exactos: cumple US2.3 y SC-004.
- openapi-typescript genera la unión discriminada; el controller estrecha por `type` y el
  `switch` exhaustivo (regla de lint de la 003) obliga a cubrir todos los tipos.
- **Otra trampa de YAML detectada**: una `description` en escalar plano con `: ` adentro
  ("Tolerancia aceptada: hasta…") se parsea como mapping y Redocly reporta un `$ref` no
  resuelto varias líneas después. Usar `>-` o comillas cuando la descripción lleva dos puntos.

## R-06 Forma del contrato (diseño en `specs/004/contracts/`)

- **Tipos de evento** (03 §4.1, nombres del glosario en inglés): `product_viewed`,
  `listing_viewed`, `size_selector_interacted`, `variant_selected`, `photo_interacted`
  (`zoom` | `navigate`), `block_dwelled` (`block` ∈ description, size_guide, reviews,
  policies, price, gallery, cta; `dwellMs`), `cta_approached` (`hover` | `near`),
  `product_returned_to` (`previousProductId`; la comparación A→B→A se observa, sin mensajes
  propios), `added_to_cart`, `removed_from_cart`, `checkout_advanced` (`cart`,
  `checkout_started`, `shipping`, `payment`, `review`), `exit_signaled` (`inactivity`,
  `tab_hidden`, `back_navigation`, `exit_intent` — exactamente cuatro).
- **Comunes**: `type`, `eventId`, `sessionId`, `visitorId` (`^[A-Za-z0-9_-]{8,64}$`, los
  genera el SDK), `occurredAt` (date-time; tolerancia: 5 min a futuro, 24 h a pasado,
  declarada en la descripción y verificada como invariante), `page` (`PageContext`:
  `pageType` ∈ product, listing, cart, checkout, other; `productId?`, `variantId?`,
  `price?` `{ amount: string decimal, currency: ISO 4217 }`, `availability?` ∈ in_stock,
  out_of_stock, unknown), `device` ∈ desktop, mobile, tablet. Nada más (01 §10.2).
- **Importes como string decimal** (`^\d+(\.\d{1,2})?$`): evita el redondeo binario del
  `number`; misma convención que se usará en outcomes (montos verificados). Registrar en
  ADR-014.
- **Lote**: `{ events: Event[1..50] }` de **una** sesión (invariante `session-visitor-mismatch`
  si un evento trae otro visitante). Respuesta `202` `IngestResult`: `{ accepted, duplicates,
results: [{ eventId, status: accepted | duplicate }], decision }`.
- **Decisión**: `{ decisionId, sessionId, outcome: "NO_OP", reason, intervention? }`.
  `reason` es **string** con patrón `^[a-z][a-z0-9-]*$` y catálogo en
  `contracts/no-op-reasons.yaml` (documentado en la descripción), **no enum**: agregar un
  motivo no debe ser cambio incompatible (ADR-003 trata enum de respuesta ampliado como
  incompatible). Motivos iniciales: `decision-plane-unavailable`, `page-context-incomplete`.
  `intervention` (`{ messageVersionId, anchor }`) queda declarado con `PROPUESTO` en la
  descripción: es el lugar reservado que el equipo del SDK tiene que validar; el texto del
  mensaje y su forma de render llegan con el plano de decisión (010+), no acá.
- **Exposición**: `POST /v1/exposures` `{ decisionId, sessionId, visitorId, exposedAt, anchor }`
  → `201 { decisionId, status: recorded }` o `200 { status: already-recorded }`. Invariantes
  (422): `exposure-decision-unknown` (inexistente **o de otro merchant**: misma respuesta, no
  revela), `exposure-of-no-op`.
- **Tipos de problema nuevos** (`contracts/problem-types.yaml`): `origin-not-allowed` (403),
  `session-visitor-mismatch` (422), `event-timestamp-out-of-range` (422),
  `exposure-decision-unknown` (422), `exposure-of-no-op` (422). El `422` de cada operación
  nombra sus invariantes en ejemplos (regla `ope-no-generic-422`).
- **Excepción a "sin `components` en la raíz"**: `security: [{ ingestKey: [] }]` referencia
  el esquema **por nombre**, no por `$ref`, así que el bundle no lo promueve solo y Redocly
  (`security-defined`) exige que exista. La raíz declara **únicamente**
  `components.securitySchemes.ingestKey: { $ref: ./components/securitySchemes/ingestKey.yaml }`;
  todo lo demás sigue la regla. Verificado: Redocly y Spectral en verde con esa forma.
  Actualizar la nota de `CLAUDE.md`.
- **Deduplicación**: no es un error; `results[].status = duplicate` y se prueba como
  comportamiento (idempotencia), no como `x-invariants`. Ventana del perfil en memoria: 24 h
  o 100.000 `eventId` por merchant, lo que ocurra antes (declarada en la descripción de la
  operación).

## R-07 Privacidad en logs

- Fastify loguea `req.remoteAddress` por defecto en `incoming request`: **viola 01 §10.2**
  (IP no persistida ni logueada). Decisión: serializer de request propio en la
  infraestructura HTTP que loguea `method`, `url`, `merchantId` (cuando se resolvió) y
  `reqId`, nunca `remoteAddress` ni headers; prueba que captura el stream de log y afirma que
  no aparece la IP ni la clave de ingesta. Las claves no se loguean nunca.

## R-08 Latencia (SC-003)

- Prueba `tests/integration/ingest-latency.test.ts`: 200 lotes de 20 eventos vía `inject`,
  p50/p95 con `performance.now()`, impresos en la salida; aserción p95 < 50 ms en el perfil
  de memoria. Si CI resultara ruidoso, se relaja la aserción y se conserva el reporte — la
  spec lo fija como medición, no como SLA.

## R-09 Glosario (verificado contra el bundle del diseño)

`check:glossary` parte los nombres de schema en palabras (camel case) y exige que cada una
resuelva a una nota o a `_tecnicos.json`, salvo que el nombre entero resuelva. Corrido contra el
bundle del diseño da 27 huérfanos. Decisión:

- **Notas nuevas** (sustantivos del dominio; inglés del contrato → castellano): `exposure`
  (exposición), `ingest` (ingesta; el módulo se llama `ingestion`, la nota cubre ambos),
  `ledger`, `no-op`, `anchor` (anclaje), `intervention` (intervención), `page` (página),
  `product` (producto), `variant` (variante), `listing` (listado), `cart` (carrito),
  `checkout`, `device` (dispositivo), `money` (importe), `origin` (origen), `ingest key`
  (credencial de ingesta). Las existentes `event`, `session`, `visitor`, `decision` pasan a
  uso real (se quita `uso: pendiente`).
- **Una nota por tipo de evento**, con `en` igual al valor de cable (`product_viewed`, …, doce
  en total) bajo `docs/dominio/eventos/`: son las señales de 03 §4.1 y el glosario es el lugar
  donde se explica qué observa cada una. Para que `ProductViewed` resuelva a `product_viewed`,
  `resolveCompound` prueba además la unión con `_` (cambio de una línea en
  `scripts/check-glossary.mjs`, con caso en `tests/governance/`).
- **Vocabulario técnico** (a `_tecnicos.json`): `id`, `result`, `batch`, `context`, `class`,
  `confirmation`, `to`, `from`. Son envoltorios y conectores, no conceptos.
- Fuente de las notas: 01 §3.1 (`PageContext`, identidades), §5 (cadena de evidencia), §6,
  §10.2; 03 §4.1 (señales).
