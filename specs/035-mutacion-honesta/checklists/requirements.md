# Specification Quality Checklist: El gate de mutación no informa números de otra corrida

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-30
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

**Quién es el usuario de esta feature, que es lo que hace que la lista se pueda tachar**: la persona que
corre el gate de mutación y lee su salida. No es una feature de producto, así que "valor para el negocio"
se lee como "el gate dice la verdad sobre lo que verificó" — que es lo que sostiene la regla de ADR-016 de
que un cambio no entra si un mutante suyo sobrevive.

**Sobre la primera línea de la lista**: la spec nombra la fecha de modificación de un archivo y un código
de salida, que son observables de la herramienta y no decisiones de implementación — cualquier
implementación del gate tiene las dos cosas a mano. No nombra el script, ni el lenguaje, ni la biblioteca
de pruebas.

**La suposición que hay que releer si algo cambia** está marcada en la spec: un código distinto de 0
significa hoy "no terminó" porque la configuración no fija un umbral que rompa. Si se fijara, el gate
tendría que distinguir dos clases de código distinto de 0.
