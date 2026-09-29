# Specification Quality Checklist: Nada de lo que se configuró u observó se pierde en un reinicio

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-29
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

**Las tres decisiones abiertas se cerraron antes de escribir** (dueño, 2026-09-29), así que no queda ningún `[NEEDS CLARIFICATION]`: la semilla se aplica sólo si el almacén está vacío y lo dice fuerte; el registro de administración no se poda; y la ventana de deduplicación entra como **recuperable** y no como durable.

**La primera versión de esta spec cubría cuatro almacenes y estaba incompleta.** El dueño fijó el principio —todo lo configurado u observado aguanta un reinicio— y auditar los diecisiete puertos uno por uno mostró tres que faltaban: el diagnóstico de anclajes y los valores sin mapear, que **el propio panel lee** y que un deploy borraba, y la ventana de deduplicación. El descuido tiene un nombre: el relevamiento del panel listó esas operaciones como disponibles sin mirar si lo que devuelven dura.

**Por eso el inventario de las cuatro columnas está en la spec y es SC-011.** «Todo persiste» sólo significa algo si la lista está entera y cada puerto cae en una columna; sin eso es una afirmación que nadie puede verificar y que la próxima feature vuelve a descubrir incompleta.

**Dos cosas que se revisaron dos veces y quedaron como están:**

- **Los nombres de puerto y de servicio** aparecen en la sección del riesgo y en el inventario. Son la evidencia de **dónde** está el camino caliente, medida contra el código, y sin nombrarla el plan tendría que volver a buscarla. El riesgo se explica en prosa antes de nombrarlos.
- **SC-002 es una condición de aceptación y no una métrica informativa**, y está dicho así a propósito. Es la diferencia con SC-005 de la feature 032, que publicaba una cifra sin presupuesto: ahí no había base de comparación y acá sí — el mismo p95 con todo en memoria, en la misma corrida.

**Lo que la spec deliberadamente no decide**, y es correcto que no lo haga: cómo se evita pagar una lectura del almacén en cada petición. Hay al menos dos formas con consecuencias distintas y es una decisión de diseño; el plan es donde se evalúan.
