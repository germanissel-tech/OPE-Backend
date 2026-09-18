# Implementation Plan: Catálogo y stock

**Branch**: `010-catalogo-y-stock` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-catalogo-y-stock/spec.md`

## Summary

Módulo `catalog` (dominio + aplicación + gateway en memoria + composición) con el aggregate
`CatalogSnapshot` (productos con variantes anidadas, disponibilidad booleana, `Money` del
shared-kernel), el servicio `ProductTruthService` con frescura por clase (catálogo 36 h,
stock/precio 15 min) y el nivel de sincronización observado (0–2, función pura de la cadencia);
operación `upsertCatalogSnapshot` (`PUT /v1/catalog`, primera del consumidor `platform`) con
`platformKey` construido, verificación genérica de `x-required-capabilities` en infraestructura
(403 `capability-missing`), y headers de credencial derivados del cableado para CORS y
redacción (cierra el PROPUESTO de ADR-020). Evidencia en [research.md](research.md); decisiones
en ADR-025.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: ninguna nueva

**Storage**: en memoria detrás de `CatalogStore` (snapshot vigente + últimas 8 recepciones por
merchant); `rehydrate` para la persistencia (017)

**Testing**: Vitest (dominio: invariantes del snapshot, `Money`, frescura y nivel con reloj
fijo; aplicación: upsert idempotente/fuera de orden, `ProductTruthService`; integración:
operación con `platformKey`, 401/403/422, aislamiento, tamaño informativo), Schemathesis (la
operación nueva), `tests/contract-rules` (sin reglas nuevas), `test:mutation`

**Target Platform**: sin cambio

**Project Type**: web-service (backend HTTP contract-first)

**Performance Goals**: SC-004 — snapshot de 5 000 productos / 50 000 variantes aceptado en
< 2 s en el perfil local (informativo); la ingesta no se toca (latencia intacta)

**Constraints**: sin I/O de red en la consulta de verdad; `bodyLimit` global 32 MiB (R-07);
sin cantidades de stock (booleano); porcentajes/tasas no aplican; contrato compatible
(operación nueva, esquema nuevo referenciado desde la raíz, 4 tipos de problema nuevos;
versión sigue 1.x)

**Scale/Scope**: 1 módulo nuevo (`catalog`) en 4 anillos + composición; 1 value object nuevo
en el shared-kernel (`Money`); 1 operación, 4 schemas, 1 esquema de seguridad activado, 5
tipos de problema (`capability-missing` + 4 invariantes); `MerchantConfig` gana
`platformKeys`; `SecurityScheme { handler, header }` en el cableado; 5 notas de glosario; ADR-025
y precisión a ADR-020

## Constitution Check

| Gate                                          | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                 |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapa del contrato (paso 0, ADR-019)           | **Sí**   | `upsertCatalogSnapshot` ya está `planned` con consumidor, tag, capacidad y fuente; pasa a `built`; `platformKey` entra a la raíz con su primera operación                                                      |
| Superficie HTTP → contrato primero            | **Sí**   | [contracts/](contracts/) diseña la operación, `CatalogSnapshot`/`CatalogProduct`/`CatalogVariant`/`CatalogSummary`, las `x-invariants` y los tipos de problema; `contract:check` verde antes del código        |
| Persistencia / API → aislamiento por merchant | **Sí**   | FR-030: snapshot de A invisible desde B; mismo `productId` en A y B son productos distintos; `platformKey` de B no toca A; suite `isolation.test.ts` ampliada                                                  |
| Plano de decisión / ledger / campos / LLM     | **Sí**   | El stock es guardia (booleano, FR-004); la verdad se lee de caché caliente (FR-007); sin LLM (la normalización de atributos queda fuera)                                                                       |
| `x-invariants`                                | **Sí**   | `catalog-duplicate-product-id`, `catalog-duplicate-variant-id`, `catalog-captured-in-future` (schema), `catalog-out-of-order` (operación); cada una con tipo propio, ejemplo 422 y prueba `[invariant:<slug>]` |
| Sustantivo nuevo en el contrato (glosario)    | **Sí**   | `catalogo`, `disponibilidad`, `precio`, `frescura`, `perfil-de-datos` en `docs/dominio/` antes del contrato; `producto` y `variante` ganan uso en catálogo                                                     |
| Toca `src/` → dirección de dependencias       | **Sí**   | `catalog: [shared-kernel]` en el mapa de contextos y `catalogModule` en `MODULES`; sin reglas nuevas de arquitectura; `npm run arch` en 0                                                                      |
| Privacidad (V, VII)                           | **Sí**   | El snapshot no tiene datos personales (productos y precios); la clave de plataforma se redacta por el cableado (FR-023, FR-031); `merchantId` nunca en request                                                 |
| Capacidades por consumidor (ADR-020)          | **Sí**   | `x-required-capabilities: [catalog:write]` en la operación; verificación en runtime genérica (R-02) con réplica de capacidades verificada contra el mapa                                                       |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/010-catalogo-y-stock/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── paths/catalog.yaml                      # PUT /v1/catalog: upsertCatalogSnapshot
│   ├── components/schemas/{CatalogSnapshot,CatalogProduct,CatalogVariant,CatalogSummary}.yaml
│   └── problem-types.additions.yaml            # capability-missing + 4 invariantes
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/shared-kernel/money.ts               class Money { of(amount, currency) → Result; amount; currency; equals }; errors: InvalidMoney (module shared-kernel)
├── domain/ingestion/event.ts                   PageContext.price: Money (reexportado; el controller construye por Money.of… ver diseño)
├── domain/catalog/{ids.ts, errors.ts, catalog-snapshot.ts, index.ts}
│     ProductId, VariantId; CatalogDuplicateProductId, CatalogDuplicateVariantId, CatalogCapturedInFuture, CatalogOutOfOrder
│     class CatalogSnapshot { of; rehydrate; product(id); variant(productId, variantId); counts(); capturedAt; receivedAt }
│     interface Product { productId, name, attributes: readonly { name, value }[], variants }; Variant { variantId, size, color, available, price: Money }
├── application/catalog/ports/catalog-store.ts  CatalogStore { current(merchantId), replace(merchantId, snapshot), receipts(merchantId) } (Promise)
├── application/catalog/policies/{freshness.ts, sync-level.ts}
├── application/catalog/services/product-truth.service.ts    ProductTruthService / DefaultProductTruthService
├── application/catalog/use-cases/upsert-catalog-snapshot.use-case.ts   UpsertCatalogSnapshotUseCase (deps: clock, store, logger)
├── application/merchant/services/platform-key.service.ts   PlatformKeyResolver / DefaultPlatformKeyResolver
├── domain/merchant/merchant.ts                 + platformKeys: readonly string[] (0..2); ownsPlatformKey(key)
├── interface-adapters/gateways/catalog/memory-catalog-store.ts
├── interface-adapters/http/security/{platform-key.ts, capabilities.ts, ingest-key.ts}
│     PLATFORM_KEY_HEADER; SecurityOutcome.capabilities; CONSUMER_CAPABILITIES (réplica del mapa)
├── interface-adapters/http/controllers/catalog/upsert-catalog-snapshot.ts
├── interface-adapters/http/typed.ts            SecurityOutcome { principal; capabilities; log? }; SecurityScheme { handler; header }
├── infrastructure/http/{build-server.ts, cors.ts, request-logging.ts}   capabilities check; allowedHeaders y redacción desde los esquemas; bodyLimit
├── composition/{config.ts, wiring.ts, bootstrap.ts, modules/catalog.ts, modules/merchant.ts, modules/index.ts, ports.ts, profiles/local.ts}
.dependency-cruiser.cjs                         CONTEXT_MAP: catalog
contracts/                                      openapi.yaml (+ path, + platformKey en la raíz), paths/catalog.yaml, components/schemas/Catalog*.yaml, problem-types.yaml, api-map.yaml (built)
docs/adr/025-catalogo-y-verdad-de-producto.md; ADR-020 (precisión: platformKey decidido, capacidades en runtime, PROPUESTO cerrado)
docs/dominio/{catalogo,disponibilidad,precio,frescura,perfil-de-datos}.md; producto.md, variante.md
tests/
├── unit/domain/shared-kernel/money.test.ts
├── unit/domain/catalog/catalog-snapshot.test.ts          [invariant:*] + rehydrate + lookups
├── unit/application/catalog/{freshness,sync-level,product-truth.service,upsert-catalog-snapshot.use-case}.test.ts
├── unit/application/merchant/platform-key.service.test.ts
├── unit/http/capabilities.test.ts                        réplica contra contracts/api-map.yaml
├── integration/catalog.test.ts                           upsert 200/401/403/422, resumen, idempotencia, fuera de orden, verdad tras upsert
├── integration/catalog-size.test.ts                      informativo (SC-004)
├── integration/isolation.test.ts (+ catálogo y claves de plataforma)
├── integration/security-capabilities.test.ts             clave de ingesta en /v1/catalog → 401; plataforma en /v1/events → 401; capability-missing → 403
└── unit/composition/config.test.ts (+ platformKeys)
```

**Structure Decision**: un módulo más con la forma de la 008/009 (aggregate con `of`/`rehydrate`,
errores en `errors.ts`, caso de uso + servicio + puertos + políticas, gateway en memoria,
`modules/catalog.ts` con su slice y bindings). El segundo esquema de seguridad sigue el patrón
del primero (servicio de resolución en `merchant`, handler en `http/security`).

### Comandos npm (cambios)

Ninguno nuevo.

## Diseño de los puntos no triviales

- **`Money` al shared-kernel**: `Money.of(amount, currency)` valida el patrón del contrato
  (`^\d+(\.\d{1,2})?$`, `^[A-Z]{3}$`) → `Result<Money, InvalidMoney>`; `rehydrate` para
  datos registrados. `PageContext.price` de ingesta pasa a `Money`; el controller de ingesta lo
  construye con `Money.rehydrate` (el contrato ya validó el patrón: mismo criterio que los ids).
  `InvalidMoney` es el primer error del módulo `shared-kernel` (500 en el catálogo, nunca por
  HTTP: el schema lo impide).
- **Snapshot y orden**: `UpsertCatalogSnapshotUseCase.execute({ merchantId, capturedAt,
products })` → `now = clock.now()` → `CatalogSnapshot.of({..., receivedAt: now})` → si el
  vigente tiene `capturedAt` mayor ⇒ `fail(new CatalogOutOfOrder(...))`; si igual o menor ⇒
  `store.replace` (idempotente por reemplazo) → `ok({ products, variants, receivedAt,
observedSyncLevel })`. Respuesta HTTP: siempre `200` con `CatalogSummary` (PUT idempotente).
- **Verdad**: `DefaultProductTruthService.lookup(merchantId, productId, variantId)`:
  `store.current` → ausente ⇒ `unknown/absent`; `snapshot.ageAt(now) > catalogMs` ⇒
  `unknown/stale`; producto/variante inexistentes ⇒ `unknown/unknown-product|variant`; si no
  `known` con `freshness.stockAndPrice = age ≤ stockAndPriceMs ? fresh : stale`.
- **Nivel observado**: `observedSyncLevel(receipts, now)` (R-06) pura; el store guarda hasta 8
  `receivedAt`. Se expone en el resumen y en `ProductTruthService.syncLevel(merchantId)`.
- **platformKey**: `MerchantConfig.platformKeys` opcional (0–2 claves, no vacías, distintas de
  las de ingesta: `ConfigError` si se repiten); `Merchant.ownsPlatformKey(key)`;
  `DefaultPlatformKeyResolver.resolve(key)` → `Result<Merchant, Unauthorized>` (sin origen: no
  hay navegador); `MerchantDirectory.findByPlatformKey`. Handler `platformKey` en
  `http/security/platform-key.ts` con `capabilities: CONSUMER_CAPABILITIES.platform`; el de
  ingesta declara `CONSUMER_CAPABILITIES.sdk`.
- **Capacidades en runtime** (R-02): `registerSecurity` lee
  `c.operation["x-required-capabilities"]` (unknown → array de strings), ejecuta el handler y,
  si `required ⊄ outcome.capabilities`, lanza `SecurityError("capability-missing")` → 403. Se
  prueba con una operación de fixture cuyo consumidor no tiene la capacidad (contrato de
  prueba `tests/integration/fixtures/`), porque en el contrato real `ope-required-capabilities`
  impide el desajuste por construcción.
- **Headers desde el cableado** (R-03): `ModuleWiring.security: Record<string, SecurityScheme>`;
  `Wired.credentialHeaders: string[]`; `buildServer({ security, credentialHeaders })`;
  `registerCors(app, policy, allowedHeaders = ["content-type", ...credentialHeaders])`;
  `privateLogger(base, credentialHeaders)` aplicado en `createApp`; `pinoLogger()` conserva los
  serializers pero deja la redacción a `build-server`. Las constantes `INGEST_KEY_HEADER` /
  `PLATFORM_KEY_HEADER` quedan en sus handlers y sólo el cableado las conoce.
- **`bodyLimit`**: `Fastify({ bodyLimit: 32 MiB })` en `createApp` (documentado en el contrato).
- **Orden de commits**: (1) glosario + contrato + mapa `built` + réplica del catálogo de
  problemas (`contract:check` verde; el servidor se niega a arrancar hasta que exista el
  módulo → el mismo commit trae un handler mínimo? No: `bootstrap` exige que todo módulo sirva
  las operaciones del contrato, así que el contrato y el módulo van en el mismo commit;
  orden: (1) `Money` + `platformKey` + capacidades + headers desde el cableado (sin operación
  nueva; suite verde); (2) glosario + contrato + módulo `catalog` completo + composición +
  pruebas; (3) tamaño informativo, ADR-025 aceptada, ADR-020 precisión, CLAUDE.md, quickstart.

## Complexity Tracking

| Elemento                                        | Por qué                                                                                            | Alternativa rechazada                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Réplica de capacidades por consumidor en código | el runtime no carga `api-map.yaml`; la prueba de réplica la mantiene igual que los demás catálogos | cargar el mapa en runtime: un archivo de gobernanza en producción; scopes en `security`: ADR-020 los excluye |
| Frescura por clase (dos presupuestos)           | 01 §8 exige regímenes distintos para catálogo y stock/precio                                       | un presupuesto único: o bloquea calce con volcado diario o da precio viejo por fresco                        |
| `bodyLimit` global 32 MiB                       | openapi-backend rutea con un handler único; no hay límite por operación                            | límite por defecto (1 MiB): un catálogo de piloto no entra                                                   |

## Re-evaluación del Constitution Check (post-Phase 1)

Mapa → contrato → glosario → invariantes con tipo propio; aislamiento probado; sin red en la
consulta; privacidad de la clave por el cableado; capacidades verificadas. **PASA.**
