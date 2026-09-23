# Specification Quality Checklist: El porcentaje es un valor con reglas

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23
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

## Notas de la validación

- **"Sin detalles de implementación"** se aplicó a los requisitos y a los criterios de éxito, que
  hablan de qué garantiza el sistema. El **Contexto** cita el defecto medido sin nombrar archivos ni
  identificadores: la evidencia exacta —qué archivo, qué línea, qué constante— vive en el
  `research.md` del plan, que es donde la constitución la pide.
- **El "usuario" es quien escribe el sistema**, no una persona que lo usa. Por eso las historias se
  miden por lo que **deja de poder salir mal** y no por una tarea que alguien completa. La única
  con consecuencia visible hacia afuera es la ausencia de consecuencias: nada cambia.

## Lo que el plan tiene que resolver (no bloquea la spec)

- Si el porcentaje es una clase con fábrica que devuelve `Result`, o un tipo marcado con su
  constructor. La descripción del dueño argumenta a favor de la clase —un objeto no es un número, y
  un número marcado se desmarca en cuanto se hace aritmética— y ADR-024 dice "clase si hay reglas";
  el plan lo confirma o lo contradice con evidencia.
- Si los cortes de un experimento entran al mismo vocabulario o quedan como concepto aparte.
- Si la decisión se registra como ADR nuevo o como enmienda de ADR-024.
- Qué hacer con la forma del identificador de experimento: moverla a la identidad o registrar por
  qué la semilla es más permisiva (US3 admite las dos salidas).
