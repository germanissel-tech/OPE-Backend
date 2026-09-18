# Implementation Plan: Dominio rico e invariantes por construcción

**Branch**: `009-dominio-rico` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-dominio-rico/spec.md`

## Summary

Refactor del anillo de dominio sin cambio de contrato ni de comportamiento: `EventBatch`,
`Decision` (unión `NoOpDecision | InterveneDecision`), `Experiment` (`treatmentShare` 0–1,
`assign`) y `Merchant` (`Origin` normalizado, `owns`, `allowsOrigin`) pasan a clases con
constructor privado, `of(...)` → `Result` y `rehydrate(...)`; las reglas se invocan por su
dueño; la configuración y los gateways construyen por fábrica y fallan cerrado; la ventana de
dedup se declara en aplicación; todo puerto devuelve `Promise`; una regla ESLint con fixture
prohíbe funciones sueltas exportadas en `domain/`; regresión bit a bit de la asignación sobre
100 000 visitantes. Evidencia en [research.md](research.md); decisión en ADR-024.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: ninguna nueva

**Storage**: sin cambio; `rehydrate` se ejercita con los gateways en memoria (que guardan
instancias) y pruebas unitarias

**Testing**: Vitest (unitarias de dominio reescritas contra las clases; regresión de asignación
con fingerprint precomputado; `tests/lint` con fixture de la regla nueva), integración y
Schemathesis **sin cambios en aserciones**, `test:mutation` sobre el diff

**Target Platform**: sin cambio

**Project Type**: web-service

**Performance Goals**: `ingest-latency.test.ts` (p95 ≤ 50 ms) se mantiene; la normalización de
orígenes deja de ocurrir por request (mejora marginal)

**Constraints**: `erasableSyntaxOnly` (campos asignados en el constructor; `private constructor`
es válido); `toEqual` en las pruebas (R-01: ignora el prototipo); el DTO de `Decision` no
cambia; `Result`/`DomainError` de la 008 sin cambios; `new` de clases del dominio en
dominio/aplicación/adaptadores está permitido por `new-only-in-composition` (sólo mira npm)

**Scale/Scope**: 4 aggregates + 1 value object; 2 archivos de errores (nuevo `experiment`,
ampliado `merchant`) + 3 entradas en el catálogo de problemas; 5 puertos con firmas
asíncronas; 3 gateways adaptados; `config.ts` delegando a fábricas; 1 regla ESLint + fixture;
~12 archivos de prueba tocados en la construcción del sujeto; ADR-024; CLAUDE.md

## Constitution Check

| Gate                                          | ¿Aplica? | Cómo se cumple                                                                                                                                                                 |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superficie HTTP → contrato primero            | Parcial  | Ninguna operación ni schema cambia; `problem-types.yaml` gana 3 tipos de configuración (`invalid-treatment-share`, `invalid-seed`, `invalid-origin`) sin operación: compatible |
| Persistencia / API → aislamiento por merchant | No       | `isolation.test.ts` sin cambios en aserciones                                                                                                                                  |
| Plano de decisión / ledger / campos / LLM     | **Sí**   | Asignación idéntica (FR-041, fingerprint); `Decision` sigue registrándose con brazo y experimento; CONTROL sigue `NO_OP control-arm`                                           |
| `x-invariants`                                | No       | Las mismas invariantes con los mismos `code`; ahora las hace cumplir `EventBatch.of`                                                                                           |
| Sustantivo nuevo en el contrato (glosario)    | No       | El contrato no gana sustantivos                                                                                                                                                |
| Toca `src/` → dirección de dependencias       | **Sí**   | Sin cambios en el mapa de contextos; `npm run arch` en 0; regla ESLint `ope/domain-no-loose-functions` con fixture                                                             |
| Privacidad (V, VII)                           | **Sí**   | Los errores nuevos llevan el campo, nunca la clave ni el origen completo en `details`; los logs no cambian                                                                     |
| Calidad verificada por herramienta (ADR-016)  | **Sí**   | Regla con fixture (FR-010); `quality`, `test:mutation`, `release-check` en verde (SC-005)                                                                                      |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/009-dominio-rico/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/ingestion/event-batch.ts        class EventBatch { of(events, now); sessionId; visitorId; events; noOpReason() }  (reemplaza batch.ts + decide.ts)
├── domain/ingestion/no-op-reasons.ts      sin cambio
├── domain/ledger/decision.ts              abstract DecisionBase, NoOpDecision, InterveneDecision, type Decision, DecisionRecord (rehydrate)
├── domain/experiment/experiment.ts        class Experiment { of; rehydrate; assign(visitorId); isActive() }; fnv1a32 y la clave privadas
├── domain/experiment/errors.ts            InvalidTreatmentShare, InvalidSeed + ExperimentError
├── domain/merchant/origin.ts              class Origin { parse; value; equals }
├── domain/merchant/merchant.ts            class Merchant { of; rehydrate; owns(key); allowsOrigin(origin) }
├── domain/merchant/errors.ts              + InvalidOrigin
├── domain/system/health.ts                ServiceHealth (tipo); serviceHealth() desaparece
├── application/ingestion/policies/dedup-window.ts   DEDUP_WINDOW
├── application/**/ports/*.ts              todo Promise
├── application/**/use-cases|services      usan EventBatch.of, experiment.assign, merchant.owns/allowsOrigin, decision.isIntervention/belongsTo
├── interface-adapters/http/controllers/** guarda NaN en la traducción; toDecisionDto sobre la unión
├── interface-adapters/gateways/**         reciben entidades; devuelven Promise; dedup recibe la política
├── infrastructure/http/cors.ts            origin async
└── composition/config.ts, modules/*.ts    fábricas → ConfigError; política de dedup inyectada
scripts/lint/domain-no-loose-functions.mjs + plugin.mjs + eslint.config.mjs (DOMAIN_RULES)
contracts/problem-types.yaml               + 3 tipos de configuración (replicados en problem-details.ts)
docs/adr/024-dominio-rico.md               con el PROPUESTO del stub de decisión → 011
CLAUDE.md                                  "Cómo se escribe una entidad"
tests/
├── unit/domain/**                         reescritas contra las clases (mismas aserciones de negocio)
├── unit/domain/experiment/assignment-regression.test.ts   fingerprint precomputado
├── lint/fixtures/as-src/domain/demo/loose-function.ts
└── integration/**, contract-rules/**      sin cambios en aserciones
```

**Structure Decision**: los módulos y el mapa de contextos no cambian; dentro de cada módulo
de dominio el archivo lleva el nombre del concepto (`event-batch.ts`, `experiment.ts`,
`merchant.ts`, `decision.ts`), y los verbos sueltos desaparecen.

### Comandos npm (cambios)

Ninguno.

## Diseño de los puntos no triviales

- **`EventBatch.of(events, now)`**: mismo orden de comprobación que `checkBatch` (primero
  coherencia, luego tolerancia), mismos errores y mensajes; lote vacío ⇒ `throw` (error de
  programación, el contrato lo impide). `noOpReason()` reemplaza a `decide(batch)`;
  `decideArm(arm, batch)` pasa a ser lógica del caso de uso (`arm === undefined` /
  `"CONTROL"` / `batch.noOpReason()`), porque combina asignación y lote, no es del lote.
- **`Decision`**: `DecisionBase` con `decisionId`, `merchantId`, `sessionId`, `visitorId`,
  `decidedAt`, `experiment?`, `belongsTo(sessionId, visitorId)`, `isIntervention(): this is
InterveneDecision`. `NoOpDecision.of({ …, reason })`, `InterveneDecision.of({ …, intervention })`.
  `Decision.rehydrate(record)` (función estática en `DecisionBase` o un `rehydrateDecision`…
  no: una función suelta violaría la regla; va como `static` de la base) discrimina por
  `outcome`. `toDecisionDto` copia `reason` e `intervention` según la rama.
- **`Experiment.of({ experimentId, merchantId, treatmentShare, seed, status, startedAt })`**:
  `0 ≤ share ≤ 1` y `seed.length > 0`; `assign(visitorId)` con la clave y FNV privados;
  `isActive()`. `treatmentShare = percent / 100` se calcula en `config.ts`.
- **`Merchant.of({ merchantId, ingestKeys, origins: string[] })`**: `Origin.parse` de cada
  origen; el primero inválido ⇒ `fail(new InvalidOrigin(index))`; `allowsOrigin(text)` parsea
  el texto entrante y compara `Origin.equals`; `owns(key)` = clave no vacía incluida.
- **`MerchantDirectory`** conserva `findByIngestKey` e `isRegisteredOrigin` (ahora `Promise`);
  el gateway de configuración recibe `Merchant[]` y usa `merchant.owns(key)` y los `Origin`
  ya normalizados.
- **Errores de configuración en el catálogo**: `invalid-treatment-share`, `invalid-seed`,
  `invalid-origin` con status 500 y título en inglés en `problem-types.yaml` (ningún endpoint
  los emite; la réplica exige que todo `code` exista). Alternativa "excluir errores de
  configuración de la réplica" rechazada: rompe la invariante simple "todo code está en el
  catálogo".
- **CORS asíncrono**: `origin: (origin, cb) => { policy.isRegisteredOrigin(origin).then((ok) =>
cb(null, ok), cb) }`; verificar en `tests/integration/cors.test.ts` (sin cambios).
- **Regla**: `ope/domain-no-loose-functions` (R-04) registrada en `DOMAIN_RULES`.
- **Orden de commits**: (1) puertos asíncronos + política de dedup + gateways/cors (suite verde);
  (2) `Experiment` + `Merchant`/`Origin` + errores + catálogo + `config.ts` + regresión de
  asignación; (3) `EventBatch` + `Decision` + casos de uso/controllers + guarda NaN; (4) regla
  con fixture + limpieza (`serviceHealth`, `activeExperiment`, exports); (5) ADR-024 aceptada,
  CLAUDE.md, quickstart, mutación, PR.

## Complexity Tracking

| Elemento                                         | Por qué                                                                             | Alternativa rechazada                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 3 tipos de problema sin operación                | los errores de configuración son `DomainError` y la réplica exige catálogo completo | eximir errores de configuración: dos clases de `DomainError`, una regla con excepción |
| `rehydrate` sin persistencia real                | fija ahora la vía de reconstrucción para que la 017 no toque el dominio             | agregarlo con la persistencia: la 017 modificaría cuatro aggregates                   |
| Fingerprint precomputado de 100 000 asignaciones | única forma de probar "idéntico bit a bit" sin conservar el código viejo            | comparar con la 007 en CI: requiere dos versiones del código                          |

## Re-evaluación del Constitution Check (post-Phase 1)

Contrato compatible (tres tipos de problema nuevos, ninguna operación), asignación verificada
idéntica, dependencias sin cambios, regla con fixture. **PASA.**
