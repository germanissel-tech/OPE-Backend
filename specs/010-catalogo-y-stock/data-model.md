# Data model — Feature 010

En memoria detrás de `CatalogStore`; aggregates con `of`/`rehydrate` (ADR-024).

## Money (`domain/shared-kernel/money.ts`) — value object

| Miembro                               | Regla                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Money.of(amount, currency)`          | `Result<Money, InvalidMoney>`: `amount` `^\d+(\.\d{1,2})?$` (texto decimal, sin redondeo binario, ADR-014), `currency` `^[A-Z]{3}$` (ISO 4217) |
| `rehydrate({ amount, currency })`     | sin reglas (el contrato ya validó)                                                                                                             |
| `amount`, `currency`, `equals(other)` | por valor                                                                                                                                      |

Reemplaza a la interfaz `Money` de `domain/ingestion` (`PageContext.price`), que la reexporta.

## CatalogSnapshot (`domain/catalog/catalog-snapshot.ts`) — aggregate

| Miembro                                                | Regla                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `of({ merchantId, capturedAt, receivedAt, products })` | `Result<CatalogSnapshot, CatalogError>`: ids de producto únicos (`CatalogDuplicateProductId(productId)`), ids de variante únicos en todo el snapshot (`CatalogDuplicateVariantId(variantId)`), `capturedAt ≤ receivedAt + 5 min` (`CatalogCapturedInFuture`); orden de comprobación: futuro, productos, variantes |
| `rehydrate(record)`                                    | sin reglas; reconstruye índices                                                                                                                                                                                                                                                                                   |
| `merchantId`, `capturedAt`, `receivedAt`               | hechos                                                                                                                                                                                                                                                                                                            |
| `product(productId)`                                   | `Product \| undefined`                                                                                                                                                                                                                                                                                            |
| `variant(productId, variantId)`                        | `{ product, variant } \| undefined` (la variante debe pertenecer a ese producto)                                                                                                                                                                                                                                  |
| `counts()`                                             | `{ products, variants }`                                                                                                                                                                                                                                                                                          |
| `ageAt(now)`                                           | `now − capturedAt` en ms (≥ 0; un `capturedAt` posterior a `now` da 0)                                                                                                                                                                                                                                            |

| Product                                                                                                  | Variant                                                                       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `productId: ProductId`, `name`, `attributes: readonly { name; value }[]`, `variants: readonly Variant[]` | `variantId: VariantId`, `size`, `color`, `available: boolean`, `price: Money` |

Ids en `domain/catalog/ids.ts`: `ProductId`, `VariantId` (dueño: catálogo).

## Errores (`domain/catalog/errors.ts`, module `catalog`)

| Clase                       | `code`                         | Status |
| --------------------------- | ------------------------------ | ------ |
| `CatalogDuplicateProductId` | `catalog-duplicate-product-id` | 422    |
| `CatalogDuplicateVariantId` | `catalog-duplicate-variant-id` | 422    |
| `CatalogCapturedInFuture`   | `catalog-captured-in-future`   | 422    |
| `CatalogOutOfOrder`         | `catalog-out-of-order`         | 422    |

`InvalidMoney` (`invalid-money`, module `shared-kernel`, 500: sólo configuración/programación).
`capability-missing` (403) es de infraestructura, no un `DomainError` (lo emite el chequeo
genérico de seguridad).

## Puertos y políticas (`application/catalog/`)

| Elemento                                     | Firma                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CatalogStore.current(merchantId)`           | `Promise<CatalogSnapshot \| undefined>`                                                                                                                        |
| `CatalogStore.replace(merchantId, snapshot)` | `Promise<void>` (registra también el `receivedAt` en las recepciones)                                                                                          |
| `CatalogStore.receipts(merchantId)`          | `Promise<readonly Date[]>` (últimas 8, más reciente al final)                                                                                                  |
| `FRESHNESS_BUDGET`                           | `{ catalogMs: hours(36), stockAndPriceMs: minutes(15) }`                                                                                                       |
| `CAPTURE_TOLERANCE_MS`                       | `minutes(5)` (la fábrica la recibe como constante del dominio; la aplicación la publica)                                                                       |
| `observedSyncLevel(receipts, now)`           | `0 \| 1 \| 2 \| 3`: 0 sin recepciones o última ≥ 36 h; 1 si última < 36 h; 2 si además ≥ 3 recepciones, mediana de intervalos ≤ 15 min y última < 1 h; 3 nunca |

## Casos de uso y servicios

| Elemento                                                                                | Request → Response                                                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UpsertCatalogSnapshotUseCase` (deps: `clock`, `store`, `logger`)                       | `{ merchantId, capturedAt, products }` → `Result<CatalogSummary, CatalogError>`; `CatalogSummary = { products, variants, receivedAt, observedSyncLevel }` |
| `ProductTruthService.lookup(merchantId, productId, variantId)` (deps: `clock`, `store`) | `ProductTruth`                                                                                                                                            |
| `ProductTruthService.syncLevel(merchantId)`                                             | `0..3`                                                                                                                                                    |

`ProductTruth`:

```ts
| { kind: "known"; product: Product; variant: Variant; freshness: { catalog: "fresh"; stockAndPrice: "fresh" | "stale" }; ageMs: number }
| { kind: "unknown"; reason: "absent" | "stale" | "unknown-product" | "unknown-variant" }
```

## Merchant y seguridad

| Elemento                           | Cambio                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Merchant`                         | `+ platformKeys: readonly string[]` (0..2), `ownsPlatformKey(key)`; `of` rechaza una clave de plataforma igual a una de ingesta (`PlatformKeyCollision`, `platform-key-collision`, 500) |
| `MerchantConfig` (`OPE_MERCHANTS`) | `+ platformKeys?: string[]`                                                                                                                                                             |
| `MerchantDirectory`                | `+ findByPlatformKey(key): Promise<Merchant \| undefined>`                                                                                                                              |
| `PlatformKeyResolver.resolve(key)` | `Promise<Result<Merchant, Unauthorized>>`                                                                                                                                               |
| `SecurityOutcome`                  | `{ principal; capabilities: readonly string[]; log? }`                                                                                                                                  |
| `SecurityScheme` (cableado)        | `{ handler: SecurityHandler; header: string }`                                                                                                                                          |
| `CONSUMER_CAPABILITIES`            | `{ sdk: [...], platform: [...] }` réplica de `contracts/api-map.yaml` (prueba)                                                                                                          |
| Chequeo genérico                   | `x-required-capabilities ⊆ outcome.capabilities`, si no `403 capability-missing`                                                                                                        |

## Contrato

Operación `upsertCatalogSnapshot` y schemas en [contracts/](contracts/); tipos de problema en
`contracts/problem-types.additions.yaml`; `platformKey` referenciado desde la raíz; en el mapa
pasa a `built`.
