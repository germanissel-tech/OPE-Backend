# Implementation Plan: Plano de decisión I — barrera y evidencia

**Branch**: `011-plano-de-decision-i` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-plano-de-decision-i/spec.md`

## Summary

Dos módulos nuevos: `barrier` (la autoridad de inferencia: vocabulario cerrado de hechos
`Signals`, álgebra de condiciones, `BarrierRules` validadas por construcción y evaluador puro;
puerto `BarrierInference`) y `decision` (el orquestador `DecisionService` que recorre asignación
→ inferencia → evidencia → veredicto → ledger, la `DecisionPolicy` por merchant con política
por defecto, el `SessionState` y sus puertos). `ingestion` declara el puerto `DecisionPlane` y
deja de decidir; `ledger` registra la inferencia en cada decisión; `catalog` responde también
por producto sin variante. Primera `INTERVENE` real con anclaje por barrera y mensaje
placeholder; sin operaciones nuevas; seis motivos NO_OP nuevos; `Anchor`/`Intervention` al
kernel (cierra ADR-024). Evidencia en [research.md](research.md); decisiones en ADR-026.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: ninguna nueva (motor de reglas propio en el dominio, R-04)

**Storage**: en memoria: `DecisionPolicyDirectory` desde configuración; `SessionStateStore`
por merchant con ventana `SESSION_WINDOW` (24 h / 100 000 sesiones); `rehydrate` para 017

**Testing**: Vitest (dominio: álgebra por tabla, señales como monoide, invariantes de reglas y
política, veredicto por tabla de las historias, política por defecto; aplicación:
`DecisionService` con puertos falsos y ledger caído; integración: plano completo hasta
`confirmExposure`, evidencia con catálogo y reloj, aislamiento, configuración, latencia),
réplicas contra el contrato (motivos, anclajes, barreras, vocabulario de eventos),
`test:mutation`, `test:contract` (sin operación nueva: Schemathesis sigue igual)

**Target Platform**: sin cambio

**Project Type**: web-service (backend HTTP contract-first)

**Performance Goals**: SC-004 — p95 de ingesta ≤ 50 ms con la inferencia activa; inferencia
`O(reglas × predicados)` sobre mapas agregados, sin I/O nuevo (R-09)

**Constraints**: sin red ni escritura bloqueante en el camino crítico (constitución IV);
inferencia pura (sin reloj ni puertos, FR-013); misma inferencia para ambos brazos
(constitución III); el DTO del SDK no lleva barrera, confianza ni señales (FR-040); contrato
compatible (descripciones + catálogo de motivos; versión sigue 1.x)

**Scale/Scope**: 2 módulos nuevos (`barrier`, `decision`) en dominio, aplicación, gateways y
composición; 1 puerto nuevo en `ingestion` (`DecisionPlane`); 1 servicio nuevo en `ledger`
(`DecisionRecorder`); `DecisionFacts.inference`; 2 vocabularios en el kernel (`Barrier`,
`Anchor`/`Intervention` movidos); 6 listas runtime en `ingestion`; 6 motivos NO_OP; 11 tipos de
problema de configuración; `MerchantConfig.decisionPolicy`; 6 notas de glosario; ADR-026;
cierre de 2 PROPUESTO (ADR-024) y de los del contrato (`Decision`, `Intervention`)

## Constitution Check

| Gate                                                  | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades                          | **Sí**   | Inferencia en `barrier`, evidencia en `catalog`, asignación en `experiment`, veredicto + orquestación en `decision` (R-02); el orquestador arma `DecisionContext` e invoca en orden; ninguna autoridad fuerza una intervención: sólo `verdict` emite      |
| II. Fail-closed, `NO_OP` con motivo                   | **Sí**   | Todo paso termina en `NO_OP` con motivo del catálogo (FR-003); stock como guardia (`variant-unavailable`, nunca claim); ledger caído ⇒ intervención suprimida (ADR-021)                                                                                   |
| III. Medición: misma inferencia para ambos brazos     | **Sí**   | La inferencia corre y se registra antes de mirar el brazo (R-04); CONTROL ⇒ `control-arm` con `inference` en el ledger; `policyVersion` estampada en cada decisión (versionado de configuración)                                                          |
| IV. Camino crítico sin red ni escritura bloqueante    | **Sí**   | Política y estado de sesión en memoria; verdad desde la caché de 010; latencia probada (SC-004)                                                                                                                                                           |
| V. Aislamiento por merchant                           | **Sí**   | Política por merchant; estado de sesión con clave `merchantId/sessionId`; `isolation.test.ts` ampliada (SC-005)                                                                                                                                           |
| VII. Sin datos personales                             | **Sí**   | Señales agregadas de comportamiento (conteos, permanencias, secuencias); nada nuevo viaja ni se loguea                                                                                                                                                    |
| VIII. Cero LLM                                        | **Sí**   | Reglas tipadas y mensaje placeholder                                                                                                                                                                                                                      |
| IX. Trazabilidad en el ledger                         | **Sí**   | `DecisionFacts.inference`: versión de política, confianzas de las tres barreras, reglas cumplidas, barrera, disparador, evidencia consultada (R-06)                                                                                                       |
| Mapa del contrato / superficie HTTP                   | **Sí**   | Sin operaciones nuevas; el mapa no cambia; contrato: descripciones + catálogo de motivos ([contracts/](contracts/)); `contract:check` verde (compatible)                                                                                                  |
| Sustantivo nuevo en el contrato (glosario)            | **Sí**   | `barrera` (aparece en `Decision.outcome`), `señal`, `evidencia`, `confianza`, `politica-de-decision`, `intencion` en `docs/dominio/` antes del contrato                                                                                                   |
| `x-invariants`                                        | No       | Ninguna regla nueva sobre un body; los errores nuevos son de configuración (500, nunca por HTTP), como los de `Experiment`                                                                                                                                |
| Toca `src/` → dirección de dependencias               | **Sí**   | `barrier: [shared-kernel, ingestion]`, `decision: [shared-kernel, ledger, experiment, ingestion, catalog, barrier]`; `ingestion` no importa `decision` (puerto `DecisionPlane`, R-02); `no-circular` en 0; `barrierModule`, `decisionModule` en `MODULES` |
| ADR-023 / ADR-024 (forma de casos de uso y entidades) | **Sí**   | `DecisionService`, `DecisionRecorder`, `RuleBasedBarrierInference` son servicios (≤ 6 deps); `BarrierRules`, `DecisionPolicy`, `SessionState`, `Signals` clases con `of`/`rehydrate`; errores en `errors.ts` y en el catálogo                             |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA (ver abajo).

## Project Structure

### Documentation (this feature)

```text
specs/011-plano-de-decision-i/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── no-op-reasons.additions.yaml       # 6 motivos nuevos
│   ├── problem-types.additions.yaml       # 11 errores de configuración de la política
│   ├── decision-description.yaml          # descripciones de Decision / Intervention (cierra PROPUESTO)
│   └── decision-policy.config.md          # forma de OPE_MERCHANTS[i].decisionPolicy
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/shared-kernel/{barrier.ts, intervention.ts, no-op-reasons.ts, index.ts}
│     BARRIERS/Barrier; ANCHORS/Anchor/Intervention (desde ledger); + 6 motivos
├── domain/ingestion/{event.ts, event-batch.ts, index.ts}
│     listas EVENT_TYPES, BLOCKS, PHOTO_INTERACTIONS, CTA_APPROACHES, CHECKOUT_STEPS, EXIT_SIGNALS (as const);
│     EventBatch.focus(); noOpReason() eliminado
├── domain/barrier/{signals.ts, condition.ts, barrier-rules.ts, errors.ts, index.ts}
├── domain/decision/{decision-policy.ts, default-policy.ts, session-state.ts, errors.ts, index.ts}
├── domain/ledger/{decision.ts, index.ts}          DecisionFacts.inference; Anchor/Intervention importados del kernel
├── application/ingestion/ports/decision-plane.ts  DecisionPlane { decide({ merchantId, batch, now }) }
├── application/ingestion/use-cases/ingest-batch.use-case.ts   deps { clock, eventDedup, decisionPlane }
├── application/barrier/{ports/barrier-inference.ts, services/rule-based-inference.service.ts, index.ts}
├── application/decision/{ports/decision-policy-directory.ts, ports/session-state-store.ts,
│     policies/session-window.ts, services/decision.service.ts, index.ts}
├── application/ledger/services/decision-recorder.service.ts   DecisionRecorder / DefaultDecisionRecorder
├── application/catalog/services/product-truth.service.ts      + product(merchantId, productId); ProductTruth "known-product"
├── interface-adapters/gateways/decision/{config-decision-policy-directory.ts, memory-session-state-store.ts}
├── interface-adapters/http/controllers/ingestion/ingest-events.ts   Intervention desde el kernel (DTO sin cambios)
├── composition/{config.ts (+ parseDecisionPolicy, FIELD_BY_CODE), ports.ts, modules/{barrier,decision,ingestion,index}.ts, profiles/local.ts}
.dependency-cruiser.cjs                             CONTEXT_MAP: barrier, decision
contracts/                                          no-op-reasons.yaml, problem-types.yaml, components/schemas/{Decision,Intervention}.yaml (descripciones)
docs/adr/026-politica-de-decision-por-merchant.md; ADR-024 (PROPUESTO cerrados); ADR-022 (nota: la política es parte del experimento)
docs/dominio/{barrera,senal,evidencia,confianza,politica-de-decision,intencion}.md
config/dev-merchants.json                           treatmentPercent 100 en dev (para probar a mano; documentado)
tests/
├── unit/domain/barrier/{condition,signals,barrier-rules}.test.ts
├── unit/domain/decision/{decision-policy,verdict,default-policy,session-state}.test.ts
├── unit/domain/ingestion/event-batch.test.ts (focus; sin noOpReason)
├── unit/application/decision/decision.service.test.ts
├── unit/application/ledger/decision-recorder.service.test.ts
├── unit/application/catalog/product-truth.service.test.ts (+ product)
├── unit/{no-op-reasons,anchors,barriers,event-vocabulary}.test.ts   réplicas
├── unit/composition/config.test.ts (+ decisionPolicy)
├── integration/{decision-plane,decision-evidence}.test.ts
├── integration/isolation.test.ts (+ política y sesión)
└── integration/ingest-latency.test.ts (+ caso con señales)
```

**Structure Decision**: dos módulos con la forma de 008–010 (aggregates `of`/`rehydrate`,
`errors.ts`, servicios + puertos + políticas, gateways en memoria, `modules/<x>.ts` con slice y
bindings). La novedad estructural es el puerto `DecisionPlane` en `ingestion` (inversión de
dependencia para que el consumidor no conozca al plano, R-02) y que `barrier` y `decision` no
sirven operación HTTP (como `experiment`).

### Comandos npm (cambios)

Ninguno nuevo.

## Diseño de los puntos no triviales

- **Orden en `DecisionService.decide`** (R-02, R-04, R-07): asignación → si `LedgerUnavailable`
  ⇒ `NO_OP ledger-unavailable` sin registrar; política del merchant; estado de sesión
  (`load ?? empty`) `absorb(Signals.of(batch.events))`; `focus = batch.focus()`; sin producto ⇒
  veredicto `page-context-incomplete` sin inferencia; verdad (`lookup` con variante, `product`
  sin ella) → `ProductFacts` + `TruthSummary`; `inference.infer({ rules, signals, product })`;
  `policy.verdict({ arm, inference, abandoned, truth, focusHasVariant, interventionsSoFar,
enteredCheckout, addedToCart })`; `recorder.record(...)`; `sessions.save` (con la intervención
  contada sólo si el ledger la aceptó).
- **Veredicto** (orden fijo): experimento ausente → CONTROL → alta intención → presupuesto →
  dominante (umbral, prioridad) o abandono sin señal → evidencia (missing / stale por clase /
  variante no disponible / sin variante cuando se exige) → `intervene`. CONTROL y alta
  intención devuelven el `NO_OP` **con** la barrera candidata en el ledger.
- **`Signals` como monoide** (R-03): el lote se agrega una vez y se funde con la sesión; la
  inferencia evalúa sobre la sesión acumulada. `sequence(a, b)` = `firstAt(a) < lastAt(b)`.
  Un evento con subtipo cuenta por `tipo` y por `tipo:subtipo`.
- **Validación en runtime del vocabulario** (SC-003): `BarrierRules.of` recorre cada
  `Condition` y verifica `type ∈ EVENT_TYPES`, `subtype ∈ SUBTYPES[type]`, `block ∈ BLOCKS`;
  `unknown-fact` lleva `details.path` (`rules[2].when.all[1].block`) e `index`; `config.ts` lo
  traduce a `merchants[i].decisionPolicy.rules[2].when.all[1].block`.
- **Política por defecto**: `DEFAULT_DECISION_POLICY` construida con `DecisionPolicy.of` al
  cargar el módulo (`throw` si fallara: error de programación); prueba que verifica los
  valores del stakeholder y que cada regla de [spec.md § Assumptions](spec.md#assumptions)
  existe con su id.
- **Ledger**: `DecisionFacts.inference?` (tipado con `Barrier` del kernel y strings; sin
  depender de `barrier`/`catalog`); `DecisionRecorder` acuña el id y escribe; el `rehydrate`
  conserva `inference`. `toDecisionDto` no cambia (copia campos explícitos: FR-040 se prueba).
- **`EventBatch.focus()`**: último evento con `page.pageType === "product"`; `undefined` si no
  hay; `page-context-incomplete` cuando hay ficha sin `productId` (misma regla que el stub,
  ahora en el plano).
- **Configuración**: `parseDecisionPolicy(raw, at)` valida forma (tipos primitivos, listas,
  objeto recursivo de `when` con claves permitidas) y construye `BarrierRules.of` →
  `DecisionPolicy.of`; `FIELD_BY_CODE` gana los 11 códigos; `MerchantConfig.decisionPolicy?`.
  `configDecisionPolicyDirectory(merchants)` responde la del merchant o la por defecto.
- **Kernel**: `intervention.ts` (`ANCHORS`, `Anchor`, `Intervention`) y `barrier.ts`
  (`BARRIERS`, `Barrier`); `ledger`, `decision`, el controller y `confirmExposure` importan del
  kernel; `tests/unit/anchors.test.ts` y una réplica nueva `barriers.test.ts` (contra la
  descripción del contrato: los tres slugs listados en `Decision.outcome`).
- **Contrato**: sólo descripciones y `no-op-reasons.yaml` → `contract:diff` compatible; los
  PROPUESTO de `Decision.yaml` e `Intervention.yaml` se cierran.
- **Orden de commits**: (1) `refactor(kernel)`: `Anchor`/`Intervention`/`Barrier` al kernel,
  listas runtime de eventos + réplica, `DecisionFacts.inference`, `DecisionRecorder`,
  `ProductTruthService.product` (suite verde, sin cambio de comportamiento); (2)
  `feat(barrier)`: dominio + puerto + servicio + pruebas (sin cablear); (3) `feat(decision)`:
  dominio + servicio + puertos + gateways + configuración + `DecisionPlane` en ingesta +
  composición + contrato (motivos, descripciones) + glosario + integración + aislamiento; (4)
  `docs`: ADR-026, cierre ADR-024, CLAUDE.md, quickstart con estado de cierre.

## Complexity Tracking

| Elemento                                           | Por qué                                                                                                              | Alternativa rechazada                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Dos módulos (`barrier` + `decision`) en vez de uno | constitución I: cada autoridad en su módulo; el merchant configura reglas (barrier) y veredicto (decision) distintos | un módulo `decision` con la inferencia adentro: la autoridad de barrera no sería reemplazable ni verificable por separado   |
| Puerto `DecisionPlane` en `ingestion`              | evita el ciclo `ingestion ⇄ decision` y deja al consumidor dueño de su contrato de entrada/salida                    | `ingestion` importa `decision`: ciclo (`no-circular`); mover la operación al plano: la ingesta pierde su operación          |
| Motor de reglas propio                             | vocabulario cerrado validado por construcción, puro, sin npm en el dominio (`arch`)                                  | `json-rules-engine`/`rulepilot`: vocabulario abierto, `any`, dependencia npm en el dominio; criterio de revisión en ADR-026 |
| `Signals` como monoide en sesión                   | una sola agregación sirve al lote y a la sesión; `sequence` exacta con `firstAt`/`lastAt`                            | guardar la lista de eventos de la sesión: crece sin límite y duplica lo que el ledger no necesita                           |
| `DecisionRecorder` (servicio)                      | `DecisionService` superaría 6 dependencias; acuñar id + escribir es una unidad                                       | relajar el límite: ADR-023 lo prohíbe                                                                                       |

## Re-evaluación del Constitution Check (post-Phase 1)

Autoridades separadas por módulo con un orquestador que sólo transporta el contexto; inferencia
pura e idéntica para ambos brazos, registrada con la versión de política; fail-closed en cada
paso con motivo del catálogo; sin red en el camino; aislamiento probado; contrato compatible.
**PASA.**
