# Specification Quality Checklist: Las instrucciones tienen criterio de admisión y gate

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

**Pasada 1 — nombres de herramienta en los requisitos.** La primera versión nombraba scripts,
archivos y rutas concretas (`check:identifiers`, `scripts/readme-inventory-lib.mjs`,
`tests/docs/readmes.test.ts`, `PROSE_CHARS`, `src/application/access/ports/signature-window.ts`).
Eso ata la spec a una implementación que el plan todavía no eligió. Se reescribieron en términos de
la capacidad: «verificar que toda ruta citada resuelva», «fallar cuando el documento gane una
sección cuya política no esté declarada». Las mediciones con nombres propios viven en la
descripción de entrada de la feature y las va a recuperar el `research.md`, que es su lugar.

**Pasada 2 — criterios verificables sin conocer la implementación.** SC-001 decía «reporta la línea
498»; un número de línea depende de ediciones ajenas y deja de ser cierto solo. Ahora dice qué
reporta —la referencia a la ventana de firma en su módulo viejo— que es lo mismo y sobrevive a que
alguien agregue un párrafo arriba. SC-004 ganó la cifra que lo hace comprobable: **catorce**
secciones, contadas.

**Pasada 3 — límites con su motivo, y una exclusión que faltaba.** Cada exclusión dice **por qué**
queda afuera, no sólo que queda. Se agregó una que no estaba y que el plan habría tenido que
inventar: **no** se persigue un número de líneas objetivo, porque una meta numérica premia borrar
cosas útiles; el criterio decide qué se va. Y se explicitó en `## Assumptions` que el documento va a
seguir siendo largo y que eso está bien, para que la historia 3 no se lea como una poda.

Ningún `[NEEDS CLARIFICATION]`. Las tres decisiones que podían quedar abiertas —reusar el mecanismo
existente o inventar otro, declarar las raíces implícitas o prohibirlas, y cómo se juzga cuánto
mudar— tienen una respuesta por defecto defendible, registrada en `## Assumptions` para que el plan
la confirme o la contradiga con evidencia.

**Nota sobre el sujeto de la spec**: la feature audita el documento que gobierna cómo se escribe
toda feature, incluida ésta. Esa recursión está declarada en `## Constraints` a propósito: es un
criterio de aceptación, no una curiosidad. Si la regla nueva no se cumple en el documento que la
enuncia, la feature no está terminada.
