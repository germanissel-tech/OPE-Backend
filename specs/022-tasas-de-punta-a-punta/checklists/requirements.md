# Specification Quality Checklist: El backend habla en tasas, adentro y afuera

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23 · **Rewritten**: 2026-09-23 (tercera formulación del alcance)
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

- **Esta spec se reescribió entera.** Las dos formulaciones anteriores —un valor con reglas que
  encapsulara la conversión, y una sola representación adentro con el porcentaje tipado en el
  borde— quedan registradas en el contexto, porque explican por qué la tercera es la correcta: las
  dos primeras mejoraban una conversión; la tercera la elimina. El recorrido completo vive en el
  `research.md` del plan.
- **Ésta es la primera feature del recorrido que cambia el contrato.** No es un detalle de
  implementación filtrado: es el corazón de la decisión, y por eso FR-001 y FR-011 hablan de él en
  términos de qué recibe y entrega el sistema, no de cómo se escribe el esquema.
- **El "usuario" son dos**: quien integra con el sistema (US1) y quien lo escribe (US2 a US4). La
  primera es la única con efecto visible hacia afuera, y es un efecto que rompe: quien ya estuviera
  integrado tendría que cambiar. La spec asume explícitamente que nadie lo está.

## Lo que el plan tiene que resolver (no bloquea la spec)

- **La precisión que el contrato admite** (FR-008): si se restringe a múltiplos de un centésimo o
  si se documenta a qué resuelve el sistema. Restringirlo en el esquema es frágil con punto
  flotante; documentarlo es más honesto pero cambia lo que el contrato promete.
- **Si el tipo de incentivo sigue llamándose "porcentaje"** cuando su valor pasa a ser una
  fracción, o si el vocabulario cambia con él.
- **Cómo se verifica FR-003** —cero conversiones— sin una regla que persiga números: si alcanza con
  que no quede ninguna a la que copiarle, o si merece un gate.
- Si la decisión se registra como ADR nuevo o como enmienda de ADR-024.
- Cuál de las dos salidas toma US4.
