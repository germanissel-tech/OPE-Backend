# Quickstart — Feature 010: validar el catálogo y la verdad de producto

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check
```

Esperado: todo en 0; `check:api-map` en `4 built, 19 planned`; `check:markers` sin el
PROPUESTO de ADR-020 sobre headers de seguridad.

## 2. Snapshot por la plataforma (US1, US4)

```bash
npm run dev
curl -s -X PUT http://127.0.0.1:3000/v1/catalog -H "content-type: application/json" \
  -H "X-OPE-Platform-Key: ope_dev_platform_key" \
  -d '{"capturedAt":"<ahora>","products":[{"productId":"SKU-1","name":"Remera","attributes":[{"name":"fit","value":"regular"}],"variants":[{"variantId":"SKU-1-M-NEGRO","size":"M","color":"negro","available":true,"price":{"amount":"19990.00","currency":"ARS"}}]}]}'
```

Esperado: `200` con `{ products: 1, variants: 1, receivedAt, observedSyncLevel: 1 }`. Con la
clave de ingesta en ese header → `401`; con la clave de plataforma en `X-OPE-Ingest-Key`
contra `/v1/events` → `401`. Dos productos con el mismo `productId` → `422`
`catalog-duplicate-product-id`; `capturedAt` una hora en el futuro → `422`
`catalog-captured-in-future`; reenviar un snapshot con `capturedAt` anterior → `422`
`catalog-out-of-order`.

```bash
npx vitest run tests/integration/catalog.test.ts tests/integration/security-capabilities.test.ts
```

## 3. Verdad de producto y frescura (US2)

```bash
npx vitest run tests/unit/application/catalog tests/unit/domain/catalog
```

Cubre con reloj fijo: `known` con stock/precio frescos a los 5 min, viejos a las 2 h;
`unknown/stale` a los 3 días; `absent`, `unknown-product`, `unknown-variant`; `available:
false` como guardia.

## 4. Nivel observado (US3)

`tests/unit/application/catalog/sync-level.test.ts`: cada 5 min → 2; diario → 1; 6 h sin
snapshot desde nivel 2 → 1; 48 h → 0; nunca 3.

## 5. Aislamiento y tamaño

```bash
npx vitest run tests/integration/isolation.test.ts tests/integration/catalog-size.test.ts
```

`catalog-size` reporta el tiempo de un snapshot de 5 000 productos / 50 000 variantes
(informativo; falla > 2 s).

## Estado al cierre (histórico)

Se completa al terminar la implementación.
