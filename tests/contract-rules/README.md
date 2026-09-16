# Pruebas de las reglas del contrato (FR-052)

`rules.test.ts` carga `contracts/.spectral.yaml` con el mismo cargador que la CLI y corre cada
fixture de `fixtures/`. Convención:

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

Los fixtures se escribieron a partir de un contrato base válido de un solo archivo; al
modificarlos, verificar que siguen disparando una única regla:
`npx spectral lint tests/contract-rules/fixtures/<f>.yaml --ruleset contracts/.spectral.yaml`.
