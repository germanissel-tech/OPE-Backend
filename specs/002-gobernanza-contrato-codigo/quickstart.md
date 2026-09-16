# Quickstart — Feature 002: validar la gobernanza

Cada bloque: comando y resultado esperado. Estado BUILT / TESTED sólo con comando ejecutado.

## 1. Todo junto

```bash
npm run contract:check && npm run build && npm run typecheck && npm test && npm run test:contract
npm run release-check
```

Esperado: todo en 0. `contract:check` imprime, además de lo de la 001: invariantes declaradas
(cero hoy), términos del glosario con fuente, ADRs sin citas rotas, marcadores sin
bloqueantes. `release-check` sale 0.

## 2. Reglas del contrato (US1, US4, US5)

Pruebas automáticas: `npx vitest run tests/contract-rules`. Manual:

```bash
# En contracts/paths/health.yaml, bajo get:, agregar:
#   x-invariants:
#     - type: no-existe
#       status: 422
#       rule: x
#       description: y
npm run contract:lint          # falla: ope-invariants, "no-existe no está en el catálogo"
git checkout contracts/paths/health.yaml
```

Lo mismo con un schema inline en la respuesta 200 → `rule/media-type-schema-ref`
(Redocly, con archivo y línea); con `x-required-capabilities` en `getHealth` (pública) →
`ope-required-capabilities`.

## 3. Invariante sin prueba (US1)

```bash
# declarar una invariante válida (por ejemplo type: not-found, status: 404) en getHealth y:
npm run check:invariant-tests  # falla: falta una prueba con [invariant:not-found]
```

## 4. Glosario (US2)

```bash
npm run check:glossary
# agregar una ruta /v1/widgets a un contrato de prueba → falla nombrando "widgets"
# quitar `fuente` de docs/dominio/merchant.md → falla nombrando la nota
```

Sin el directorio de los documentos del MVP (`OPE_MVP_DOCS=/no/existe`), las fuentes
`mvp:` se reportan como no verificables con aviso y el comando no falla por eso.

## 5. ADRs y marcadores (US3)

```bash
npm run check:adrs             # escribir `ADR-999` en un doc → falla
npm run check:markers          # lista archivo:línea:texto
npm run check:markers -- --strict   # sale 1 si hay ABIERTO o PLACEHOLDER
```

## 6. Arquitectura (US4)

```bash
npm run arch                   # 0 violaciones sobre src/
npx vitest run tests/architecture   # incluye los fixtures con violaciones
```

Manual: agregar `import Fastify from "fastify"` en `src/domain/health.ts` → `npm run arch`
falla nombrando archivo, import y regla `domain-is-pure`.

## 7. Sin cambio de comportamiento (SC-003)

Las pruebas de integración de la 001 pasan sin tocar aserciones; los `curl` de
`specs/001-api-contract-toolchain/quickstart.md` §3 y §4 responden igual.

## Estado al cierre de la feature

(se completa en implement, con fecha y evidencia)
