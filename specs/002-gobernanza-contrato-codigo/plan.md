# Implementation Plan: Gobernanza del contrato y del código

**Branch**: `002-gobernanza-contrato-codigo` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-gobernanza-contrato-codigo/spec.md`

## Summary

Convertir en verificaciones que fallan el build las prácticas adoptadas de `las-animas`:
invariantes declaradas en el contrato con prueba obligatoria, catálogo de errores sin
genéricos, glosario de lenguaje ubicuo verificado, registro de decisiones con citas
verificadas, marcadores de estado contables con puerta de release, schemas siempre por
referencia, capacidad por operación autenticada, y arquitectura por capas con prueba de
dependencias. Sin operaciones nuevas: `getHealth` sigue solo. Reutiliza la infraestructura de
la 001 (Spectral + fixtures, Redocly, scripts Node) y agrega dependency-cruiser. Decisiones y
evidencia en [research.md](research.md).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 5.9.3 (sin cambios)

**Primary Dependencies**: las de la 001 + `dependency-cruiser@18.3` (dev). Sin dependencias de
runtime nuevas.

**Storage**: N/A

**Testing**: Vitest; fixtures por regla (`tests/contract-rules/fixtures/` para Spectral,
`tests/contract-rules/redocly/` para assertions de Redocly, `tests/governance/fixtures/` para
scripts, `tests/architecture/fixtures/` para dependency-cruiser)

**Target Platform**: igual que la 001 (Windows/macOS dev, Linux CI); scripts en Node

**Project Type**: toolchain de contrato + reorganización del backend

**Performance Goals**: `contract:check` < 30 s (SC-002)

**Constraints**: cero cambios de comportamiento HTTP (SC-003); dominio sin dependencias
externas; los documentos del MVP no se copian al repo

**Scale/Scope**: 3 reglas Spectral, 1 assertion Redocly, 5 scripts, 10 ADRs, 6 notas de
glosario, 1 configuración de arquitectura, 4 capas, ~10 archivos movidos

## Constitution Check

| Gate                                                               | ¿Aplica?                       | Cómo se cumple                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toca superficie HTTP → contrato diseñado antes; compatible o major | **Sí, sin operaciones nuevas** | Se agregan dos extensiones (`x-invariants`, `x-required-capabilities`) — forma en [contracts/](contracts/) — y se elimina un componente sin uso. `contract:diff` contra `main`: sin cambios incompatibles (las extensiones `x-` no son parte de la superficie). |
| Toca persistencia o API → pruebas de aislamiento por merchant      | Sí (API)                       | Sin datos ni credenciales; se mantiene la prueba de FR-017 de la 001 y se agrega `ope-required-capabilities`, que es la base para "merchantId se deriva de la credencial" por operación (fixtures en ambos sentidos).                                           |
| Plano de decisión                                                  | No                             | —                                                                                                                                                                                                                                                               |
| Ledger / cadena de evidencia                                       | No                             | —                                                                                                                                                                                                                                                               |
| Campo nuevo de evento u orden                                      | No                             | —                                                                                                                                                                                                                                                               |
| LLM en runtime                                                     | No                             | —                                                                                                                                                                                                                                                               |

Principio I (separación de autoridades, composition root único): esta feature lo convierte
en verificación ejecutable (FR-040/FR-041). Principio "estado epistémico": los marcadores
pasan a ser contables. **Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/002-gobernanza-contrato-codigo/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── contracts/
│   ├── x-invariants.md            # forma de la extensión, ejemplos válidos e inválidos
│   └── x-required-capabilities.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root) — lo nuevo y lo movido

```text
docs/
├── adr/                           # FR-020: 001..010 (ver research R-04)
│   └── README.md                  # cómo citar, estados, plantilla
├── dominio/                       # FR-010: glosario
│   ├── _tecnicos.json             # vocabulario técnico excluido
│   ├── README.md
│   └── {merchant,evento,sesion,visitante,orden,decision}.md
contracts/
├── .spectral.yaml                 # + ope-invariants, ope-no-generic-422, ope-required-capabilities
├── rules/functions/{invariants,noGeneric422,requiredCapabilities}.js
└── components/responses/UnprocessableEntity.yaml   # ELIMINADO (sin uso, ejemplo genérico)
redocly.yaml                       # + rule/media-type-schema-ref
.dependency-cruiser.cjs            # FR-040/041
scripts/
├── check-adrs.mjs                 # FR-021
├── check-markers.mjs              # FR-022/023 (--strict)
├── check-glossary.mjs             # FR-011..013
├── check-invariant-tests.mjs      # FR-003
└── release-check.mjs              # contract:check + markers --strict
src/
├── main.ts                        # composition root (cablea systemClock)
├── domain/health.ts               # serviceHealth(): valor puro
├── ports/clock.ts                 # interface Clock
├── adapters/
│   ├── http/build-server.ts       # ← src/server/build-server.ts
│   ├── http/problem-details.ts    # ← src/server/problem-details.ts
│   └── clock/system-clock.ts
├── handlers/
│   ├── typed.ts                   # ← src/server/handlers.ts
│   └── health.ts                  # traduce dominio → DTO Health
├── client/index.ts
└── generated/api.d.ts
tests/
├── contract-rules/fixtures/       # + fixtures de las 3 reglas nuevas; los existentes sin schemas inline
├── contract-rules/redocly/        # fixtures + prueba de la assertion (CLI --format json)
├── governance/                    # check-adrs, check-markers, check-glossary, check-invariant-tests (fixtures + pruebas)
├── architecture/                  # architecture.test.ts + fixtures/src/** con violaciones
└── (los de la 001, con rutas de import actualizadas)
```

### Comandos npm nuevos / modificados

| Comando                 | Qué hace                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `check:adrs`            | `node scripts/check-adrs.mjs`                                                        |
| `check:markers`         | `node scripts/check-markers.mjs` (lista); `-- --strict` falla con bloqueantes        |
| `check:glossary`        | `node scripts/check-glossary.mjs`                                                    |
| `check:invariant-tests` | `node scripts/check-invariant-tests.mjs`                                             |
| `arch`                  | `depcruise --config .dependency-cruiser.cjs src`                                     |
| `contract:check`        | lint → bundle → diff → types:check → **invariant-tests → glossary → adrs → markers** |
| `release-check`         | `contract:check` + `check:markers --strict`                                          |
| `test`                  | incluye `tests/architecture` y `tests/governance`                                    |

## Diseño de los puntos no triviales

Detalle en research.md: R-01 (qué mecanismo ve qué), R-02 (`x-invariants` y prueba por
slug), R-03 (glosario, fuentes externas), R-04 (ADRs y marcadores), R-05 (capacidades),
R-06 (capas y reglas de dependency-cruiser, con la limitación de `type-only` y la única
excepción `handlers/typed.ts`).

Orden de implementación que evita romper la 001 a mitad de camino: primero los ADRs y
marcadores (sólo docs), después las reglas del contrato con sus fixtures, después la
reubicación del código con la prueba de arquitectura (suite de la 001 en verde en cada paso),
al final CLAUDE.md y quickstart.

## Complexity Tracking

| Elemento                                                    | Por qué                                                                                                         | Alternativa rechazada                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Un tercer mecanismo de verificación (assertions de Redocly) | Única forma de ver `$ref` archivo por archivo                                                                   | Spectral `resolved:false` no llega a los archivos hijos            |
| Cuatro capas para un `getHealth`                            | La regla tiene que existir antes de la primera autoridad de dominio (003); el costo es 3 archivos de ~10 líneas | Introducirla en la 003 mezclaría refactor con dominio              |
| Fuentes del glosario fuera del repo                         | Los documentos del MVP son fuente, no artefacto; copiarlos crearía una segunda verdad                           | Copia en `docs/` — rechazada por la constitución (una sola fuente) |

## Re-evaluación del Constitution Check (post-Phase 1)

Sin operaciones ni campos nuevos; extensiones `x-` documentadas; `unprocessable` sigue en el
catálogo (no es cambio incompatible: ninguna operación lo declaraba). Dominio puro verificado
por herramienta. **PASA.**
