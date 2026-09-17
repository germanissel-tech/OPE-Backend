# Pruebas de las reglas del contrato

`rules.test.ts` carga `contracts/.spectral.yaml` con el mismo cargador que la CLI y corre cada
fixture de `fixtures/`. `redocly.test.ts` hace lo mismo con las assertions de `redocly.yaml`
sobre `redocly/*.yaml` (las que necesitan ver los `$ref` archivo por archivo). Convención:

- `<regla>.yaml` o `<regla>.<variante>.yaml`: contrato mínimo que viola **sólo** esa regla.
  La prueba exige un error con `code === <regla>`, archivo y posición.
- `valid.yaml` y `merchant-id-in-response.yaml`: deben pasar sin errores ni warnings.

## Agregar una regla

1. Definirla en `contracts/.spectral.yaml` (estilo bloque; si necesita lógica, una función
   CommonJS en `contracts/rules/functions/`).
2. Agregar `fixtures/<regla>.yaml`. La prueba "hay un fixture por cada regla propia" falla si
   falta.
3. Documentarla en `specs/001-api-contract-toolchain/research.md` (tabla R-02) o en la spec de
   la feature que la introduce.

Los fixtures se **generan** con `node tests/contract-rules/gen-fixtures.mjs` a partir de un
contrato base válido; no se editan a mano. Al agregar uno, verificar que dispara una única
regla: `npx spectral lint tests/contract-rules/fixtures/<f>.yaml --ruleset contracts/.spectral.yaml`.

## Consumidores, idempotencia y paginación (feature 006, ADR-020)

Cuatro reglas leen `contracts/api-map.yaml` (`functionOptions.map`, cargado por
`_apiMap.js`): `ope-consumer-security` (el tag fija el consumidor y el consumidor el esquema),
`ope-required-capabilities` (vocabulario por consumidor), `ope-no-merchant-id-in-request`
(excepción acotada: `merchantId` en la ruta sólo bajo `admin`) y las dos de forma:
`ope-outcomes-idempotency` (`x-idempotency` + `409` en toda operación `outcomes`) y
`ope-collection-pagination` (`x-collection`, parámetros comunes y `<X>Page` en toda lectura de
colección del portal; corre sobre el documento sin resolver y lee los path items `$ref` desde
disco). Los fixtures válidos `valid-outcomes.yaml`, `valid-portal.yaml` y `valid-admin-path.yaml`
muestran la forma correcta de cada consumidor.

## Invariantes (feature 002, ADR-007)

`x-invariants` sobre una operación o un schema: `type` (slug del catálogo, nunca
`unprocessable`), `status`, `rule`, `description`. Cada una necesita una prueba del servidor
cuyo título contenga `[invariant:<slug>]`; `npm run check:invariant-tests` falla si falta.
