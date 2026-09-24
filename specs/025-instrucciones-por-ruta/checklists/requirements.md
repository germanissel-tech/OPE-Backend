# Specification Quality Checklist: El núcleo se lee siempre; el resto carga cuando hace falta

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

**Pasada 1 — el mecanismo se había filtrado a los requisitos.** La primera versión nombraba
`.claude/rules/`, la clave `paths`, los patrones glob y la versión de la CLI dentro de los FR y los
SC. Eso ata la spec a una implementación que el plan todavía no eligió, y además la volvería falsa
si la herramienta renombra el mecanismo. Se reescribieron en términos de la capacidad: «vivir
acotada a esa parte, de modo que no entre al contexto cuando el agente no trabaja sobre ella»,
«declarar a qué parte del código se aplica». El mecanismo concreto y las citas textuales de la
documentación viven en la descripción de entrada y los recuperará el `research.md`, que es su lugar.

**Pasada 2 — prioridades que no se sostenían.** US2 estaba como P2 y es **P1**: partir el documento
sin extender el gate desharía lo que la feature anterior construyó, y siete archivos nuevos sin
verificación es peor que uno grande verificado. Dos historias P1 no es un empate: es que la
partición y su verificación son una sola entrega, y el plan tiene que tratarlas así.

**Pasada 3 — el riesgo pasó de nota al pie a requisito.** Que una regla acotada llegue tarde
—escribir el primer archivo de una parte es cuando más se la necesita— estaba sólo en los casos
borde. Ahora es FR-003 (la invariante que queda en el núcleo) y FR-004 (si no se puede reducir, la
sección no se mueve), con su escenario de aceptación. Sin eso, la feature podría "cumplirse"
dejando al agente sin la regla justo cuando la necesita.

Ningún `[NEEDS CLARIFICATION]`. Las tres decisiones que podían quedar abiertas —qué mecanismo de
partición, qué se mueve y qué se queda, y qué hacer con el riesgo de la carga tardía— tienen una
respuesta por defecto medida y registrada en `## Assumptions`, para que el plan la confirme o la
contradiga con evidencia.

**Nota sobre la recursión**: como la feature anterior, ésta modifica el documento que gobierna cómo
se hace toda feature. Está en `## Constraints` a propósito, y es criterio de aceptación: si el
núcleo no cumple el umbral que enuncia, la feature no está terminada.
