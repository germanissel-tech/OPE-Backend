# Implementation Plan: Corrección de los hallazgos de la auditoría integral (014)

**Branch**: `015-correcciones-auditoria` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-correcciones-auditoria/spec.md`

## Summary

Aplicar las 52 correcciones que la auditoría 014 dejó con `file:line`, propuesta y prueba, en
cuatro historias: decisiones escritas (constitución v1.3.0 en VII, feature planificada para el
puerto de plataforma, prosa detrás del código, tasas 0–1 en la política comercial); reglas en
su dueño y seguridad (invariantes de merchants/experimentos en el dominio, CORS sólo para
navegadores, comparación en tiempo constante, límite de cuerpo por consumidor, 503 del
catálogo); gates que miran lo que creen mirar y conocimiento escrito una vez (Stryker,
`no-magic-numbers` en objetos, helpers compartidos, vocabularios cerrados, prueba de contrato
autenticada, suite en dos proyectos); y legibilidad (comentarios, cabeceras de prueba con
feature, nombres, tipos, división de `build-server.ts`). Cada hallazgo termina `resolved`
(con commit), `absorbed-by` o `rejected` (uno: F-041, R-13) en un anexo de cierre del informe,
y una re-corrida del método de la 014 sobre lo tocado no reproduce ninguno de los resueltos.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) con `typescript` alias a la API 6
para las herramientas (ADR-017); Node 22.

**Primary Dependencies**: Fastify + openapi-backend, Ajv (+ formats), pino, Vitest 5, Stryker
10 (parcheado), ESLint 10 + typescript-eslint + sonarjs + plugin `ope/*`, dependency-cruiser,
jscpd, knip, Prettier, Spectral/Redocly/oasdiff, Schemathesis (`uvx`), lefthook.

**Storage**: perfil local en memoria (sin cambios; la persistencia real es otra feature del
mapa).

**Testing**: Vitest (unitarias, integración con `fastify.inject`, gobernanza, arquitectura,
lint, tipos `test-d`), Stryker (mutación incremental por PR y completa al cierre de la
historia 3), Schemathesis (`test:contract`).

**Target Platform**: servidor Node 22 (Windows 11 en desarrollo; Linux en CI).

**Project Type**: web-service (backend HTTP contract-first).

**Performance Goals**: sin cambio en el camino crítico (p95 de ingesta < 50 ms como gate,
`ingest-latency.test.ts`); `npm test` por defecto ≥ 40 % más rápido que la referencia
(147 s) sin perder pruebas (SC-005).

**Constraints**: modo "una feature toca HTTP" (CLAUDE.md § Flujo): el único cambio de
contrato es la `503` de `upsertCatalogSnapshot` y los códigos nuevos del catálogo de
problemas (ampliaciones compatibles, ADR-021 §5 / ADR-003); respuestas de las siete
operaciones sin cambio (SC-004); sin excepciones nuevas de lint, idioma ni mutación; commits
por historia.

**Scale/Scope**: 52 hallazgos; ~45 archivos de `src/`, ~95 de `tests/` (86 cabeceras),
5 documentos de decisión (constitución, ADR-013, ADR-025, ADR-028, ADR-029, CLAUDE.md), el
mapa del contrato, 1 esquema del contrato y la skill de auditoría (campo `closure`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los diez principios (Edge case de la spec: ningún Constitution Check vuelve a
saltarse uno), contra la constitución v1.2.0 y la v1.3.0 que esta feature escribe.

| Gate                                                 | ¿Aplica?            | Cómo se cumple                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades                         | **Sí**              | Ninguna autoridad nueva; `Experiments` (R-04) es un valor del módulo `experiment`, dueño ya existente; F-041 rechazado (R-13) deja el cableado como está                                                                                                                                          |
| II. Fail-closed                                      | **Sí**              | `Merchant.of`/`Experiments.of` rechazan por fábrica (más fail-closed que hoy); `CatalogStore.replace` devuelve indisponibilidad y el caso de uso responde 503 (R-08/F-044); `413` antes de parsear (R-07)                                                                                         |
| III. Misma inferencia para ambos brazos              | **Sí**              | Nada toca la asignación ni el plano; `assignment-regression.test.ts` sigue verde                                                                                                                                                                                                                  |
| IV. Camino crítico sin red / acotado                 | **Sí**              | Sin I/O nueva; el límite de cuerpo por consumidor acota el trabajo de la ingesta (R-07); F-045 (event loop compartido) queda escrito para la persistencia, fuera de alcance por decisión del dueño                                                                                                |
| V. Aislamiento por merchant                          | **Sí**              | El helper de ventana por merchant (R-08) conserva un `Map` por merchant; `isolation.test.ts` sin cambios de aserciones                                                                                                                                                                            |
| VI. Contrato primero / `merchantId` nunca en request | **Sí**              | `503` de `upsertCatalogSnapshot` y códigos nuevos del catálogo de problemas entran por `contracts/` antes del código; `contract:diff` compatible; sin `merchantId` nuevo en ningún lado                                                                                                           |
| VII. Sin datos personales                            | **Sí**              | Enmienda v1.3.0 admite el incentivo aplicado (no personal) en la notificación de orden (R-01); ningún campo nuevo en esquemas; los `details` nuevos de errores llevan milisegundos e índices                                                                                                      |
| VIII. Cero LLM                                       | **Sí**              | Nada nuevo                                                                                                                                                                                                                                                                                        |
| IX. Trazabilidad                                     | **Sí**              | El ledger no cambia de forma; `Incentive.value` sigue siendo el entero registrado (R-03); cada hallazgo cerrado apunta a su commit (R-14)                                                                                                                                                         |
| X. Puertos en los dos bordes                         | **Deuda declarada** | El dueño decidió mantener X y planificar la feature "Platform port and adapters" en el mapa (R-02); esta feature escribe la deuda en ADR-025 y CLAUDE.md y no construye el puerto. Es la única fila que no es "Sí": queda abierta hasta esa feature, y este plan lo dice en vez de omitir la fila |
| Mapa del contrato / superficie HTTP                  | **Sí**              | Sin operaciones nuevas; roadmap renumerado y feature nueva en `features` (R-02); `check:api-map` verde                                                                                                                                                                                            |
| Sustantivo nuevo (glosario)                          | **No**              | Ningún sustantivo nuevo en el contrato (`payload-too-large` es un tipo de problema, no un sustantivo del dominio; `check:glossary` no lo pide)                                                                                                                                                    |
| `x-invariants`                                       | **No**              | Ninguna regla nueva sobre un request; las invariantes nuevas (`invalid-ingest-keys`, `multiple-active-experiments`, …) son de configuración y entran al catálogo por ADR-023/024 sin `x-invariants`                                                                                               |
| Toca `src/` → dependencias                           | **Sí**              | `gateways-no-cross` exceptúa `gateways/shared-kernel/` con fixture (R-08); ningún cambio en `CONTEXT_MAP`; `arch` en 0                                                                                                                                                                            |
| ADR-023 / ADR-024                                    | **Sí**              | Errores nuevos como clases en `errors.ts` con código del catálogo; `Experiments` con `of`/`rehydrate`; `config.ts` sólo forma (es exactamente F-007)                                                                                                                                              |
| ADR-016 (gates)                                      | **Sí**              | `detectObjects: true` con su justificación; Stryker sólo `next-line` o `restore` efectivo, verificado por reporte; sin excepciones nuevas                                                                                                                                                         |
| ADR-018 (sin mock)                                   | **Sí**              | Prosa restante del mock/modo real se retira (F-008, F-014, F-015)                                                                                                                                                                                                                                 |

**Resultado pre-Phase 0**: PASA con X como deuda declarada por decisión del dueño.
**Post-Phase 1**: PASA (el diseño no agrega nada que cambie una fila).

## Project Structure

### Documentation (this feature)

```text
specs/015-correcciones-auditoria/
├── plan.md              # este archivo
├── research.md          # R-01..R-14: una decisión por grupo de hallazgos
├── data-model.md        # cambios de modelo: Merchant, Experiments, CommercialPolicy en tasas, SecurityScheme, closure
├── quickstart.md        # cómo verificar cada historia y el cierre (re-corrida del método de la 014)
├── contracts/
│   ├── catalog-503.md            # el cambio del contrato: 503 en upsertCatalogSnapshot, códigos nuevos del catálogo
│   ├── constitution-v1.3.0.md    # texto de la enmienda de VII y del historial de versiones
│   ├── api-map-roadmap.md        # renumeración del roadmap y la feature del puerto de plataforma
│   └── closure-annex.md          # forma del anexo de cierre del informe y del campo `closure`
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
.specify/memory/constitution.md          # v1.3.0 (VII)
CLAUDE.md                                # prosa del modo retirado, tasas, comandos test/test:tools, deuda X, features por nombre
docs/adr/{013,025,028,029}-*.md          # F-015, deuda X, cita de VII, replay
docs/dominio/intervencion.md             # F-005
contracts/
├── api-map.yaml                         # roadmap renumerado + feature del puerto (R-02)
├── paths/catalog.yaml                   # 503 (F-044)
├── problem-types.yaml                   # invalid-ingest-keys, invalid-origins, invalid-platform-keys, invalid-platform-secrets,
│                                        # multiple-active-experiments, duplicate-experiment-id, payload-too-large
└── components/schemas/Incentive.yaml    # descripción sin número de feature (F-029)
src/
├── domain/shared-kernel/{rate,compare,time}.ts       # isRate/isCount, constantTimeEquals, CLOCK_SKEW_TOLERANCE_MS
├── domain/merchant/{merchant,errors}.ts              # invariantes del conjunto (F-007), ownsPlatformKey (F-053)
├── domain/experiment/{experiments,errors,index}.ts   # Experiments.of (F-007)
├── domain/commercial/{commercial-policy,default-commercial-policy,errors}.ts   # tasas (F-031)
├── domain/selection/{candidate,quality-gate}.ts      # Claim discriminado (F-038)
├── domain/{ingestion,catalog,outcomes,barrier,decision}/errors.ts  # mensajes sin números (F-022)
├── domain/catalog/catalog-snapshot.ts                # sin #byVariant (F-026)
├── domain/outcomes/order.ts                          # correlated() (F-037)
├── application/decision/policies/session-window.ts   # derivado de DEDUP_WINDOW (F-034)
├── application/catalog/ports/catalog-store.ts        # Result (F-044) + use case
├── application/outcomes/use-cases/notify-order.use-case.ts  # Pick (F-040), correlated (F-037)
├── interface-adapters/http/{typed,status,boundary}.ts        # consumer en SecurityScheme (F-051), HTTP_STATUS (F-013)
├── interface-adapters/http/security/principal.ts     # merchantOf (F-009)
├── interface-adapters/http/controllers/**            # instantOf importado (F-021), status con nombre
├── interface-adapters/gateways/shared-kernel/windowed-map.ts   # F-033
├── interface-adapters/gateways/{ingestion,decision}/memory-*.ts  # usan el helper
├── infrastructure/http/{build-server,raw-bodies,security-boundary,dispatch,cors}.ts  # F-012, F-051, F-057, F-052, F-013
├── composition/{config,condition-config,commercial-policy-config}.ts   # sólo forma; tasas; FACTS satisfies
└── composition/modules/{merchant,experiment,shared-kernel}.ts   # consumer, Experiments, localKernelPorts (F-004)
scripts/
├── lint/domain-no-loose-functions.mjs   # allowlist rate.ts, compare.ts
├── test-contract.mjs                    # credencial de plataforma (F-054)
└── check-test-headers.mjs (o caso en tests/governance)   # Feature NNN en cabeceras (F-020)
.dependency-cruiser.cjs                  # gateways-no-cross exceptúa shared-kernel
eslint.config.mjs                        # detectObjects: true
vitest.config.ts                         # projects fast / tools (F-055)
stryker: comentarios reubicados (F-052)
tests/
├── unit/domain/{merchant,experiment,commercial,selection,shared-kernel}/...   # pruebas nuevas y ajustadas
├── unit/gateways/windowed-map.test.ts
├── integration/{cors,ingest-events,catalog}.test.ts  # F-051, F-057, F-044
├── governance/{mutation-diff,test-headers}.test.ts   # SC-006, F-020
├── types/condition-config.test-d.ts                  # F-039
├── audit/audit.test.ts                               # campo closure del esquema
├── helpers/test-app.ts                               # NOW por defecto, app por archivo
└── **/*.test.ts                                      # 86 cabeceras con Feature NNN
docs/auditoria/
├── 2026-09-19-informe-auditoria-integral.md          # §8 anexo de cierre (fechado)
└── trabajo/hallazgos/fase-{1..4}.json                # closure por hallazgo
.claude/skills/auditing-architecture/scripts/audit-finding.schema.json   # closure opcional
```

**Structure Decision**: sin carpetas nuevas de módulo; dos archivos compartidos nuevos
(`domain/shared-kernel/{rate,compare}.ts`, `gateways/shared-kernel/windowed-map.ts`) y la
división de `build-server.ts` en tres archivos del mismo anillo. Todo lo demás son ediciones
en su lugar.

## Fases (resumen; el detalle operativo es `tasks.md`)

| Historia | Qué cierra                                                                                                                                                  | Commit                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| US1      | F-062, F-063, F-014, F-015, F-008, F-016, F-036, F-023, F-058, F-047, F-034, F-031, F-017, F-029, mapa renumerado                                           | `docs(015): decisiones escritas y tasas en la política comercial` |
| US2      | F-007, F-051, F-053, F-057, F-044                                                                                                                           | `feat(015): reglas en su dueño y bordes de seguridad`             |
| US3      | F-052, F-013, F-021, F-030, F-033, F-048, F-022, F-038, F-039, F-054, F-055, F-056                                                                          | `feat(015): gates que miran y conocimiento escrito una vez`       |
| US4      | F-001, F-003, F-004, F-005, F-006, F-009, F-011, F-012, F-018, F-019, F-020, F-024, F-025, F-026, F-027, F-028, F-032, F-035, F-037, F-040; F-041 rechazado | `refactor(015): legibilidad, cabeceras y forma`                   |
| Cierre   | `closure` en los JSON, anexo §8 del informe, re-corrida del método (SC-002), PR                                                                             | `docs(015): cierre de la auditoría 014`                           |

Orden: US1 primero (las decisiones fijan la forma de la política comercial y los nombres de
las features antes de tocar código); US2 y US3 pueden ir en paralelo salvo por `build-server.ts`
(US2: CORS y `413`; US3: Stryker y `HTTP_STATUS`) y `errors.ts` de merchant/experiment (US2)
frente a los mensajes (US3): se hacen en ese orden. US4 al final, sobre el código ya movido.

## Complexity Tracking

| Violación / desvío                         | Por qué es necesario                                                                                     | Alternativa rechazada                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Principio X como deuda declarada           | Decisión del dueño (2026-09-19): mantener X y planificar el puerto como feature del mapa                 | Enmendar X al caso base push                                |
| F-041 rechazado                            | La propuesta rehace `wiring.ts` y los perfiles por un beneficio de legibilidad; la persistencia los toca | Aplicarlo ahora y volver a tocarlo con la persistencia      |
| `gateways-no-cross` gana una excepción     | Un helper compartido de gateways necesita un lugar; el mismo patrón que `shared-kernel` en el mapa       | Copiar el helper (el hallazgo F-033 es justamente la copia) |
| Campo `closure` en el esquema de hallazgos | La trazabilidad del cierre vive con el hallazgo; el esquema es `additionalProperties: false`             | Un archivo aparte de cierres (dos fuentes para un dato)     |
| Renumerar el roadmap del mapa              | 014 y 015 existen como specs; `check:api-map` valida números contra `specs/`                             | Dejar `putFlags` apuntando a la 014 (la auditoría)          |
