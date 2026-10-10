# Feature Specification: El testigo de concurrencia

**Feature Branch**: `043-el-testigo-de-concurrencia`

**Created**: 2026-10-10

**Status**: Borrador

**Input**: Pedido de OPE-Web, con evidencia de su feature 008 (la configuración versionada): publicar la
configuración arrastra lo que no se edita de la versión que rigió al abrir la pantalla, y si otro operador
publicó en el medio, lo pisa sin que nadie se entere. Decisiones del dueño del 2026-10-10: el testigo protege
las tres publicaciones de configuración y la edición de la identidad del merchant, y es **obligatorio**.
Referencia: `TAN-10` de Tandilia.

## Por qué existe

Las cuatro pantallas de la consola que escriben esto trabajan igual: leen lo que rige, lo precargan, el
operador cambia algunos valores y la pantalla **manda el registro entero**. La configuración de un merchant
lleva además lo que la pantalla no edita —la política de decisión, los anclajes, las etiquetas—, copiado de lo
que rigió al abrir.

Si otro operador publica en el medio, la segunda publicación **reemplaza la primera con valores viejos**. Nada
falla: las dos reciben su versión nueva, el historial muestra las dos, y lo que el primero cambió desaparece
de lo que rige. En la configuración el daño es mayor que en un formulario común, porque lo que se pisó puede
ser un anclaje o una regla de decisión que la pantalla ni siquiera mostraba.

Hoy la regla es «gana el último». La 040 y la 041 la dejaron así a propósito, como feature posterior.

## Lo decidido antes de la spec

1. **Qué protege.** Las tres publicaciones de configuración (merchant, plataforma, defaults de tratamiento)
   y la edición de la identidad del merchant. Las demás escrituras del operador no precargan nada que
   puedan pisar y quedan como están. Decidido con el dueño el 2026-10-10.
2. **Es obligatorio.** Una de esas cuatro escrituras sin testigo se rechaza. Un testigo opcional protege sólo
   a quien se acuerda de mandarlo, y el olvido no falla: es la forma en que, según `TAN-10`, la protección
   «se vuelve inútil en silencio». Decidido con el dueño el 2026-10-10. Es un cambio incompatible del
   contrato y entra por la marca `building` (ADR-003), como el `displayName` obligatorio de la 041.
3. **Las cuatro exigencias de `TAN-10`**, adoptadas tal cual:
   - el testigo cambia en **toda** escritura del recurso, también las que no protege (un cambio de estado del
     merchant, una rotación), y esas respuestas lo declaran;
   - el contrato dice, de cada escritura protegida, si **reemplaza** el recurso entero o sólo una parte, y qué
     pasa con lo ausente;
   - si el consumidor llega desde un navegador por CORS, el testigo está entre los encabezados expuestos;
   - el rechazo por testigo faltante **no devuelve** el testigo actual: darlo invita a reenviarlo sin mirar.
4. **El rechazo por versión vieja tiene el tipo que la consola ya espera.** OPE-Web tiene la recuperación
   dormida (`CU-29`): relee, compara campo por campo y reintenta sola si nadie tocó lo mismo. Se despierta con
   un tipo de problema propio, `stale-version`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Una publicación no pisa a otra (Priority: P1)

Dos operadores abren la configuración de plataforma, de defaults o de un mismo merchant. El primero publica.
Cuando el segundo publica con lo que leyó antes, la publicación se rechaza diciendo que el registro cambió, y
nada se escribe. El segundo vuelve a leer y decide.

**Why this priority**: es el defecto que motiva la feature: hoy se pierde trabajo y nada lo dice.

**Independent Test**: leer un nivel y guardar su testigo; publicar una versión con él; publicar otra con el
mismo testigo y recibir el rechazo; comprobar que rige la primera.

**Acceptance Scenarios**:

1. **Given** la configuración de plataforma y su testigo, **When** se publica una versión con ese testigo,
   **Then** se acepta y la respuesta trae el testigo nuevo.
2. **Given** otra publicación entró después de leer, **When** se publica con el testigo viejo, **Then** se
   rechaza como versión vieja, no se crea ninguna versión, y lo que rige sigue siendo la otra.
3. **Given** lo mismo con los defaults de tratamiento y con la configuración de un merchant, **When** se
   publica con un testigo viejo, **Then** se rechaza igual.
4. **Given** un merchant que nunca publicó una versión propia, **When** se lee su configuración, **Then** trae
   un testigo, y publicar con él se acepta.
5. **Given** cualquiera de las tres publicaciones **sin** testigo, **When** se pide, **Then** se rechaza como
   testigo faltante, sin devolver el testigo actual, y nada se escribe.

---

### User Story 2 - La identidad del merchant tampoco se pisa (Priority: P2)

Dos operadores editan la identidad del mismo merchant. El segundo en guardar recibe el rechazo en vez de
reemplazar el nombre, la URL, el contacto y las notas que el primero acaba de escribir.

**Why this priority**: el mismo defecto, en una pantalla que se usa menos que la configuración.

**Independent Test**: leer el merchant y guardar su testigo; editar la identidad con él; editarla otra vez con
el mismo testigo y recibir el rechazo.

**Acceptance Scenarios**:

1. **Given** un merchant y su testigo, **When** se edita su identidad con ese testigo, **Then** se acepta y la
   respuesta trae el testigo nuevo.
2. **Given** el interruptor del merchant cambió después de leerlo, **When** se edita la identidad con el
   testigo de antes, **Then** se rechaza: el testigo cambia en toda escritura del merchant, no sólo en las de
   identidad.
3. **Given** lo mismo después de una rotación de credencial o de una desactivación, **When** se edita con el
   testigo viejo, **Then** se rechaza igual.
4. **Given** una edición sin testigo, **When** se pide, **Then** se rechaza como testigo faltante.

---

### User Story 3 - El reintento de lo que ya entró no falla (Priority: P3)

Un operador publica, la respuesta se pierde en la red y la consola reintenta con el mismo cuerpo y el mismo
testigo. La versión ya existe, y su testigo ya no es el que la consola manda. El reintento responde lo mismo
que respondería hoy —la versión que rige, sin crear otra—, no un rechazo.

**Why this priority**: sin esto el testigo rompe la idempotencia que la consola ya usa (`CU-34`).

**Independent Test**: publicar con un testigo, y repetir exactamente el mismo cuerpo con el mismo testigo
(ahora viejo): `200` con la versión que rige.

**Acceptance Scenarios**:

1. **Given** una publicación que entró, **When** se repite con el mismo cuerpo y el testigo de antes,
   **Then** responde la versión que rige, como una repetición, y no un rechazo.
2. **Given** otro operador publicó el mismo contenido que trae el pedido, **When** se publica con un testigo
   viejo, **Then** responde la versión que rige: no hay nada que pisar.
3. **Given** un cuerpo distinto de lo que rige con un testigo viejo, **When** se publica, **Then** se rechaza.

---

### Edge Cases

- **Un testigo que no es de este recurso** (el de plataforma mandado a los defaults, el de un merchant
  mandado a otro) se rechaza como versión vieja, igual que uno viejo: nunca coincide.
- **Un testigo mal formado** se rechaza como versión vieja, sin distinguirlo de uno que fue válido.
- **Varios testigos en el mismo pedido** o el comodín `*` no se aceptan: el testigo nombra **una** versión.
- **Un merchant fuera del alcance del operador** responde lo mismo que hoy, antes de mirar el testigo: el
  testigo no revela que el merchant existe.
- **Un merchant desactivado**: su identidad se sigue editando como hoy, y el testigo vale igual.
- **Lo que arranca el servidor** (la semilla, la importación de los niveles) no pasa por HTTP y no lleva
  testigo, pero sí lo cambia: lo que se lee después trae el testigo nuevo.
- **Una publicación congelada** (`409 configuration-frozen`) con un testigo viejo se rechaza primero por el
  testigo: no tiene sentido explicar el congelamiento de algo que ya cambió.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Las lecturas de la configuración de un merchant, de plataforma, de los defaults y del merchant
  MUST traer el testigo del recurso.
- **FR-002**: Las cuatro escrituras protegidas MUST exigir el testigo y aceptarse sólo si coincide con el del
  recurso en ese momento.
- **FR-003**: Sin testigo, la escritura MUST rechazarse como «testigo faltante», sin devolver el testigo
  actual y sin escribir nada.
- **FR-004**: Con un testigo que no coincide, la escritura MUST rechazarse como «versión vieja», con un tipo
  de problema propio, sin escribir nada.
- **FR-005**: Un pedido cuyo cuerpo es idéntico a lo que rige MUST responder como hoy (la versión que rige),
  aunque el testigo no coincida.
- **FR-006**: El testigo de un merchant MUST cambiar en toda escritura del merchant, no sólo en las de
  identidad, y toda respuesta de una escritura que lo cambia MUST declararlo.
- **FR-007**: El testigo de un nivel o de la configuración de un merchant MUST cambiar con cada versión
  publicada, también las que publica el arranque.
- **FR-008**: El contrato MUST decir, de cada escritura protegida, si reemplaza el recurso entero, y qué
  significa lo ausente.
- **FR-009**: Si el consumidor `admin` se sirve por CORS, el testigo MUST estar entre los encabezados
  expuestos.
- **FR-010**: El alcance del operador MUST juzgarse antes que el testigo, como hoy.
- **FR-011**: El cambio de contrato MUST declararse como incompatible y entrar por la marca `building`
  (ADR-003), con versión menor y el reporte de `contract:diff` citado.
- **FR-012**: Las pruebas MUST incluir el aislamiento entre merchants: el testigo de uno nunca habilita una
  escritura en otro.

### Key Entities

- **Testigo**: el identificador de la versión actual de un recurso, opaco para quien lo recibe. Se lee con el
  recurso y se devuelve al escribirlo.
- **Recurso protegido**: la configuración de un merchant, el nivel de plataforma, el de defaults y el merchant
  (cuya identidad es lo que se edita). Cada uno tiene su testigo, y el de uno no vale para otro.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: En las cuatro escrituras protegidas, una escritura con testigo viejo no cambia lo que rige el
  100 % de las veces, y su rechazo tiene un tipo que la consola reconoce sin leer el mensaje.
- **SC-002**: Ninguna de las cuatro acepta un pedido sin testigo.
- **SC-003**: Repetir una publicación que ya entró responde la versión que rige, también con el testigo de
  antes.
- **SC-004**: Toda escritura del merchant cambia su testigo, y las pruebas lo afirman para cada una.
- **SC-005**: Ninguna prueba de aislamiento existente deja de pasar, y las nuevas cubren el testigo cruzado.
- **SC-006**: Después de `contract:sync`, OPE-Web puede despertar su recuperación `CU-29` sin cambiar su
  núcleo: el tipo del rechazo y el encabezado del testigo son los que ya espera.

## Supuestos

- El consumidor `admin` no tiene CORS hoy (la consola entra por el mismo origen, decisión de OPE-Web 005); FR-009
  se cumple dejándolo escrito para el día que lo tenga, y una prueba lo afirma si el cableado de CORS existe.
- El testigo viaja como encabezado (`ETag` al leer, `If-Match` al escribir), que es lo que el núcleo de la
  consola detecta en el contrato para saber que una operación lo exige.
- El testigo de la configuración puede derivarse de la versión que rige; el del merchant necesita una revisión
  propia, porque el merchant no tiene versiones. Cómo se calcula es del plan.
- Los testigos no se guardan para comparar después: se recalculan del estado actual.

## Lo que queda afuera

- Las demás escrituras del operador (experimentos, textos, credenciales, interruptor, desactivación): no
  exigen testigo, aunque las del merchant lo cambian (FR-006).
- La recuperación en la consola: la hace la feature siguiente de OPE-Web, que despierta `CU-29`.
- Un testigo en las lecturas de colecciones (listas, historiales): no hay escritura que lo use.
