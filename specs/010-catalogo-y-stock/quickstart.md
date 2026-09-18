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
  -d '{"capturedAt":"<ahora>","products":[{"productId":"SKU-1","title":"Remera","attributes":[{"key":"fit","value":"regular"}],"variants":[{"variantId":"SKU-1-M-NEGRO","size":"M","color":"negro","available":true,"price":{"amount":"19990.00","currency":"ARS"}}]}]}'
```

Esperado: `201` con `{ products: 1, variants: 1, receivedAt, observedSyncLevel: 1 }`; repetir
el mismo cuerpo → `200`; mismo `capturedAt` con otro contenido → `409 idempotency-conflict`. Con la
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

## Estado al cierre (histórico, 2026-09-18)

| Comando                                | Resultado                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` al inicio                   | 67 archivos, 485 pruebas                                                                                                                                                                                              |
| `npm test` al cierre                   | 552 pruebas                                                                                                                                                                                                           |
| `npm run contract:check`               | verde; mapa `4 built, 19 planned`; glosario 46 términos                                                                                                                                                               |
| `npm run quality`                      | 5 gates en verde; `Lint exceptions: 0`                                                                                                                                                                                |
| `npm run test:mutation`                | every mutant died                                                                                                                                                                                                     |
| `npm run test:contract` (Schemathesis) | verde con `upsertCatalogSnapshot`                                                                                                                                                                                     |
| `catalog-size` (5 000 × 10, ~10 MiB)   | < 2 s en el perfil local (informativo)                                                                                                                                                                                |
| Cambios respecto del plan              | idempotencia por `capturedAt` con 201/200/409 (la regla `ope-outcomes-idempotency` del mapa lo exigió); `name` → `title`/`key` (denylist de PII); redacción de **todo** header en lugar de derivar rutas del cableado |
