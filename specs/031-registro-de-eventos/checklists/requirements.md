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

**Q1 quedó resuelta el 2026-09-27** (una fila por evento), midiendo las tres formas con el motor
real en vez de estimarlas. Quedan dos preguntas abiertas, deliberadas y en su propia sección:

- **Q2 — retención**: el MVP nunca la decidió y con eventos el volumen es el del tráfico entero.
- **Q3 — lo que no se pudo registrar**: un registro forense con huecos silenciosos es peor que no
  tenerlo, porque se lo lee como completo.

Hasta que las dos tengan respuesta, la spec **no está lista para `/speckit-plan`**: Q2 decide si
hace falta una poda y qué la gobierna (ninguna política vive en el código, constitución XI) y Q3
decide qué garantía promete FR-001.

**Sobre el alcance que creció durante la conversación.** La feature incorporó dos reglas de
arquitectura del dueño (FR-014, FR-015) y la migración del esquema de la 030 para cumplirlas
(FR-016). Eso es más de lo que el título sugiere, y es deliberado: dejar siete tablas con un
criterio y las nuevas con otro es exactamente lo que un lector del esquema no espera encontrar.

**Sobre mediciones que hubo que rehacer tres veces.** La comparación de Q1 tuvo dos sesgos
sucesivos a favor de la opción que parecía mejor —primero índices desiguales, después campos del
evento contados como del lote— y los dos se corrigieron midiendo de nuevo. El script quedó en el
scratchpad de la sesión; los números de la spec son los de la tercera corrida.
