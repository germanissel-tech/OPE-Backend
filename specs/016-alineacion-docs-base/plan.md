# Implementation Plan: Alineación con los documentos base del MVP (016)

**Branch**: `016-alineacion-docs-base` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-alineacion-docs-base/spec.md`

## Summary

Llevar al repo y a los documentos base las doce decisiones de la evaluación del 2026-09-20,
en tres historias: gobernanza del repo (constitución 1.4.0 con el principio XI y las barreras
`fit`/`price`/`returns`; ADR-025 revisado con la estrategia de sincronización por flujo; ADR
nuevo con las cinco decisiones de producto confirmadas; ADR-010 corregido; roadmap
renumerado y reordenado con el alcance de cada feature; glosario), contrato v2 (cadena de
evidencia `status` + `correlation` según `01 §5`, `locale` en el contexto de página, gate
`check:identifiers`) y la base al día (`README`, `01`–`04`, diagramas). Nada de lo que la
evaluación asigna a otra feature se implementa.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`), `typescript` alias a la API 6 para
las herramientas (ADR-017); Node 22; scripts `.mjs` con `checkJs`.

**Primary Dependencies**: sin cambios (Fastify + openapi-backend, Ajv, Vitest 5, Stryker 10,
ESLint 10, Spectral/Redocly/oasdiff, Schemathesis). `archify` (diagramas de la base) no está
en el repo ni en la máquina: se intenta `npx` (R-07).

**Storage**: perfil local en memoria, sin cambios (decisión 4 de la evaluación).

**Testing**: Vitest (`fast`/`tools`), Stryker sobre las líneas cambiadas (`--files` para
iterar), Schemathesis contra `/v2/`.

**Target Platform**: servidor Node 22 (Windows en desarrollo, Linux en CI).

**Project Type**: web-service contract-first + documentos de gobernanza.

**Performance Goals**: sin cambio en el camino crítico (`locale` es un campo que se copia).

**Constraints**: un cambio incompatible del contrato (versión mayor 2.0.0, `/v2/`) y uno
compatible (`locale`); cero excepciones nuevas de lint, idioma o mutación; commits por
historia en español; sin push hasta la PR, sin merge; la historia 3 requiere autorizar `../`.

**Scale/Scope**: constitución, 3 ADR (uno nuevo), mapa, ~5 notas de glosario; 4 esquemas del
contrato + rutas y ejemplos; ~4 archivos de `src/` y sus controllers; 1 script nuevo con
fixtures y prueba; 5 documentos base y 3 fuentes de diagramas.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los diez principios contra la constitución v1.3.0 y los once de la v1.4.0 que esta
feature escribe.

| Gate                                           | ¿Aplica? | Cómo se cumple                                                                                                                                                                            |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades                   | **Sí**   | Ninguna autoridad nueva; `locale` se copia del foco al registro sin que ninguna autoridad lo lea (R-05)                                                                                   |
| II. Fail-closed                                | **Sí**   | `locale` inválido → 400 por el contrato; `check:identifiers` falla ante lo desconocido; la orden sin correlación sigue `PENDING_CORRELATION`, nunca completada por inferencia             |
| III. La medición precede y no se contamina     | **Sí**   | Nada toca asignación ni brazos; el idioma se registra como característica, no como tratamiento (evaluación §2.3)                                                                          |
| IV. Dos caminos, dos garantías                 | **Sí**   | Sin I/O nueva; el registro desacoplado queda escrito para la 018 (decisión 5)                                                                                                             |
| V. Aislamiento por merchant                    | **Sí**   | Sin cambios de frontera; `merchantId` sigue sólo desde la credencial                                                                                                                      |
| VI. Identidad explícita / contrato primero     | **Sí**   | `status`/`correlation` y `locale` entran por `contracts/` antes que el código; versión mayor por el cambio incompatible (ADR-003); `contract:diff` lo acepta sólo por el salto de versión |
| VII. Comportamiento, no personas               | **Sí**   | `locale` es contexto de la página (`01 §10.2`: "tipo de página y producto en vista"), declarado en la lista blanca; ningún otro campo nuevo                                               |
| VIII. Cero LLM                                 | **Sí**   | Nada nuevo                                                                                                                                                                                |
| IX. Trazabilidad                               | **Sí**   | El registro de la decisión gana `locale`; la orden conserva `correlation` al devolverse; cada edición cita su decisión de la evaluación                                                   |
| X. Puertos en los dos bordes                   | **Sí**   | Deja de ser deuda declarada a secas: ADR-025 revisado y la 019 del mapa describen puerto, tres modos y adaptadores (decisión 1); esta feature no construye el puerto y lo dice            |
| XI. Ninguna política vive en el código (nueva) | **Sí**   | Se escribe en esta feature; ninguna constante nueva de comportamiento entra en `src/` (el patrón de `locale` es una expresión regular del contrato, no una política)                      |
| Mapa del contrato / superficie HTTP            | **Sí**   | Sin operaciones nuevas; rutas `/v2/`; `features:` renumeradas y reordenadas (R-03); `check:api-map` verde                                                                                 |
| Sustantivo nuevo (glosario)                    | **Sí**   | `locale` y `estrategia de sincronización` con nota y fuente antes del contrato (ADR-008); `correlation` reutiliza `correlación pendiente`/`orden atribuida`                               |
| `x-invariants`                                 | **No**   | Ninguna regla que el esquema no exprese: `locale` es un patrón; `status`/`correlation` son enums                                                                                          |
| Toca `src/` → dependencias                     | **Sí**   | Cambios dentro de `outcomes`, `ingestion`, `ledger`, `decision` sin importaciones nuevas entre módulos; `arch` en 0                                                                       |
| ADR-023 / ADR-024                              | **Sí**   | Sin errores nuevos; `Order` conserva `of`/`rehydrate`; `status()` y `correlationStatus()` son reglas en su dueño                                                                          |
| ADR-016 (gates)                                | **Sí**   | Gate nuevo con fixture y prueba, en `contract:check`; sin excepciones nuevas; `test:mutation` sobre lo cambiado                                                                           |
| ADR-015 (idioma)                               | **Sí**   | Script, fixtures y descripciones del contrato en inglés; documentos y ADR en castellano; identificadores del contrato en la constitución (R-01)                                           |

**Resultado pre-Phase 0**: PASA.
**Post-Phase 1**: PASA (el diseño no agrega nada que cambie una fila).

## Project Structure

### Documentation (this feature)

```text
specs/016-alineacion-docs-base/
├── plan.md              # este archivo
├── research.md          # R-01..R-08
├── data-model.md        # status/correlation, locale, identificador citado, roadmap, decisiones de producto
├── quickstart.md        # cómo verificar cada historia y el cierre
├── contracts/
│   ├── contract-v2.md          # esquemas, versión, rutas, glosario, código
│   ├── check-identifiers.md    # el gate: entrada, criterio, allowlist, salida, pruebas
│   └── governance-docs.md      # constitución 1.4.0, ADR-025, ADR nuevo, ADR-010, mapa
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
.specify/memory/constitution.md                 # 1.4.0: XI, barreras (R-01)
docs/adr/025-*.md                                # tres modos, adaptadores en OPE (R-02)
docs/adr/030-decisiones-de-producto-confirmadas.md   # nuevo (R-02)
docs/adr/010-*.md                                # D3–D6 → 01 §13 (R-02)
docs/dominio/{estrategia-de-sincronizacion,locale}.md   # nuevas; orden-verificada, orden-atribuida, correlacion-pendiente actualizadas
contracts/
├── openapi.yaml                                 # info.version 2.0.0
├── paths/*.yaml                                 # /v2/, ejemplos con status + correlation
├── components/schemas/{OrderStatus,Correlation,OrderResult,ReturnResult,PageContext}.yaml
└── api-map.yaml                                 # /v2/, features 016–022 (R-03)
src/
├── domain/outcomes/order.ts                     # OrderStatus, CorrelationStatus, status(), correlationStatus()
├── domain/ingestion/{event,event-batch}.ts      # PageContext.locale, ProductFocus.locale
├── domain/ledger/decision.ts                    # DecisionRecord.locale
├── application/decision/services/decision.service.ts   # copia locale al registro
├── interface-adapters/http/controllers/{ingestion/ingest-events,outcomes/notify-order,outcomes/notify-return}.ts
└── interface-adapters/http/generated/api.d.ts   # regenerado
scripts/check-identifiers.mjs + scripts/identifiers-allowlist.json   # gate (R-06)
package.json                                     # check:identifiers en contract:check
CLAUDE.md                                        # fila del gate; /v2/ donde cite rutas
tests/
├── governance/identifiers.test.ts + fixtures/identifiers/{ok,unknown,allowlist-without-reason}/
├── integration/{orders,order-corroborations,returns,ingest-events,...}.test.ts   # /v2/, status + correlation, locale
└── unit/domain/outcomes/order.test.ts, unit/domain/ingestion/event-batch.test.ts
../README.md, ../01-arquitectura-mvp.md, ../02-integracion-ecommerce.md, ../03-alcance-mvp.md, ../04-hoja-de-decisiones.md
../diagramas/*.json (+ HTML regenerado si archify está disponible)
```

**Structure Decision**: la estructura del repo no cambia; una feature de documentos y un
cambio de contrato acotado. Los documentos base viven fuera del repo y se editan como
tareas de la historia 3 con autorización de la carpeta.

## Complexity Tracking

Sin violaciones que justificar. La versión mayor del contrato es la regla de ADR-003 aplicada,
no una excepción.
