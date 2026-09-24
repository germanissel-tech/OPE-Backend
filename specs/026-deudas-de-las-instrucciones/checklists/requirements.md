# Specification Quality Checklist: Las cuatro deudas de las instrucciones

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

**Pasada 1 — nombres de archivo en los requisitos.** La primera versión nombraba
`scripts/instructions-policy.json`, `.claude/rules/gates-de-calidad.md`, `eslint.config.mjs` y
`specs/019-deudas-tecnicas/spec.md` dentro de los FR y los SC. Eso ata la spec a una implementación
—y, peor, a una ubicación del registro que el plan todavía tiene que decidir—. Se reescribieron en
términos de la capacidad: «en el lugar donde el repositorio busca su deuda técnica», «la fuente que
ya lo gobierna». Las mediciones con nombres propios viven en la descripción de entrada y las
recuperará el `research.md`.

**Pasada 2 — una historia que era dos.** La versión inicial juntaba las tres separaciones en una
sola historia. Se partió: `Convenciones` es P1 porque está en el núcleo y devuelve margen al archivo
que tiene que entrar en una pasada; las otras dos son P2 porque ya no cargan en toda sesión. La
prioridad tiene que reflejar el efecto, no el parecido del trabajo.

**Pasada 3 — los casos de «no se pudo».** Faltaban los tres que hacen que esta feature sea honesta
en vez de una promesa: una sección que no se puede separar **se queda** (FR-009), lo descriptivo sin
destino no fuerza a inventar uno, y el procedimiento que resulte no ser un procedimiento cambia de
destino. Sin esos tres, la única salida ante un problema sería cerrar una deuda por decreto.

Ningún `[NEEDS CLARIFICATION]`. La decisión que podía quedar abierta —dónde vive el registro ahora
que recibe deudas de features posteriores a la que lo creó— está en `## Assumptions` con las dos
opciones y el motivo por el que la spec no la fuerza: las dos son defendibles y la evidencia se
junta al planificar.

**Nota sobre la corrección incluida en la spec**: el dueño autorizó este trabajo sobre una
afirmación mía que era falsa —que el mapa del contrato tenía un hito mal escrito—. La corrección
está en el cuerpo de la spec y en `## Out of Scope`, no sólo en la conversación, porque quien lea
esto dentro de seis meses no va a tener la conversación.
