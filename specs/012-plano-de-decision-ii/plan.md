# Implementation Plan: Plano de decisión II — selección, quality gate y política comercial

**Branch**: `012-plano-de-decision-ii` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-plano-de-decision-ii/spec.md`

## Summary

Dos módulos de dominio nuevos que completan las cinco autoridades del camino crítico:
`selection` (catálogo cerrado de candidatos por barrera con sus claims, perfil de evidencia
del merchant y `QualityGate.judge` puro) y `commercial` (`CommercialPolicy` por merchant,
versionada y validada por construcción, con `verdict` como única salida final: techo,
escalones, margen, riesgo de devolución, alta intención, cooldown, fatiga y el abandono como
amplificador, D-B). `DecisionPolicy` queda con la inferencia; `DecisionService` recorre
asignación → inferencia → evidencia → selección + gate → política comercial → ledger; nace el
estado por visitante; `Intervention.incentive` entra al contrato; el ledger registra
candidatos, veredictos y versiones. Evidencia en [research.md](research.md); decisiones en
ADR-027.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 (sin cambio)

**Primary Dependencies**: ninguna nueva

**Storage**: en memoria: `VisitorStateStore` por merchant con `VISITOR_WINDOW` (24 h /
100 000); `SessionState` gana `lastInterventionAt`; políticas y perfil desde configuración

**Testing**: Vitest (dominio: candidatos, gate por tabla, política comercial por tabla e
invariantes, `barrierVerdict`; aplicación: `DecisionService` con dobles; integración: gate,
incentivo, bloqueos, fatiga, cooldown, la suite de la 011 sin cambios de `outcome`/`reason`,
aislamiento, configuración, latencia), réplicas contra el contrato, `test:mutation`,
`test:contract`

**Target Platform**: sin cambio · **Project Type**: web-service contract-first

**Performance Goals**: SC-005 — p95 de ingesta ≤ 50 ms con las cinco autoridades (R-09)

**Constraints**: gate y política comercial puros (sin reloj ni puertos: `now` viaja en el
input); misma selección para ambos brazos (constitución III); el DTO del SDK sólo gana
`intervention.incentive` (FR-051); contrato compatible (propiedad opcional nueva + catálogos)

**Scale/Scope**: 2 módulos de dominio nuevos; `decision` refactorizado (`barrierVerdict`,
`PolicyDirectory` → `MerchantPolicies`, `StateService`, `VisitorState`); `ledger` +
`DecisionFacts.selection`; kernel + `Incentive`; 1 schema nuevo, 3 motivos NO_OP, 7 tipos de
problema de configuración; `MerchantConfig` + `commercialPolicy`, `evidenceProfile`;
10 notas de glosario; ADR-027

## Constitution Check

| Gate                                                | ¿Aplica? | Cómo se cumple                                                                                                                                                                                           |
| --------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Separación de autoridades                        | **Sí**   | `selection` (selección + gate) y `commercial` (política comercial) en módulos propios; el orquestador transporta el contexto; sólo `CommercialPolicy.verdict` emite el veredicto final (R-02, R-05)      |
| II. Fail-closed                                     | **Sí**   | Perfil ausente ⇒ todo falso; margen ausente ⇒ sin incentivos; gate sin relajación por configuración (no conoce techo ni margen); `UNACCEPTABLE` como tipo de falla; todo `NO_OP` con motivo del catálogo |
| III. Misma inferencia y selección para ambos brazos | **Sí**   | Selección, gate y política corren para CONTROL; el veredicto es `control-arm` después de registrar; `commercialPolicyVersion` estampada (configuración versionada)                                       |
| IV. Camino crítico sin red                          | **Sí**   | Estado por visitante en memoria; sin I/O nuevo; latencia probada                                                                                                                                         |
| V. Aislamiento por merchant                         | **Sí**   | Política comercial y perfil por merchant; estado por visitante con clave `merchantId/visitorId`; `isolation.test.ts` ampliada                                                                            |
| VII. Sin datos personales                           | **Sí**   | `VisitorState` guarda instantes de intervención por `visitorId` (seudónimo del SDK), nada más                                                                                                            |
| VIII. Cero LLM                                      | **Sí**   | Candidatos cerrados; textos con la 015                                                                                                                                                                   |
| IX. Trazabilidad                                    | **Sí**   | `DecisionFacts.selection`: candidatos con veredicto y motivo, elegido, veredicto comercial, versión (R-07)                                                                                               |
| Mapa del contrato / superficie HTTP                 | **Sí**   | Sin operaciones nuevas; `Incentive.yaml` + `Intervention.incentive` (compatible); catálogo de motivos; `contract:check` verde                                                                            |
| Sustantivo nuevo (glosario)                         | **Sí**   | `incentivo` (aparece en el contrato), `candidato`, `claim`, `quality-gate`, `escalera-del-incentivo`, `politica-comercial`, `techo`, `margen`, `riesgo-de-devolucion`, `cooldown`, `fatiga`              |
| `x-invariants`                                      | No       | Sin reglas nuevas sobre un body                                                                                                                                                                          |
| Toca `src/` → dependencias                          | **Sí**   | `selection: [shared-kernel]`, `commercial: [shared-kernel, barrier, selection]`, `decision` suma ambos; `selection` no importa `commercial`; `arch` en 0                                                 |
| ADR-023 / ADR-024                                   | **Sí**   | `CommercialPolicy` aggregate con `of`/`rehydrate`; `QualityGate` estático puro; `VisitorState` clase; `StateService` para no pasar de 6 dependencias; errores en `errors.ts` y en el catálogo            |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/012-plano-de-decision-ii/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── Incentive.yaml, intervention.additions.yaml
│   ├── no-op-reasons.additions.yaml, problem-types.additions.yaml
│   └── commercial-policy.config.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/shared-kernel/{intervention.ts (+ Incentive), no-op-reasons.ts (+3)}
├── domain/barrier/{condition.ts (+ Conditions.check público), barrier-rules.ts (lo usa), index.ts}
├── domain/selection/{candidate.ts, profile.ts, quality-gate.ts, index.ts}
├── domain/commercial/{commercial-policy.ts, default-commercial-policy.ts, errors.ts, index.ts}
├── domain/decision/{decision-policy.ts (barrierVerdict; sin lo comercial), default-policy.ts, session-state.ts (+ lastInterventionAt), visitor-state.ts, index.ts}
├── domain/ledger/decision.ts (+ DecisionSelection, DecisionFacts.selection)
├── application/decision/{ports/policy-directory.ts, ports/visitor-state-store.ts, policies/visitor-window.ts, services/state.service.ts, services/decision.service.ts, index.ts}
├── interface-adapters/gateways/decision/{config-policy-directory.ts, memory-visitor-state-store.ts}
├── composition/{condition-config.ts, decision-policy-config.ts, commercial-policy-config.ts, config.ts, modules/decision.ts, profiles/local.ts}
.dependency-cruiser.cjs                     CONTEXT_MAP: selection, commercial, decision
contracts/                                   components/schemas/{Incentive,Intervention}.yaml, no-op-reasons.yaml, problem-types.yaml, examples (intervención con incentivo)
docs/adr/027-seleccion-quality-gate-y-politica-comercial.md; ADR-026 (nota: lo comercial se separó)
docs/dominio/{incentivo,candidato,claim,quality-gate,escalera-del-incentivo,politica-comercial,techo,margen,riesgo-de-devolucion,cooldown,fatiga}.md
config/dev-merchants.json                    evidenceProfile + commercialPolicy con margen
tests/
├── unit/domain/selection/{candidates,quality-gate}.test.ts
├── unit/domain/commercial/{commercial-policy,verdict,default-policy}.test.ts
├── unit/domain/decision/{decision-policy,verdict→barrier-verdict,default-policy,session-state,visitor-state}.test.ts
├── unit/application/decision/{decision.service,state.service}.test.ts
├── unit/gateways/{config-policy-directory,memory-visitor-state-store}.test.ts
├── unit/composition/config.test.ts (+ commercialPolicy, evidenceProfile, campos migrados rechazados)
├── integration/{commercial-policy.test.ts, decision-plane.test.ts (ids con escalón), isolation.test.ts (+ comercial/visitante)}
└── unit/{no-op-reasons,anchors,barriers}.test.ts (réplicas)
```

**Structure Decision**: dos módulos de dominio sin capa de aplicación (reglas puras que el
orquestador invoca, como `DecisionPolicy`), con la forma de la 011. El único cambio de
estructura en `decision` es `StateService` (sesión + visitante) y `PolicyDirectory`
(`MerchantPolicies`) para mantener seis dependencias en el orquestador.

### Comandos npm (cambios)

Ninguno nuevo.

## Diseño de los puntos no triviales

- **Orden en `DecisionService.decide`**: asignación (caída ⇒ `unrecorded`) → `policiesFor` →
  `state.recall` (sesión absorbe el lote; visitante) → foco (sin foco ⇒ `page-context-incomplete`,
  sin inferencia ni selección) → verdad → inferencia → `decision.barrierVerdict` →
  `barrier = verdict.barrier ?? commercial.fallbackBarrier(undefined, abandoned)` (trigger
  `abandonment`) → `judged = barrier ? QualityGate.judgeAll(CANDIDATES[barrier], evidence,
profile) : []` → `commercial.verdict({...})` → `record` con `inference` y `selection` →
  `remember` (sesión con `withIntervention(now)` y visitante `withIntervention(now)` sólo si el
  ledger aceptó una intervención).
- **`barrierVerdict`** (lo que queda de `verdict`): candidata dominante por umbral/prioridad
  (`trigger: "rules"`) y `evidenceReason` por barrera (`evidence-missing` / `evidence-stale` /
  `variant-unavailable`, como en 011); ya no mira brazo, intención ni presupuesto.
- **`GateEvidence` desde `ProductTruth`**: `attributes` del producto (o vacío), `stockAndPriceFresh
= freshness.stockAndPrice === "fresh"`, `hasVariant = kind === "known"`, `available` de la
  variante.
- **Escalón habilitado (D-B)**: índice del primer aceptable `i`; si `abandoned && trigger ===
"rules"`, se toma el primer aceptable con índice `> i` si existe, si no el de índice `i`; con
  `price` y `directIncentiveOnPrice`, primero el de incentivo si es aceptable. Bloqueos
  económicos sólo sobre `step === "incentive"`; si se bloquea, se elige el siguiente aceptable
  no económico; si no hay, `commercial-policy-blocked` con `blocked: { candidateId, reason }`.
- **Cooldown y presupuesto**: `session.interventions ≥ interventionsPerSession` o
  `now − lastInterventionAt < cooldownSeconds` ⇒ `session-budget-exhausted`; `visitorInterventions
≥ interventionsPerVisitorPerDay` ⇒ `visitor-fatigue`.
- **`Conditions.check`** en `barrier` (público): reutilizado por `BarrierRules.of` y por
  `CommercialPolicy.of` (`invalid-return-risk` con el `path`).
- **Configuración**: `condition()` sale de `decision-policy-config.ts` a `condition-config.ts`;
  `commercial-policy-config.ts` parsea la política comercial; `config.ts` parsea
  `evidenceProfile` y rechaza `highIntent`/`abandonment`/`interventionsPerSession` dentro de
  `decisionPolicy` con `ConfigError` (campo migrado).
- **Contrato**: `Incentive.yaml` nuevo referenciado desde `Intervention.yaml`; ejemplo de
  `IngestResult` con intervención sin incentivo (sigue) y un ejemplo nuevo con incentivo;
  `contract:types`; el controller copia `intervention` completa (ya lo hace).
- **Orden de commits**: (1) `refactor(decision)`: `Conditions.check`, `barrierVerdict`,
  `MerchantPolicies`/`PolicyDirectory`, `StateService`, `VisitorState` + store, `Incentive`
  en kernel y contrato, `DecisionSelection` en ledger, motivos NO_OP (suite verde con
  comportamiento intacto); (2) `feat(selection)`: candidatos, perfil, gate + pruebas; (3)
  `feat(commercial)`: política comercial, veredicto, configuración, orquestador con las cinco
  autoridades, integración, aislamiento, glosario; (4) `docs`: ADR-027, nota en ADR-026,
  CLAUDE.md, quickstart de cierre.

## Complexity Tracking

| Elemento                                     | Por qué                                                                         | Alternativa rechazada                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Dos módulos de dominio más                   | constitución I: selección + gate y política comercial son autoridades distintas | gate dentro de `commercial`: el gate conocería techo y margen y podría relajarse por configuración |
| `fallbackBarrier` en la política comercial   | el reaseguro por abandono es una decisión comercial, no una inferencia          | dejarlo en `DecisionPolicy`: mezcla lo que la spec separa (FR-034)                                 |
| `StateService` y `PolicyDirectory` agregados | mantener ≤ 6 dependencias en el orquestador (ADR-023)                           | relajar el límite: prohibido                                                                       |
| `Incentive` en el DTO sin mecánica de cupón  | el SDK debe poder mostrarlo ya; la redención es de la plataforma (013/014)      | esperar a la 013: dejaría la escalera sin su último escalón en el piloto                           |

## Re-evaluación del Constitution Check (post-Phase 1)

Cinco autoridades en módulos propios con un orquestador que sólo transporta; gate puro y sin
relajación; política comercial única emisora del veredicto y versionada; fail-closed en
margen, perfil y evidencia; misma selección para ambos brazos; trazabilidad completa en el
ledger; contrato compatible; aislamiento probado. **PASA.**
