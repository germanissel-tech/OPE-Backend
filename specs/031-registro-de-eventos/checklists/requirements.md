# Specification Quality Checklist: Lo que el SDK manda deja de ser invisible

**Purpose**: Validate specification completeness and quality before proceeding to planning

**Created**: 2026-09-27

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
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

**Las tres preguntas abiertas son deliberadas y están en la spec como sección propia (`Lo abierto`),
no como marcadores sueltos en el texto.** Las tres cambian el alcance y ninguna tiene un valor por
defecto razonable:

- **Q1 — evento o lote**: el dueño pidió explícitamente decidirlo con la spec delante.
- **Q2 — retención**: el MVP nunca la decidió y con eventos el volumen es el del tráfico entero.
- **Q3 — lo que no se pudo registrar**: un registro forense con huecos silenciosos es peor que no
  tenerlo, porque se lo lee como completo.

Hasta que las tres tengan respuesta, la spec **no está lista para `/speckit-plan`**: Q1 decide la
forma del dato, Q2 decide si hace falta una poda (y entonces qué la gobierna, porque ninguna
política vive en el código, constitución XI) y Q3 decide qué garantía promete FR-001.

**Sobre SC-004**: se escribió como «no empeora de forma apreciable» y no con un número nuevo, porque
el número de referencia es el de la feature 030 y la comparación se hace contra esa tabla, en la
misma corrida. Fijar un umbral distinto acá sería inventar un presupuesto que `01 §4.6` no da.
