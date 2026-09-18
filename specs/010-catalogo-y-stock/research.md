# Research — Feature 010: catálogo y stock

**Fecha**: 2026-09-18 · **Estado**: completo. Decisiones transversales → ADR-025; precisión a
ADR-020 (platformKey y capacidades).

## R-01 Segundo esquema de seguridad en el contrato (verificado)

- El contrato ya declara `security` **por operación** (`security: [{ ingestKey: [] }]` en
  `events.yaml` y `exposures.yaml`; `security: []` en `health.yaml`), y la raíz sólo lista los
  `securitySchemes` por nombre (ADR-014). Agregar `platformKey` es: referenciarlo en la raíz
  (`components.securitySchemes.platformKey: $ref`) y declararlo en la operación nueva. La regla
  `ope-consumer-security` exige exactamente el esquema del consumidor del tag (`outcomes` →
  `platform` → `platformKey`), y `ope-required-capabilities` limita las capacidades al
  vocabulario del consumidor: ambas ya existen (006), sólo empiezan a ejercitarse.
- **Decisión**: `platformKey` como está propuesto en `components/securitySchemes/platformKey.yaml`
  (`apiKey` en header `X-OPE-Platform-Key`; una o dos claves por merchant); sin HMAC en esta
  feature (queda PROPUESTO como estaba, para el primer adaptador real).

## R-02 Verificación de capacidades en runtime

- openapi-backend entrega a cada security handler el `Context` con `operation` (el objeto
  completo de la operación, extensiones `x-` incluidas), y ejecuta los handlers de los esquemas
  que la operación declara **antes** de validar el cuerpo. Hoy `registerSecurity` sólo pasa
  `headers` al handler.
- **Decisión**: verificación **genérica en infraestructura**, no por handler: `SecurityOutcome`
  gana `capabilities: readonly string[]` (las del consumidor de la credencial) y
  `registerSecurity` compara `operation["x-required-capabilities"]` con ellas; si falta alguna,
  `SecurityError("capability-missing")` → 403 con tipo de problema nuevo `capability-missing`.
  Las capacidades por consumidor viven en `interface-adapters/http/security/capabilities.ts`
  (réplica de `consumers.<x>.capabilities` del mapa, verificada por prueba, como las demás
  réplicas). El handler de ingesta otorga las del `sdk`; el de plataforma, las de `platform`.
- Alternativa rechazada: scopes en `security: [{ platformKey: [catalog:write] }]`: ADR-020 fijó
  `x-required-capabilities` como vocabulario propio y la regla exige scopes vacíos.

## R-03 Headers de credencial derivados del cableado (cierra el PROPUESTO de ADR-020)

- Hoy CORS (`allowedHeaders`) y la redacción del log importan `INGEST_KEY_HEADER` desde el
  security handler. Con dos esquemas: `ModuleWiring.security` pasa de
  `Record<scheme, SecurityHandler>` a `Record<scheme, SecurityScheme>` con
  `{ handler, header }`; `wireModules` recoge `credentialHeaders`; `buildServer` los recibe y
  (a) `registerCors(app, policy, allowedHeaders)` y (b) crea el logger de Fastify con
  `privateLogger(base, credentialHeaders)` — la redacción sale de `pinoLogger()` (gateway) y
  pasa a `build-server`, que es quien conoce los esquemas cableados. El `Logger` de la
  aplicación nunca recibe headers (sus `LogFields` son seguros por contrato), así que nada se
  pierde al mover la redacción.
- CORS sólo aplica al consumidor `sdk` (navegador); el header de plataforma no necesita
  entrar en `allowedHeaders`, pero derivarlos todos del cableado es más simple y no abre nada
  (un preflight con `X-OPE-Platform-Key` desde un navegador sigue sin credencial válida de
  ingesta).

## R-04 Forma del snapshot y del módulo `catalog`

- **Aggregate `CatalogSnapshot`** (`domain/catalog/`): `of({ merchantId, capturedAt,
receivedAt, products })` → `Result<CatalogSnapshot, CatalogError>`; invariantes (en orden):
  ids de producto únicos, ids de variante únicos (en todo el snapshot), toda variante
  referencia un producto del snapshot (por construcción: las variantes vienen anidadas en su
  producto, así que la invariante es "sin huérfanas" sólo si el formato lo permitiera; con
  anidamiento la regla se vuelve estructural y **no** hace falta un tipo de problema),
  `capturedAt ≤ receivedAt + 5 min`. `rehydrate`. Consultas: `variant(productId, variantId)`,
  `product(productId)`, `counts()`, `ageAt(now)`.
- **Decisión sobre el formato**: variantes **anidadas** dentro de cada producto
  (`products[].variants[]`): el adaptador genérico las tiene así, elimina la invariante de
  huérfanas y hace el schema más chico. Invariantes que quedan para `x-invariants`:
  `catalog-duplicate-product-id`, `catalog-duplicate-variant-id`, `catalog-captured-in-future`
  y, del caso de uso, `catalog-out-of-order` (un snapshot con `capturedAt` anterior al
  vigente). Todas 422.
- `Price`: `Money` ya existe en el contrato y en `domain/ingestion` (`PageContext.price`). Pasa
  al `shared-kernel` del dominio como value object `Money.of(amount, currency)` → `Result` (lo
  comparten `ingestion` y `catalog`, que no dependen entre sí); `ingestion` lo reexporta.
- Ids: `ProductId`, `VariantId` en `domain/catalog/ids.ts` (dueño: catálogo). `PageContext.productId`
  de ingesta sigue siendo `string` (lo resuelve el SDK); el plano de decisión lo convertirá.
- **Mapa de contextos**: `catalog: [shared-kernel]`. Ningún módulo actual importa `catalog`.

## R-05 Verdad de producto y frescura por clase

- **`ProductTruthService`** (`application/catalog/services/`): `lookup(merchantId, productId,
variantId, now)` → `ProductTruth`: `{ kind: "known", variant, product, freshness: { catalog:
"fresh" | "stale", stockAndPrice: "fresh" | "stale" } }` o `{ kind: "unknown", reason:
"absent" | "stale" | "unknown-product" | "unknown-variant" }`. Es un servicio (lo consumirá el
  caso de uso de decisión de la 011), no un caso de uso.
- **Presupuestos** en `application/catalog/policies/freshness.ts`: `FRESHNESS_BUDGET = {
catalogMs: hours(36), stockAndPriceMs: minutes(15) }`, publicados en la descripción de la
  operación. Edad = `now − capturedAt` (la foto, no la recepción). Más viejo que `catalogMs` ⇒
  `unknown/stale` (nada es verdad); entre `stockAndPriceMs` y `catalogMs` ⇒ variante conocida
  con `stockAndPrice: "stale"`.
- Por qué dos clases y no una: 01 §8 exige frescura diaria para catálogo/variantes y cercana a
  tiempo real para stock/precio; con un solo presupuesto un volcado diario dejaría sin calce
  ni atributos (demasiado estricto) o daría precio viejo por fresco (falso).

## R-06 Nivel de sincronización observado

- `application/catalog/policies/sync-level.ts`: `observedSyncLevel(receipts: readonly Date[],
now)` con los últimos 8 `receivedAt` del merchant: 0 sin recepciones o vigente ≥ 36 h; 1 si
  el vigente < 36 h; 2 si además hay ≥ 3 recepciones con mediana de intervalo ≤ 15 min y el
  vigente < 1 h; 3 nunca (requiere notificación por cambio). Se recalcula en cada consulta
  (degrada solo, sin temporizadores). Es una función pura de aplicación; el port
  `CatalogStore` guarda snapshot vigente + recepciones por merchant.
- Alternativa rechazada: guardar el nivel como estado: no degradaría solo.

## R-07 Rendimiento del snapshot (SC-004)

- Un snapshot de 5 000 productos × 10 variantes es ~50 000 variantes; Ajv valida el cuerpo
  (lineal), `CatalogSnapshot.of` recorre dos veces (unicidad, tolerancia) y construye índices
  (`Map` por producto y por variante). En memoria, del orden de cientos de ms. Prueba
  informativa en `tests/integration/catalog-size.test.ts` (reporta el tiempo, falla > 2 s).
  `bodyLimit` de Fastify: el default es 1 MiB; un snapshot así ronda 5–10 MB → `buildServer`
  fija `bodyLimit` en 32 MiB **sólo** para esta operación si Fastify lo permite por ruta; como
  openapi-backend rutea por un handler único, el límite es global: 32 MiB, documentado en el
  contrato (`description` de la operación). Verificar en implementación.
