# Implementation Plan: Merchants, configuración en tres niveles y administración (017)

**Branch**: `017-merchants-y-configuracion` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-merchants-y-configuracion/spec.md`

## Summary

Convertir a OPE en una plataforma operada: los merchants pasan de una variable de entorno a
una única fuente de verdad detrás de puertos por intención (memoria hoy, Postgres en la 018),
operada por la API de administración con operadores identificados y alcance, y con cada
acción registrada (US1). La configuración se resuelve en tres niveles —plataforma y defaults
de tratamiento como archivos del release validados en CI y legibles por API; merchant como
versiones inmutables publicadas por API— y cada decisión estampa la terna de versiones;
ninguna constante de comportamiento queda en el código (US2). Los experimentos nacen en
calibración, se activan (congelan la configuración salvo versión correctiva con reinicio de
ventana) y se cierran (US3). El SDK obtiene su configuración y reporta anclajes que no
resuelven (US4). Nada de esto exige reiniciar: el servidor se reinicia sólo con un deploy.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`), `typescript` alias a la API 6
para las herramientas (ADR-017); Node 22; scripts `.mjs` con `checkJs`.

**Primary Dependencies**: sin dependencias nuevas. `node:crypto` (ya en uso) para acuñar
credenciales y huellas (SHA-256, `randomBytes`). Fastify + openapi-backend, Ajv, Vitest 5,
Stryker 10, ESLint 10, Spectral/Redocly/oasdiff, Schemathesis.

**Storage**: en memoria, detrás de `MerchantStore`, `ConfigurationStore`, `ExperimentStore`,
`AdminLog`, `AnchorDiagnosticsStore` (R-01, R-12); niveles 1–2 en `config/platform.json` y
`config/treatment-defaults.json` (R-04). Persistencia durable: feature 018.

**Testing**: Vitest (`fast`/`tools`), Stryker sobre lo cambiado (`--files` para iterar),
Schemathesis contra `/v1/` (incluye las operaciones `admin` y `sdk` nuevas: tokens y claves
de prueba en `schemathesis.toml`).

**Target Platform**: servidor Node 22 (Windows en desarrollo, Linux en CI), una instancia.

**Project Type**: web-service contract-first, arquitectura por anillos y módulos (ADR-013).

**Performance Goals**: sin cambio en el camino crítico: la configuración efectiva se sirve
desde memoria (`Promise.resolve`), recalculada al publicar (FR-017); ninguna lectura nueva
por evento. El presupuesto `< 150 ms` p95 (`test:load` informativo) se conserva.

**Constraints**: constitución 1.4.2 (once principios); contrato `building` (los cambios son
aditivos salvo renombres de operaciones `planned`); cero excepciones nuevas de lint, idioma o
mutación; commits por historia en español; sin push hasta la PR, sin merge; el comportamiento
observable de hoy no cambia (las pruebas existentes pasan sin cambiar expectativas, salvo
las que leen las constantes eliminadas o la forma de `OPE_MERCHANTS`).

**Scale/Scope**: 2 módulos nuevos (`configuration`, `admin`), ~20 operaciones nuevas o
editadas en el mapa y el contrato, ~25 esquemas, 9 tipos de problema, 1 motivo de `NO_OP`,
5 puertos de escritura con gateways en memoria, 8 casos de uso de administración + import,
2 archivos de configuración del release, 1 script (`mint-admin-token`), ~10 archivos de
`src/` eliminados (constantes), pruebas de integración por historia + aislamiento admin.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Evaluados los once principios de la constitución v1.4.2.

| Gate                                       | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades               | **Sí**   | Ninguna autoridad nueva decide: `configuration` provee valores, `admin` autoriza operadores; el orquestador y las cinco autoridades no cambian de orden. Un experimento abierto por merchant (R-08)                                                                                                                                                                        |
| II. Fail-closed                            | **Sí**   | Merchant `off` ⇒ `NO_OP merchant-off` antes de asignar (R-07); versión inválida ⇒ 422 sin crear nada; archivo de nivel inválido ⇒ el arranque no ocurre; token desconocido ⇒ 401 antes del cuerpo                                                                                                                                                                          |
| III. La medición precede y no se contamina | **Sí**   | `Experiment.assign` no cambia; nadie cambia un brazo; con experimento activo la configuración se congela (409) y una versión correctiva reinicia la ventana y queda registrada (D-G, R-08); la calibración se marca y se excluye; el DTO del SDK no lleva nada del tratamiento (R-09, R-11)                                                                                |
| IV. Dos caminos, dos garantías             | **Sí**   | Sin I/O nueva en el camino crítico: configuración efectiva en memoria, actualizada en la escritura (FR-017); las escrituras de administración van por puertos con `Result` y nunca lanzan por indisponibilidad                                                                                                                                                             |
| V. Aislamiento por merchant                | **Sí**   | `merchantId` en la ruta sólo bajo `admin` (la excepción de la v1.2.0); alcance del operador juzgado antes del store, sin revelar existencia; pruebas de aislamiento en admin y `getSdkConfig` (FR-025); todo puerto nuevo lleva `merchantId`                                                                                                                               |
| VI. Identidad explícita / contrato primero | **Sí**   | Mapa antes que contrato (R-10); contrato antes que código; `contract:check` en verde por historia; cambio compatible (aditivo) bajo la marca `building`                                                                                                                                                                                                                    |
| VII. Comportamiento, no personas           | **Sí**   | Ningún campo nuevo describe a una persona: `operatorId` es un identificador opaco, el diagnóstico lleva anclaje y tipo de página, la lista blanca del evento no cambia; `pii-denylist.json` vigila los esquemas nuevos                                                                                                                                                     |
| VIII. Cero LLM                             | **Sí**   | Nada nuevo                                                                                                                                                                                                                                                                                                                                                                 |
| IX. Trazabilidad                           | **Sí**   | Cada decisión estampa la terna de versiones y la fase (R-09); cada acción de administración con actor, instante, resultado y versión (R-06); las versiones nunca se sobrescriben                                                                                                                                                                                           |
| X. Puertos en los dos bordes               | **Sí**   | La estrategia por flujo entra como dato del merchant y se estampa; el puerto de plataforma no se construye aquí (019) y el plan lo dice; `getSdkConfig` es el puerto del front sirviendo `AnchorSet` como datos (`01 §3.1.1`)                                                                                                                                              |
| XI. Ninguna política vive en el código     | **Sí**   | Es la historia 2: las constantes inventariadas salen de `src/` a los niveles 1–2; el código conserva invariantes y algoritmos; una prueba de gobernanza impide que vuelvan (`configuration-levels.md`)                                                                                                                                                                     |
| Mapa del contrato / superficie HTTP        | **Sí**   | ~20 operaciones editadas o nuevas como `planned` antes de construirse; `check:api-map` en ambos sentidos; capacidades de `admin` cerradas (R-10)                                                                                                                                                                                                                           |
| Sustantivo nuevo (glosario, ADR-008)       | **Sí**   | Notas nuevas antes del contrato: `operador`, `registro-de-administracion`, `version-de-configuracion`, `configuracion-de-plataforma`, `defaults-de-tratamiento`, `credencial`, `interruptor` (kill switch), `calibracion`, `diagnostico-de-anclajes`; `experimento`, `merchant`, `estrategia-de-sincronizacion`, `locale` ya existen y se actualizan                       |
| `x-invariants` (ADR-007)                   | **Sí**   | `origin-already-registered`, `rotation-grace-too-long`, `reason` obligatorio con `corrective`, invariantes de política emitidas como 422: cada una con tipo propio en el catálogo y prueba `[invariant:<slug>]`                                                                                                                                                            |
| Decisión transversal (ADR-009)             | **Sí**   | ADR nuevo "Merchants operados, tres niveles de configuración y administración" (fuente de verdad detrás de puertos, niveles 1–2 en el release, operadores con alcance, credenciales por huella, calibración y congelamiento); ADR-020 actualizado (`adminToken` decidido); ADR-022 (estados del experimento) y ADR-026/027 (políticas como defaults) con precisión fechada |
| Toca `src/` → dependencias (ADR-013)       | **Sí**   | `CONTEXT_MAP` gana `configuration` y `admin` (R-03); nadie importa `configuration`: los consumidores definen su puerto y la composición enlaza; `admin` importa `merchant`, `configuration`, `experiment` sólo por `index.ts`                                                                                                                                              |
| ADR-023 / ADR-024                          | **Sí**   | Casos de uso con ≤ 6 dependencias (alcance y registro por servicio y decorador, R-06); errores nuevos en `errors.ts` de su módulo con slug en el catálogo; entidades con `of`/`rehydrate` y reglas por nombre (`rotated`, `switched`, `activated`, `scopeFor`)                                                                                                             |
| ADR-016 (gates)                            | **Sí**   | Sin excepciones nuevas; `test:mutation` sobre lo cambiado por historia; prueba de gobernanza nueva con fixture                                                                                                                                                                                                                                                             |
| ADR-015 (idioma)                           | **Sí**   | Todo identificador en inglés (`check:identifiers` vigila las citas); documentos y ADR en castellano                                                                                                                                                                                                                                                                        |

**Resultado pre-Phase 0**: PASA.
**Post-Phase 1**: PASA. El diseño no agrega violaciones; la única excepción que usa
(`merchantId` en la ruta de `admin`) es la que la constitución V ya admite.

## Project Structure

### Documentation (this feature)

```text
specs/017-merchants-y-configuracion/
├── plan.md                    # este archivo
├── research.md                # R-01..R-12
├── data-model.md              # Merchant/Credential, niveles, versiones, Experiment, Operator, AdminEntry, diagnósticos
├── quickstart.md              # cómo verificar cada historia y el cierre
├── contracts/
│   ├── admin-api.md           # mapa, operaciones, esquemas, seguridad
│   ├── configuration-levels.md# archivos del release, qué sale del código, resolución, validación en CI
│   └── sdk-config.md          # getSdkConfig, reportAnchorDiagnostics
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
config/
├── platform.json                                   # nivel 1 (R-04)
├── treatment-defaults.json                         # nivel 2 (R-04)
├── dev-merchants.json                              # semilla de dev (forma nueva: reparto explícito)
└── dev-operators.json                              # operador de dev con huella de token
contracts/
├── api-map.yaml                                    # feature 017: renombres y operaciones nuevas (R-10)
├── openapi.yaml                                    # adminToken en la raíz; rutas admin y sdk; 1.4.0
├── paths/{admin-merchants,admin-merchant,admin-credentials,admin-configuration,admin-experiments,admin-levels,admin-log,admin-diagnostics,sdk-config,sdk-diagnostics}.yaml
├── components/schemas/{Merchant*,Credential*,KillSwitch,MerchantConfiguration*,PlatformConfiguration,TreatmentDefaults,Experiment*,AdminEntry*,AnchorDiagnostic*,SdkConfig,AnchorDiagnosticsReport,...}.yaml
├── components/securitySchemes/adminToken.yaml      # decidido (R-06)
├── problem-types.yaml                              # 9 tipos nuevos
└── no-op-reasons.yaml                              # merchant-off
src/
├── domain/
│   ├── merchant/{merchant,credential,errors}.ts    # status, credenciales con huella y vencimiento, rotated/switched/deactivated
│   ├── configuration/{platform-configuration,treatment-defaults,merchant-configuration-version,effective-configuration,anchor-map,sync-strategy,errors,ids,index}.ts   # nuevo módulo
│   ├── experiment/{experiment,errors}.ts           # calibrating/active/closed, ventana, reinicios
│   ├── admin/{operator,admin-entry,anchor-diagnostic,errors,ids,index}.ts   # nuevo módulo
│   ├── ledger/decision.ts                          # DecisionFacts.configuration, phase
│   └── shared-kernel/{no-op-reasons,time}.ts       # merchant-off; sale CLOCK_SKEW_TOLERANCE_MS
├── application/
│   ├── merchant/ports/{merchant-store,credential-minter}.ts; use-cases/{create-merchant,get-merchant,list-merchants,rotate-credential,set-kill-switch,deactivate-merchant,import-merchants}.use-case.ts
│   ├── configuration/ports/{configuration-store,configuration-levels}.ts; services/{configuration.service}.ts; use-cases/{publish-merchant-configuration,get-merchant-configuration,list-configuration-versions,get-platform-configuration,get-treatment-defaults}.use-case.ts
│   ├── experiment/ports/experiment-store.ts; use-cases/{create-experiment,activate-experiment,close-experiment,list-experiments}.use-case.ts
│   ├── admin/ports/{operator-directory,admin-log,anchor-diagnostics-store}.ts; services/{admin-token.service,admin-scope.service}.ts; decorators/audited-use-case.ts; use-cases/{list-admin-log,list-merchant-admin-log,list-anchor-diagnostics,get-sdk-config,report-anchor-diagnostics}.use-case.ts
│   ├── catalog/ports/catalog-policies.ts; ingestion/ports/ingestion-policies.ts; decision/ports/{policy-directory,decision-windows}.ts   # puertos de lectura de los consumidores
│   └── (eliminados) catalog/policies/{freshness,sync-level}.ts, ingestion/policies/dedup-window.ts, decision/policies/{session,visitor}-window.ts, merchant/policies/signature-window.ts, domain/decision/default-policy.ts, domain/commercial/default-commercial-policy.ts
├── interface-adapters/
│   ├── gateways/merchant/{memory-merchant-store,node-credential-minter}.ts (sale config-merchant-directory)
│   ├── gateways/configuration/{memory-configuration-store,file-configuration-levels}.ts
│   ├── gateways/experiment/memory-experiment-store.ts (sale config-experiment-directory)
│   ├── gateways/admin/{config-operator-directory,memory-admin-log,memory-anchor-diagnostics-store}.ts
│   ├── gateways/decision/ (sale config-policy-directory)
│   ├── http/security/{admin-token,principal}.ts   # OperatorPrincipal, operatorOf
│   ├── http/controllers/{merchant,configuration,experiment,admin}/<operationId>.ts
│   └── http/generated/api.d.ts                     # regenerado
├── composition/
│   ├── config.ts                                   # semilla de merchants y operadores (forma), rutas de los archivos de nivel
│   ├── modules/{merchant,configuration,experiment,admin,decision,catalog,ingestion}.ts   # stores enlazados a directorias; políticas por puerto
│   ├── profiles/local.ts                           # memoria + archivos + import de la semilla
│   └── bootstrap.ts                                # import si el store está vacío
scripts/mint-admin-token.mjs                        # token + huella para OPE_ADMIN_OPERATORS
.dependency-cruiser.cjs                             # CONTEXT_MAP: configuration, admin
docs/adr/031-merchants-operados-y-tres-niveles.md   # nuevo; ADR-020/022/026/027 con precisión
docs/dominio/*.md                                   # notas nuevas y actualizadas
CLAUDE.md                                           # módulos nuevos, operadores, niveles, "sin reinicio"
tests/
├── integration/{admin-merchants,admin-configuration,admin-experiments,sdk-config,isolation}.test.ts
├── unit/{domain/{merchant,configuration,experiment,admin},application/{merchant,configuration,experiment,admin},configuration/release-levels}.test.ts
├── governance/behaviour-constants.test.ts (+ fixture)
├── contract-rules/fixtures/ (si una regla cambia)
└── helpers/test-app.ts                             # semilla por el import; operadores de prueba
```

**Structure Decision**: dos módulos nuevos en los anillos existentes (`configuration`,
`admin`) y ampliación de `merchant` y `experiment`; controllers por módulo dueño del caso de
uso, con el consumidor `admin` como esquema de seguridad transversal cableado por el módulo
`admin` (como `merchant` cablea `ingestKey`/`platformKey`). Los consumidores de configuración
no la importan: definen su puerto y la composición enlaza (patrón `decisionPlaneOf`).

## Complexity Tracking

Sin violaciones que justificar. Dos módulos nuevos son la forma que ADR-013 prevé (una línea
en `MODULES`, una en `CONTEXT_MAP`); el decorador `AuditedUseCase` sigue el patrón de
`LoggedUseCase`; `merchantId` en la ruta es la excepción ya admitida por la constitución V.
