# Feature Specification: Los topes de intervención, atómicos

**Feature Branch**: `046-los-topes-atomicos`

**Created**: 2026-10-13

**Status**: Construida (2026-10-13)

**Input**: La deuda D-30 (el presupuesto por sesión no es atómico), revisada con el dueño el 2026-10-13: se arregla
ahora, con la carrera reproducida en lugar de medida. En la misma revisión el dueño amplió el alcance al tope
diario por visitante, que tiene el mismo defecto.

## Por qué existe

OPE limita cuántas veces interviene: un tope por sesión y un tope diario por visitante, los dos de la política
comercial del merchant. Cada decisión lee cuántas intervenciones lleva la sesión y el visitante, decide, registra la
decisión y actualiza el conteo. Entre leer y actualizar hay esperas, así que **dos lotes del mismo visitante que
llegan juntos** —un SDK que reintenta, una pestaña duplicada, dos pestañas abiertas— pueden leer el mismo conteo y
los dos intervenir. El tope dice uno y salen dos.

No se pierde nada —el libro de decisiones registra las dos, así que se ve—, pero se gasta un cupo que el merchant
no autorizó: una intervención de más es más presión sobre el visitante y, en la medición, una sesión tratada más
de lo que el experimento dice.

## Lo decidido antes de la spec

1. **Se arregla sin esperar al piloto** (D-30, revisión del 2026-10-13): la carrera se reproduce en una prueba, que
   reemplaza a la medición con tráfico real que la deuda pedía.
2. **Las decisiones de un mismo visitante se atienden de a una** dentro del proceso; las de visitantes distintos no
   se esperan entre sí. Por visitante y no por sesión, para cerrar con un solo mecanismo el tope por sesión y el
   diario por visitante (decisión del dueño, 2026-10-13).
3. **No con una transacción del almacén** (D-30): lo que se consume es un conteo en memoria, y una escritura
   serializada en el camino de decisión es lo que el principio IV no admite (ADR-041).
4. **Un solo proceso** (constitución IV): con dos procesos hace falta otra cosa, y es D-21.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El tope de una sesión no se pasa aunque lleguen dos lotes juntos (Priority: P1)

Un visitante cuya sesión ya está a una intervención de su tope manda dos lotes al mismo tiempo, los dos con
señales que justificarían intervenir. OPE interviene en uno y en el otro responde `NO_OP` con el motivo del tope.

**Why this priority**: es la deuda: el cupo que el merchant fijó se respeta siempre, no sólo cuando los lotes llegan
de a uno.

**Independent Test**: una prueba manda dos lotes de la misma sesión en paralelo con el tope en uno. Hoy salen dos
intervenciones; después, una intervención y un `NO_OP` por tope.

**Acceptance Scenarios**:

1. **Given** una sesión con tope de una intervención y ninguna todavía, **When** llegan dos lotes que justifican
   intervenir al mismo tiempo, **Then** hay exactamente una intervención y el otro lote responde `NO_OP` con el
   motivo del tope.
2. **Given** lo mismo, **When** se mira el libro de decisiones, **Then** registra una intervención y un `NO_OP`, en
   el orden en que se atendieron.
3. **Given** dos lotes de la misma sesión que llegan de a uno, **When** se decide, **Then** el resultado es el
   mismo que hoy.

---

### User Story 2 - El tope diario de un visitante no se pasa con dos sesiones a la vez (Priority: P2)

Un visitante con dos sesiones abiertas a la vez (dos pestañas) está a una intervención de su tope diario. Los
lotes de las dos sesiones llegan juntos; OPE interviene en una sola.

**Why this priority**: el mismo defecto con otra llave; menos frecuente que el de la misma sesión.

**Independent Test**: dos lotes de dos sesiones del mismo visitante en paralelo, tope diario en uno: una
intervención y un `NO_OP` por tope.

**Acceptance Scenarios**:

1. **Given** un visitante con tope diario de una intervención y dos sesiones, **When** llegan lotes de las dos al
   mismo tiempo, **Then** hay exactamente una intervención.

---

### User Story 3 - Visitantes distintos no se esperan entre sí (Priority: P1)

Lo que se ordena es sólo lo de un mismo visitante. Dos visitantes cualesquiera, del mismo merchant o de merchants
distintos, se deciden en paralelo como hoy, y un lote que falla no deja al visitante trabado.

**Why this priority**: es lo que hace aceptable el arreglo: el camino de decisión no puede volverse más lento para
el caso común (principio IV).

**Independent Test**: un lote de un visitante que tarda, y en paralelo uno de otro visitante: el segundo responde
sin esperar al primero.

**Acceptance Scenarios**:

1. **Given** un lote de un visitante que todavía se está decidiendo, **When** llega un lote de otro visitante,
   **Then** se decide sin esperar al primero.
2. **Given** el mismo identificador de visitante en dos merchants, **When** llegan lotes de los dos juntos,
   **Then** son dos visitantes y no se esperan.
3. **Given** un lote de un visitante que falla o se interrumpe con un error, **When** llega el siguiente lote de ese
   visitante, **Then** se atiende normalmente.

---

### Edge Cases

- **Muchos lotes del mismo visitante a la vez**: se atienden en el orden en que llegaron, de a uno; ninguno se
  descarta por esperar.
- **Un lote que no llega a decidir** (rechazado antes, por ejemplo, o sin nada que decidir): no ocupa el turno del
  visitante más que lo que tarda en rechazarse.
- **Un visitante que deja de mandar lotes**: lo que se usó para ordenar sus decisiones no queda ocupando memoria
  para siempre.
- **El interruptor del merchant apagado**: no cambia nada de lo anterior; un lote de un merchant apagado responde
  como hoy.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Dos decisiones del mismo visitante de un merchant MUST no solaparse: la segunda MUST empezar cuando la
  primera terminó de registrar la decisión y de actualizar los conteos.
- **FR-002**: Las decisiones de visitantes distintos —del mismo merchant o de otros— MUST no esperarse entre sí.
- **FR-003**: El tope de intervenciones por sesión y el tope diario por visitante MUST respetarse cuando llegan
  lotes simultáneos del mismo visitante.
- **FR-004**: Un lote que termina con error, o que se rechaza antes de decidir, MUST liberar el turno del visitante.
- **FR-005**: Los lotes del mismo visitante que esperan MUST atenderse en el orden en que llegaron.
- **FR-006**: Con lotes que llegan de a uno, el resultado de cada decisión MUST ser el mismo que hoy.
- **FR-007**: Lo que se guarda para ordenar las decisiones de un visitante MUST liberarse cuando no tiene lotes
  pendientes.
- **FR-008**: El orden MUST vivir en el proceso, sin ninguna escritura nueva en el almacén durante la decisión.

### Key Entities

- **Turno del visitante**: que una decisión de un visitante de un merchant esté en curso, y la fila de las que
  esperan. Existe sólo mientras hay lotes de ese visitante en curso o esperando.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Con dos lotes simultáneos del mismo visitante y el tope en uno, hay una sola intervención en el 100 %
  de las repeticiones de la prueba.
- **SC-002**: La latencia del camino de decisión para lotes de visitantes distintos no cambia respecto de hoy:
  las mediciones de latencia del camino de decisión que hoy son gate siguen en verde con sus mismos techos.
- **SC-003**: Después de cualquier cantidad de lotes de cualquier cantidad de visitantes, no queda ningún turno
  ocupado cuando no hay lotes en curso.
- **SC-004**: Un lote que falla nunca deja a su visitante sin poder decidir el siguiente.

## Assumptions

- La identidad del visitante la da el lote, que es de una sola sesión y un solo visitante (el lote lo exige:
  `SessionVisitorMismatch`); y es por merchant: dos merchants con el mismo identificador de visitante son dos
  visitantes.
- Un solo proceso, como todo el MVP (constitución IV); con varios procesos la exclusión hace falta en otro lugar, y
  es D-21.
- No hay contrato ni configuración nuevos: los dos topes ya existen en la política comercial.
- Las demás deudas revisadas con el dueño el mismo día (D-20, D-33) quedan como el registro las dejó.
