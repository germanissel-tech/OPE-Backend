# Specification Quality Checklist: Deudas técnicas del tooling y las skills

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-21
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — el spec nombra la skill actual y
      sus rutas porque **son el objeto de la deuda**; no prescribe el esquema del perfil ni el
      código de los adaptadores (eso es del plan)
- [x] Focused on user value and business needs — el valor es para el ingeniero que dirige
      proyectos construidos por agentes: la misma auditoría en cualquier repo, y un repo
      auditable en minutos
- [x] Written for non-technical stakeholders — dentro de lo que admite una feature de tooling
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — las decisiones abiertas (convivencia con la
      copia actual, nombre y esquema del perfil, clasificación de evals) están delegadas al plan
      de forma explícita en Assumptions
- [x] Requirements are testable and unambiguous — FR comunes, FR-01-x y FR-02-x se verifican con
      las nueve evaluaciones, inspección de imports, fixtures (vacío, un solo gate) y corridas
      repetidas
- [x] Success criteria are measurable — 9/9 evals, cero imports por ruta, cero archivos cambiados
      en la segunda corrida, cero preguntas sobre este repo
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified — convivencia, gates ausentes, fuentes en otra forma, hallazgos
      sin línea, `PLACEHOLDER`, ediciones manuales, versiones, deuda que toca lo implementado
- [x] Scope is clearly bounded — registro de deudas como única lista; fuera: contrato,
      operaciones, dominio, aplicación, persistencia; D-03 anotada y fuera
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — ver la nota del primer ítem

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- 2026-09-21: D-04 (`config/` sin documentación ni esquema) agregada como historia P3 con FR-04-x y SC-04-x; lista pasada sobre ella sin cambios.
- 2026-09-21: D-05 (`contracts/` README y extensiones) y D-06 (directorios de primer nivel con README verificado) agregadas como historias P3; la parte README de D-04 pasa a ser instancia de D-06. Lista pasada sobre ambas sin cambios.
- 2026-09-21 cierre: cinco deudas implementadas con su commit en el registro; D-03 queda `evaluada` para una feature aparte.
- Feature de **registro abierto**: al agregar una deuda (fila en la tabla + historia `D-NN` al
  final), volver a pasar esta lista sobre la historia nueva y regenerar plan y tareas para ella.
