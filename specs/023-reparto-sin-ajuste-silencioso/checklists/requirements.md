# Specification Quality Checklist: El reparto no se ajusta en silencio

**Purpose**: Validar que la especificación está completa antes de planificar
**Created**: 2026-09-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Tres pasadas de validación; lo que se corrigió en cada una:

**Pasada 1 — detalles de implementación.** La versión inicial nombraba clases, archivos y el
número 100 en los requisitos (`Experiment.of`, `TreatmentValues`, `ASSIGNMENT_BUCKETS`,
`Math.round`). Se reescribieron en términos de la capacidad: «el sistema rechaza un reparto que no
resuelve exactamente a uno de los baldes», «la regla se conoce en un solo lugar, el mismo que sabe
en cuántos baldes se divide la población». Los nombres de campo del contrato (`treatmentShare`,
`holdoutShare`) se conservan a propósito: son vocabulario del producto, no de la implementación, y
son lo que un operador ve en el error.

**Pasada 2 — criterios verificables sin conocer la implementación.** SC-002 decía «los 101 valores
pasan `isBucketAligned`»; ahora dice qué se acepta y cuántos son, sin nombrar quién lo juzga.
SC-006 decía «cero apariciones de `ASSIGNMENT_BUCKETS` fuera de su archivo»; ahora dice «un solo
lugar sabe en cuántos baldes se divide la población», que es la propiedad y no la forma de
buscarla.

**Pasada 3 — límites del alcance con su motivo.** Se separó `## Out of Scope` de las asunciones y
cada exclusión lleva **por qué** queda afuera, no sólo que queda: los cortes y las tasas
comerciales se excluyen porque ningún algoritmo las cuantiza, y ésa es la razón por la que la regla
no les aplica. Sin el motivo, la exclusión se lee como arbitraria y el plan la revierte.

Ningún `[NEEDS CLARIFICATION]`: las tres decisiones que podían quedar abiertas —motivo propio o
ampliado, dónde vive la regla, cómo se juzga sin dividir— tienen una respuesta por defecto
defendible y medida, registrada en `## Assumptions` para que el plan la confirme o la contradiga
con evidencia.
