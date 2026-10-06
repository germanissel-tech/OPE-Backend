# Specification Quality Checklist: La durabilidad se verifica en CI

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-06
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

Dos cosas que la validación obligó a cambiar, y quedan dichas porque el plan las va a encontrar:

- **El nombre de los archivos y de los comandos no está en la spec, y eso es a propósito.** La primera
  redacción decía «el job `durability` del workflow» y «`vitest.config.ts`»: eso es cómo, no qué. Lo que la
  spec exige es que el resultado se identifique por sí mismo (FR-002) y que la declaración viva donde una
  verificación la lea (FR-004); qué archivo es cada cosa lo decide el plan.
- **Las tres mediciones se nombran en «El hueco, medido» y no en los requisitos.** Ahí son evidencia del
  estado actual —que es lo que hace defendible la feature— y no la lista que el código va a leer; esa lista
  es una entidad (`Declaración de mediciones`) y su contenido se verifica en los dos sentidos (FR-006), así
  que escribirla también acá la condenaría a quedar vieja.

Lo que **no** quedó resuelto y el plan tiene que decidir, sin que sea una ambigüedad de la spec: si la
elección de suites por cambio (hoy entre dos proyectos) crece para incluir la durabilidad o si la durabilidad
se verifica aparte y esa elección no se toca. La spec sólo exige que se verifique siempre (FR-001) y que se
distinga (FR-002); las dos formas lo cumplen y la diferencia es de diseño.
