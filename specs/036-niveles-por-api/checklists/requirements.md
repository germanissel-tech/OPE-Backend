# Specification Quality Checklist: Los niveles 1 y 2 se configuran por API

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

**Las cuatro preguntas que el dueño dejó abiertas quedaron resueltas en la spec, no diferidas:**

1. **Qué significa «la ventana afectada»**: FR-007 elige el criterio **justo** —un experimento está
   alcanzado cuando algún campo que cambió resuelve, para su merchant, desde el nivel que cambió— y
   Assumptions dice de qué depende y cuál es la salida conservadora si esa información no estuviera
   disponible. Se eligió el justo porque el conservador reinicia ventanas de merchants a los que el cambio
   no les llega, y una ventana reiniciada de más es medición perdida.
2. **La huella de las dos políticas**: queda como asunto del plan, porque es un cambio de rol de una
   prueba y no un requisito de comportamiento. La spec lo implica en FR-012: los archivos pasan a ser
   semilla, así que lo que la huella fija pasa a ser el contenido de la semilla.
3. **Los archivos pasan a ser semilla**: FR-012 y SC-009.
4. **Qué queda fuera de la escritura por API**: SC-001 dice **los 22**, y obliga a nombrar con su motivo
   cualquier excepción. La spec no espera ninguna, y el hallazgo que se verificó antes de escribirla es que
   el obstáculo no es «qué campo no puede» sino que el nivel de plataforma **se entrega a ocho componentes
   cuando el servidor se construye** — eso es trabajo, no imposibilidad, y es la historia 3.

**Sobre la primera línea de la lista**: la spec nombra valores de configuración (`holdoutShare`,
`dedupWindow`) y conceptos del producto (nivel, versión, ventana de medición, experimento alcanzado), que
son vocabulario del dominio y no de la implementación. No nombra archivos de código, ni módulos, ni
tecnología de almacenamiento.

**La historia 2 es P1 igual que la 1, y es deliberado**: sin ella la historia 1 le da a un operador la
posibilidad de arruinar una medición en curso sin que nada se lo diga. Son dos historias y no una porque se
prueban por separado, pero ninguna se entrega sola.
