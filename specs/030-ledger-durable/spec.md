# Feature Specification: El ledger sobrevive a un reinicio

**Feature Branch**: `030-ledger-durable`

**Created**: 2026-09-26

**Status**: Draft

**Input**: Primera feature del hito `persistence-and-resilience`. Sale de `main` limpio (`1dffca5`,
con la 029 mergeada y el CI de `main` verificado).

## Contexto: hoy un reinicio borra el experimento

`01 §0.1` define el ledger como **«el registro durable e inmutable de lo que OPE decidió, mostró y
medió»**, y `01 §9` lo llama ledger auditable de decisiones, exposiciones, órdenes, atribuciones y
devoluciones. Hoy **no es durable**: el despliegue local guarda dieciséis cosas en memoria, y su
propio comentario lo dice —«los ledgers en memoria nunca podan; están en lugar del ledger durable de
`01 §9`»—.

Lo que eso significa para un piloto: **un reinicio borra el experimento**. No sólo las decisiones: las
exposiciones que las confirman, las órdenes que las atribuyen y las corroboraciones que las sostienen.
Y el MVP existe para producir un número de contribución incremental que se calcula sobre todo eso.

No es una deuda que apareció: es el hito que el mapa del contrato llama `persistence-and-resilience`,
y ésta es su primera feature.

**Esta feature entrega durabilidad, no resiliencia.** El hito promete además atomicidad del
presupuesto por sesión, un canal de fallo en la lectura y que la entrada de administración se commitee
junto con la acción que registra. Eso es trabajo de features siguientes, y lo que aquí se construye es
el suelo sobre el que se apoyan.

**Y una decisión del dueño que acota el alcance** (2026-09-26): la durabilidad se implementa sobre
**SQLite**; PostgreSQL —que la constitución fija como el motor de producción— y las pruebas de
concurrencia contra él quedan para más adelante, porque hoy no hay infraestructura para que CI levante
uno. Queda registrado como **D-21**, con lo que eso deja sin verificar.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Lo que OPE decidió sigue ahí después de un reinicio (Priority: P1)

Un piloto corre durante semanas. En algún momento el servicio se reinicia: un deploy, una caída, un
cambio de configuración del hosting. Hoy, al volver, OPE no sabe **nada** de lo que decidió: ni qué
visitantes fueron asignados a qué brazo, ni qué intervenciones mostró, ni qué órdenes atribuyó. El
experimento no se degrada, **desaparece**.

Después de esta historia, lo que se registró se vuelve a leer: las decisiones con su razonamiento, las
exposiciones que las confirman, las órdenes y sus corroboraciones, y las asignaciones que dicen en qué
brazo cayó cada visitante.

**Why this priority**: es la historia que hace posible un piloto. Sin ella, el resto del hito no tiene
dónde apoyarse.

**Independent Test**: registrar una decisión, exponerla, atribuirle una orden, reiniciar el servicio
y leer las tres cosas con los mismos identificadores y el mismo contenido.

**Acceptance Scenarios**:

1. **Given** una decisión registrada con su razonamiento, **When** el servicio se reinicia, **Then**
   se lee por su identificador con la misma barrera, la misma evidencia, los mismos candidatos y el
   mismo veredicto.
2. **Given** una exposición confirmada, **When** el servicio se reinicia, **Then** confirmarla otra
   vez sigue siendo idempotente: responde lo mismo que respondió la primera vez y no crea una segunda.
3. **Given** una orden atribuida a una sesión, **When** el servicio se reinicia, **Then** la cadena de
   evidencia sigue completa y la orden sigue atribuida a la misma sesión.
4. **Given** un visitante asignado a un brazo, **When** el servicio se reinicia, **Then** vuelve a
   caer en el mismo brazo: la asignación es un hecho registrado, no un cálculo que se repite.
5. **Given** dos merchants con actividad, **When** cualquiera de los dos se lee después del reinicio,
   **Then** no ve nada del otro.

---

### User Story 2 - El catálogo publicado sigue ahí después de un reinicio (Priority: P2)

La plataforma de un merchant publica su catálogo una vez al día. Hoy, si el servicio se reinicia, OPE
se queda sin catálogo hasta la próxima publicación y **deja de intervenir** en toda la tienda, sin que
nadie se entere hasta que alguien mire.

Después de esta historia, la última instantánea publicada sobrevive, con su instante de captura y sus
recibos, así que la verdad de producto se puede consultar desde el primer request.

**Why this priority**: va después del ledger porque el catálogo es reenviable —la plataforma lo vuelve
a publicar— mientras que una decisión perdida no se recupera nunca. Pero perderlo apaga la tienda
entre reinicio y publicación, que en un flujo diario puede ser un día.

**Independent Test**: publicar una instantánea, reiniciar, y consultar la verdad de una variante sin
volver a publicar.

**Acceptance Scenarios**:

1. **Given** una instantánea publicada, **When** el servicio se reinicia, **Then** la verdad de una
   variante se consulta con el mismo contenido y la misma frescura que antes.
2. **Given** una instantánea publicada, **When** se publica de nuevo con el mismo instante y el mismo
   contenido después de un reinicio, **Then** se responde como repetición, no como conflicto.
3. **Given** los recibos de publicación que miden el nivel de sincronización observado, **When** el
   servicio se reinicia, **Then** el nivel observado no cambia por el reinicio.

---

### Edge Cases

- **Arrancar contra un almacén vacío** → el servicio arranca y responde; un ledger sin registros es
  un ledger válido, no un error.
- **Arrancar contra un almacén cuyo esquema no es el esperado** → el servicio **no arranca**, y lo
  dice nombrando qué esperaba. Es la misma regla que ya rige para la configuración: un servidor que
  arranca sobre algo que no entiende es peor que uno que no arranca.
- **El almacén no está disponible al escribir** → es el canal de fallo que el sistema ya tiene
  (`LedgerUnavailable`, ADR-021): el registro degrada con su motivo y el plano de decisión sigue
  respondiendo. Esta feature no lo inventa; lo conserva.
- **Dos procesos contra el mismo almacén** → fuera de alcance. Es lo que la decisión sobre SQLite deja
  para el motor de producción (D-21), y esta feature no promete concurrencia entre procesos.
- **El almacén crece sin límite** → el ledger es inmutable y no poda por diseño. Qué se retiene y por
  cuánto es una decisión de producto que el MVP no tomó, y no se inventa acá.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Lo que el sistema registra en el ledger DEBE poder leerse después de reiniciar el
  servicio, con el mismo identificador y el mismo contenido.
- **FR-002**: La durabilidad DEBE cubrir las decisiones, las exposiciones, las órdenes, sus
  corroboraciones y las asignaciones de visitante a brazo.
- **FR-003**: La última instantánea de catálogo de cada merchant y sus recibos de publicación DEBEN
  sobrevivir a un reinicio.
- **FR-004**: El aislamiento entre merchants DEBE seguir siendo cierto después del reinicio: ninguna
  lectura de un merchant devuelve nada de otro.
- **FR-005**: La idempotencia ya declarada DEBE seguir valiendo a través de un reinicio: repetir una
  confirmación de exposición o una publicación de catálogo responde lo mismo que la primera vez.
- **FR-006**: El servicio NO DEBE arrancar contra un almacén cuyo esquema no es el que espera, y DEBE
  decir qué esperaba.
- **FR-007**: El esquema del almacén DEBE versionarse en el repositorio, de modo que la forma de los
  datos sea revisable en una PR como cualquier otro cambio.
- **FR-008**: Qué tecnología usa cada despliegue DEBE ser una elección explícita del despliegue, y
  omitirla NO DEBE compilar.
- **FR-009**: El comportamiento observable NO DEBE cambiar: para la misma secuencia de eventos, la
  decisión, la exposición y la atribución DEBEN ser las mismas que con el almacén en memoria.
- **FR-010**: El camino crítico de decisión NO DEBE ganar I/O de red ni escritura bloqueante nueva
  (constitución, gate del plano de decisión).
- **FR-011**: El almacén durable NO DEBE guardar ningún dato personal: lo que se registra sigue siendo
  lo que el contrato ya admite, y el ledger no gana campos por volverse durable.

### Key Entities

- **Ledger**: el registro durable e inmutable de lo que OPE decidió, mostró y midió. Existe hoy como
  puertos con implementación en memoria; esta feature le da un almacén que sobrevive.
- **Instantánea de catálogo**: la última publicación de cada merchant, con su instante de captura y
  sus recibos.
- **Almacén**: dónde vive lo anterior. Es una tecnología que un despliegue elige, no una decisión del
  dominio ni de la aplicación.
- **Migración**: el cambio versionado de la forma del almacén, revisable en una PR.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Reiniciar el servicio no pierde ninguna decisión, exposición, orden, corroboración ni
  asignación registrada antes del reinicio.
- **SC-002**: Un merchant que publicó su catálogo puede recibir intervenciones inmediatamente después
  de un reinicio, sin volver a publicar.
- **SC-003**: La misma secuencia de eventos produce la misma decisión con el almacén durable que con
  el de memoria, verificado por las pruebas que ya existen.
- **SC-004**: Un almacén con un esquema inesperado impide el arranque, y el mensaje dice qué esperaba.
- **SC-005**: El lazo local de pruebas sigue sin depender de ningún servicio externo.

## Assumptions

- **La durabilidad se implementa sobre SQLite** (decisión del dueño, 2026-09-26). La constitución fija
  PostgreSQL como el motor de producción y esta feature no lo contradice: describe el despliegue, y el
  local ya corre hoy sobre memoria. Lo que queda sin verificar está en **D-21**.
- **Nada que migrar**: no hay datos en producción, así que la primera versión del esquema no necesita
  convivir con ninguna anterior.
- **Los puertos no cambian de forma.** El sistema ya está escrito contra puertos con canal de fallo
  (`LedgerUnavailable`, ADR-021); esta feature agrega una implementación, no un contrato.
- **La composición ya sabe elegir tecnología**: un módulo que declara dos entra en el despliegue como
  `<módulo>Module.with("<tecnología>")` y no compila si nadie elige (ADR-033).
- **Un solo proceso** contra el almacén. La concurrencia entre procesos es del motor de producción.

## Lo que esta feature NO hace, y por qué

- **La atomicidad del presupuesto por sesión.** El estado de sesión y visitante sigue en memoria: es
  la feature siguiente del hito, y mezclarla acá haría que una sola cadena de gates tuviera que
  distinguir qué rompió qué.
- **El commit conjunto de la entrada de administración** (la ventana que ADR-034 deja abierta).
  Necesita transacciones que abarquen dos módulos, así que va después de que los dos sean durables.
- **La configuración, los merchants y los experimentos.** Hoy se reconstruyen de la semilla en cada
  arranque y eso funciona; que una versión publicada se pierda es real y es la tercera feature del
  hito.
- **PostgreSQL y las pruebas de concurrencia contra él** (D-21).
- **Retención y poda.** El ledger es inmutable por diseño y el MVP no decidió cuánto se retiene.
