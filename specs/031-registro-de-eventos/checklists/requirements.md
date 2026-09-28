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

**Implementada el 2026-09-28, 46 de 46 tareas.** Cadena de cierre verde: `contract:check`, `test:all`
(1604 pruebas en 178 archivos), `test:mutation` (1302 mutantes muertos, 0 supervivientes),
`test:contract` (10 457 casos generados y pasados) y `release-check` OK. El p95 de la ingesta no empeoró
de forma apreciable (SC-004, ADR-039).

**Lo que quedó abierto no son cabos sueltos: es alcance con su motivo y su disparador.** Ninguno se
puede cerrar en esta rama, y conviene que se lea por qué en vez de que parezca olvido:

| Qué                                                     | Por qué no se cierra                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-21**, sus otras dos partes                          | necesitan **PostgreSQL**, que el proyecto no tiene. Es alcance que el dueño dejó afuera con su fecha. Esta feature saldó la primera de las tres                                  |
| **D-24**, el tope diario sin medición                   | necesita **tráfico del piloto**. Medirlo con tráfico sintético sería inventar el dato, que es peor que no tenerlo                                                                |
| El **conteo agregado** (447 ms con 1 M, 4,7 s con 10 M) | su disparador es «cuando pase de segundos» y **no se alcanzó**. Hacerlo ahora obliga además a decidir una ventana de agregación, que es una política del dueño (constitución XI) |
| No hay **API para leer el registro**                    | la spec lo excluye en letra: «No analiza nada. Deja el dato». Abrirla es otra feature, no un pendiente de ésta                                                                   |
| El **atraso de la cola** se mide y no alerta            | la spec no pidió alertas; el dato está (`created_at` − `received_at`) para cuando alguien las quiera                                                                             |
| El **recorrido completo** de la reconciliación          | declarado con su disparador en ADR-039: acotarlo pide una columna de instante en `decisions`, y el número es lo que debería pedirla                                              |

**Planificada el 2026-09-27.** El plan pasó el Constitution Check sobre los once principios citando la
v1.4.4, con dos ⚠️ que se justifican en vez de esconderse —la identidad nueva (VI) y dos valores de
configuración nuevos (XI)— y encontró **dos cosas que la spec no podía ver**: que el runner de migraciones
no sabe migrar hacia adelante (la 030 declaró «nada que migrar»), y que registrar los duplicados impide
que el `eventId` sea clave única del registro. Las dos están en `research.md` y cambian el tamaño de la
feature.

**Lista para `/speckit-plan` desde el 2026-09-27.** Las tres preguntas que abrió esta spec quedaron
resueltas por el dueño, midiendo en vez de estimando:

- **Q1 — la unidad de registro**: una fila por evento. Se compararon tres formas con el motor real.
- **Q2 — la retención**: no se borra nada. Guardar todo no encarece leer lo reciente; la única
  consulta que se degrada con el volumen es el conteo agregado, y ésa no se arregla borrando.
- **Q3 — lo encolado al morir el proceso**: el apagado ordenado drena la cola; una caída abrupta
  pierde lo pendiente y **el hueco queda declarado**.

**Lo único que queda anotado no es una pregunta abierta sino una decisión diferida con su
disparador**, como hizo ADR-038 con el desacople del ledger: los totales agregados se mantienen
aparte cuando el conteo pase de segundos (medido: 447 ms con 1 millón de eventos, 4,7 s con 10). No
antes de que el número lo pida.

**El alcance creció y después se partió.** Esta spec llegó a veintidós requisitos y siete frentes, y
dos de ellos eran la feature siguiente del hito. Se separó en la **032** el mismo día, con el corte
por dependencia: ésta entrega el dato, aquélla lo consume.

**Sobre mediciones que hubo que rehacer.** La comparación de Q1 se rehizo tres veces por sesgos
sucesivos a favor de la opción que parecía mejor —índices desiguales, después campos del evento
contados como del lote—, y más adelante otras dos mediciones salieron mal por índices faltantes. Los
números de la spec son los de la última corrida, con todos los índices que el diseño llevaría. El
script quedó en el scratchpad de la sesión.

**Y un error de fondo que el dueño corrigió**: por un rato estuve decidiendo arquitectura con
números de SQLite, cuando en producción va PostgreSQL y la misma escritura pasa a ser I/O de red
desde el plano de decisión — que la constitución prohíbe. Lo que el diseño fija son puertos y
garantías; qué motor los sirve es del despliegue.
