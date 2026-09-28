# Specification Quality Checklist: Un reinicio deja de reiniciar los topes

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

**De dónde sale esta spec.** Salió de partir la 031 el 2026-09-27, cuando al tensionarla quedó claro
que se había comido a la feature siguiente del hito: llevaba veintidós requisitos y siete frentes, y
la propia 030 había rechazado mezclar por el mismo motivo — con todo junto, una sola cadena de gates
no puede decir qué rompió qué. Las decisiones tomadas en esa conversación están registradas acá con
su fecha y no se rediscuten.

**Una corrección del 2026-09-27, a pedido del dueño: «¿por qué motivo limitaríamos las intervenciones
a un visitante?»** La respuesta obligó a mirar los valores en vez de suponerlos, y la primera
redacción de esta spec estaba apuntando al tope equivocado. Con `interventionsPerSession: 1` y una
sesión de 30 minutos, **el tope diario de 3 sólo dispara si la misma persona abre cuatro visitas en un
día**: el que bloquea en casi todo el tráfico es el presupuesto por sesión. La historia P1 se reescribió
alrededor de ése, con el cupo diario como el segundo tope de la misma historia —el único que cruza
visitas, y por eso el que impide que una cadena de despliegues no tenga techo—, y el 3 sin medición
quedó registrado como **D-24**, que sólo se puede cerrar con los datos que entrega la 031.

De paso quedó descartado un argumento que yo estaba dando por bueno: que la dosis variable rompe la
medición. No la rompe — el piloto compara por intención de tratar y la dosis real es parte del
tratamiento. Lo que se pierde es más chico y más honesto de decir: la cifra publicada deja de describir
la política configurada.

**Q1 quedó resuelta el 2026-09-27: los topes obligatorios, las señales best-effort.** Lo que la hizo
decidible no fue comparar las dos opciones en abstracto, sino mirar qué pasa con cada lectura: sin las
intervenciones el sistema hace algo que nunca hizo; sin las señales, la sesión igual absorbe las del
lote actual y el sistema queda en el comportamiento que hoy está en producción. Degradar por señales
faltantes cuesta intervenciones y no compra corrección.

**Y la pregunta descubrió dos cosas que no eran opciones, y ahora son requisitos.** Los puertos
devuelven `Promise<State | undefined>`, donde `undefined` es «no lo recuerdo»: cuando ese `load` lea
del durable, **una falla y un visitante nuevo darían el mismo valor**, y el sistema trataría la falla
como visitante nuevo devolviéndole el cupo (FR-011). Y hoy una excepción del almacén llega al borde
HTTP y el SDK recibe un 500 sin decisión ni fila en el ledger, lo que contradice el precedente de
`ledger-unavailable` (FR-012). Ninguna respuesta a Q1 era aplicable sin esos dos arreglos.

**Una pregunta abierta, deliberada y en su propia sección:**

- **Q2 — la ventana por merchant**: depende de si el estado caliente sale del proceso, porque hoy la
  memoria es un límite único compartido.

**Lo que esta spec declara y no puede cuantificar todavía.** Esperar la reconstrucción es una
excepción a «sin I/O de red saliente en el plano de decisión». Está declarada, y su costo **no está
medido**, porque medirlo contra SQLite local no dice nada —no hay red— y el motor de producción no
está disponible (**D-21**). El número se toma cuando exista; el plan no puede prometerlo antes.

**El orden importa**: esta feature **depende de la 031**, que entrega los eventos de los que se
reconstruyen las señales. Sin ella, sólo se pueden reconstruir las intervenciones — que es la mitad
que más duele, así que la primera historia es entregable igual si hiciera falta.
