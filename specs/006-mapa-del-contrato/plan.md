# Implementation Plan: Mapa del contrato y convenciones transversales

**Branch**: `006-mapa-del-contrato` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-mapa-del-contrato/spec.md`

## Summary

API-first de verdad: toda la superficie HTTP del MVP declarada en un mapa gobernado
(`contracts/api-map.yaml`) antes de construirse, verificado contra el contrato en los dos
sentidos por `check:api-map` dentro de `contract:check`; los esquemas de seguridad de los
cuatro consumidores y las convenciones de capacidades, idempotencia servidor a servidor,
paginación y ciclo de vida decididas una vez (ADR-019, ADR-020) y hechas cumplir por cuatro
reglas nuevas del ruleset con fixture; la superficie planeada visible en la documentación
publicada. Sin código de servidor. Dos sondeos fijaron el diseño ([research.md](research.md)):
las operaciones planeadas no van en `openapi.yaml` (R-01) y los esquemas propuestos viven como
archivos sin referencia desde la raíz porque Redocly rechaza componentes sin uso (R-02).

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: las existentes (Redocly CLI, Spectral, `yaml`); ninguna nueva

**Storage**: N/A (archivos del contrato)

**Testing**: Vitest — `tests/governance/api-map.test.ts` con fixtures por caso de falla,
`tests/contract-rules/` con un fixture por regla nueva, `tests/unit/contract-docs.test.ts`
ampliada (sección "Superficie planeada")

**Target Platform**: toolchain del repo; CI

**Project Type**: contrato y gobernanza (sin servidor)

**Performance Goals**: `check:api-map` < 1 s; `contract:check` sin cambio perceptible

**Constraints**: sin cambio incompatible del contrato (versión sigue 1.1.0); las tres
operaciones construidas responden igual (Schemathesis sin cambios); `no-unused-components`
sigue en `error`; todo en inglés en contrato y scripts, español en docs y ADRs (ADR-015);
gates de la 005 (forma, duplicación, mutación sobre el diff) en verde

**Scale/Scope**: 1 mapa con ~24 operaciones (3 construidas, 21 planeadas) y 5 consumidores,
3 archivos de esquema de seguridad nuevos, 4 parámetros + 1 esquema de página reutilizables,
1 tipo de problema nuevo, 1 script de chequeo, 4 reglas de ruleset (+1 modificada con
excepción acotada), 2 ADRs, 1 enmienda de la constitución (V), CLAUDE.md y README

## Constitution Check

| Gate                                          | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superficie HTTP → contrato primero            | **Sí**   | Es la feature que lo hace real: nada entra al contrato sin estar en el mapa; el mapa se diseña acá y se valida con el chequeo antes de cualquier código                                                                                                                                                                              |
| Persistencia / API → aislamiento por merchant | Parcial  | Sin persistencia ni operaciones nuevas construidas. **Enmienda a V** (ver Complexity Tracking): `merchantId` en ruta sólo para el consumidor `admin`, cuya credencial es de un operador de OPE y no de un merchant; la regla de lint acota la excepción y un fixture prueba que fuera de `admin` sigue fallando                      |
| Plano de decisión / ledger / LLM              | No       | —                                                                                                                                                                                                                                                                                                                                    |
| `x-invariants`                                | No       | No hay reglas de negocio nuevas sobre operaciones construidas; `idempotency-conflict` (409) es un tipo de problema para las operaciones planeadas de `outcomes` y entra al catálogo sin invariante hasta que exista la operación                                                                                                     |
| Sustantivo nuevo en el contrato (glosario)    | Parcial  | El contrato construido no gana sustantivos; el mapa introduce nombres de operaciones planeadas cuyos sustantivos (`order`, `return`, `catalog`, `experiment`, `flag`, …) se resolverán en su feature (FR-051). `check:glossary` sólo mira el bundle, así que no se dispara; el chequeo del mapa no exige glosario para las planeadas |
| Toca `src/` → dirección de dependencias       | No       | Sin cambios en `src/`                                                                                                                                                                                                                                                                                                                |
| Documentación viva                            | **Sí**   | La superficie planeada se genera desde el mapa al construir la documentación; ninguna cifra en prosa                                                                                                                                                                                                                                 |

**Resultado pre-Phase 0**: PASA con una enmienda pendiente de aprobación (V, consumidor
`admin`). **Post-Phase 1**: PASA con la misma condición.

## Project Structure

### Documentation (this feature)

```text
specs/006-mapa-del-contrato/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/                       # diseño: se copia a contracts/ en la implementación
│   ├── api-map.yaml                 # el mapa entero (consumidores, roadmap, 24 operaciones)
│   ├── components/securitySchemes/{platformKey,portalSession,adminToken}.yaml
│   ├── components/parameters/{cursor,limit,from,to}.yaml
│   ├── components/schemas/Page.yaml # envoltorio base; cada colección define <X>Page con items tipados
│   ├── examples/x-idempotency.yaml  # forma de la extensión, con la operación notifyOrder como muestra
│   └── problem-types.additions.yaml # idempotency-conflict (409)
└── tasks.md
```

### Source Code (repository root)

```text
contracts/
├── api-map.yaml                                  # nuevo, gobernado
├── components/securitySchemes/*.yaml             # +3 archivos, sin referencia desde la raíz
├── components/parameters/{cursor,limit,from,to}.yaml   # nuevos, sin referencia
├── components/schemas/Page.yaml                  # nuevo, sin referencia
├── problem-types.yaml                            # + idempotency-conflict
├── .spectral.yaml                                # + ope-consumer-security, ope-outcomes-idempotency, ope-collection-pagination; ope-required-capabilities con map
└── rules/functions/{consumerSecurity,outcomesIdempotency,collectionPagination}.js, requiredCapabilities.js (map), noMerchantIdInRequest.js (excepción admin), _apiMap.js (carga tipada del mapa)
scripts/
├── check-api-map.mjs                             # nuevo; entra a contract:check
├── contract-docs.mjs                             # + sección "Superficie planeada" desde el mapa
└── governance-lib.mjs                            # + verificación de fuentes (extraída de check-glossary)
docs/adr/019-mapa-del-contrato-y-ciclo-de-vida.md, 020-consumidores-autenticacion-idempotencia-paginacion.md
.specify/memory/constitution.md                   # enmienda V (admin) → v1.2.0
tests/
├── governance/api-map.test.ts + fixtures/api-map/<caso>/{api-map.yaml,bundle.yaml}
├── contract-rules/gen-fixtures.mjs (+ fixtures nuevos), rules.test.ts (+ valid-outcomes, valid-portal)
└── unit/contract-docs.test.ts (+ sección planeada)
CLAUDE.md, README.md, tests/contract/README.md
```

**Structure Decision**: sin cambios en `src/`. Todo lo nuevo es contrato (`contracts/`),
gobernanza (`scripts/`, `tests/governance`, `tests/contract-rules`) y decisiones (`docs/adr`,
constitución).

### Comandos npm (cambios)

| Comando          | Cambio                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- |
| `check:api-map`  | nuevo: `node scripts/check-api-map.mjs`; informa `Mapa: N construidas, M planeadas, …` |
| `contract:check` | + `check:api-map` después de `check:markers`                                           |
| `contract:docs`  | agrega "Superficie planeada" a la copia del bundle antes de `build-docs`               |

## Diseño de los puntos no triviales

- **Mapa como única puerta** (R-01, R-03): `check:api-map` compara en los dos sentidos y
  verifica la coherencia de las `built` campo por campo (método, ruta, tag, esquema,
  capacidades) para que el mapa nunca sea decorativo. Las `planned` sólo se validan contra
  consumidores, features y fuentes.
- **Esquemas y componentes propuestos** (R-02): archivos en `components/` sin referencia
  desde la raíz; el chequeo los parsea y valida su forma mínima. Pasar una operación a `built`
  incluye referenciar su esquema en la raíz si es el primero de su consumidor (documentado en
  `CLAUDE.md` y en ADR-019).
- **Regla tag ⇒ esquema** (R-04.1): el mapa es la fuente (`consumers.<x>.tags`); la función
  la carga con `_apiMap.js` (patrón de `_catalog.js`). `public` ⇒ `security: []`.
- **Capacidades por consumidor** (R-04.2): `requiredCapabilities.js` recibe `map` y valida
  pertenencia; el catálogo de capacidades es la sección `consumers` del mapa (FR-013).
- **Idempotencia** (R-04.3, R-05): extensión `x-idempotency: { key, first, repeat }` sobre la
  operación; la regla verifica que `key` sea propiedad requerida del body y que `first` y
  `repeat` sean respuestas 2xx distintas declaradas; `409 idempotency-conflict` obligatorio.
- **Paginación** (R-04.4, R-05): parámetros comunes por `$ref`, envoltorio `<X>Page` con
  `items` y `nextCursor`; la regla identifica colecciones por `GET` + tag `portal` + ruta sin
  parámetro final, y exige `x-collection: true` para que la intención sea explícita.
- **Excepción `admin` a la regla de `merchantId`** (R-06): `noMerchantIdInRequest.js` permite
  `merchantId` como parámetro de ruta sólo si el tag de la operación pertenece al consumidor
  `admin` según el mapa; en query y body sigue prohibido para todos. Fixture: `admin` con
  `merchantId` en body → falla; `portal` con `merchantId` en ruta → falla.
- **Documentación** (R-01): `contract-docs.mjs` lee el mapa, genera la tabla Markdown
  (operación, método y ruta, consumidor, feature, estado, fuente) y la agrega a
  `info.description` de una copia temporal del bundle; la prueba de docs afirma que el HTML
  contiene la sección y los `operationId` planeados, y que `contracts/dist/openapi.yaml` no
  cambió.
- **Fuentes**: la verificación `constitucion#X | mvp:archivo#X | ruta` sale de
  `check-glossary.mjs` a `governance-lib.mjs` (`verifySource`), usada por ambos chequeos;
  `check-glossary` no cambia de comportamiento (sus pruebas lo cubren).
- **Orden de commits**: (1) ADR-019/020 + enmienda de la constitución + mapa + esquemas y
  componentes + `check:api-map` con pruebas + `contract:check`; (2) reglas del ruleset con
  fixtures; (3) documentación publicada + CLAUDE.md/README + quickstart.

## Complexity Tracking

| Elemento                                                         | Por qué                                                                                                    | Alternativa rechazada                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enmienda a la constitución V (`merchantId` en ruta para `admin`) | un operador de OPE administra merchants que no son "su" tenant; la credencial no puede derivar el merchant | credencial admin por merchant (no escala a un operador) o rutas admin sin identificar el merchant (imposible); la excepción queda acotada por regla + fixture |
| Mapa separado de `openapi.yaml`                                  | las planeadas no deben ser servidas, tipadas ni probadas (R-01)                                            | `x-status: planned` dentro del contrato: engaña a cinco herramientas                                                                                          |
| Extensiones `x-idempotency` y `x-collection`                     | hacen verificable por regla lo que sería prosa en un ADR                                                   | describirlo sólo en el ADR: "regla sin verificación es decorativa" (ADR-009)                                                                                  |

## Re-evaluación del Constitution Check (post-Phase 1)

El diseño del mapa cubre las 24 operaciones que implican los documentos del MVP con fuente
por operación; el contrato construido no cambia de forma; las reglas nuevas tienen fixture;
la única desviación es la enmienda a V, acotada al consumidor `admin` y verificada por lint.
**PASA, condicionada a la aprobación de la enmienda por el usuario.**
