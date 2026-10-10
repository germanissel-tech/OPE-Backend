# Feature Specification: El historial completo

**Feature Branch**: `042-el-historial-completo`

**Created**: 2026-10-10

**Status**: Borrador

**Input**: Pedido de OPE-Web, con evidencia de su feature 008 (la configuración versionada, construida el
2026-10-10). El historial de configuración y de textos que el contrato promete y el servidor no entrega
entero: qué mediciones reinició una versión, y la versión de un merchant por su número.

## Por qué existe

Una versión correctiva existe para una sola cosa: publicar un cambio que alcanza a un experimento activo,
a cambio de reiniciar su ventana de medición (ADR-031, D-G). Lo que un operador busca en el historial es
justamente eso: **qué medición costó cada cambio**. El contrato lo promete —las versiones de plataforma,
de defaults y de textos declaran `windowsRestarted`—, pero hoy sólo lo dice la respuesta de publicar.
Toda lectura posterior (la lista del historial y la versión por número) lo devuelve vacío. OPE-Web lo
vio contra el backend real: la consola publicó la versión 161 de plataforma, el aviso dijo qué
experimento reinició, y en el historial la columna quedó en blanco.

La versión del merchant tiene dos huecos más. Su esquema no declara qué mediciones reinició, aunque una
correctiva del merchant reinicia la del experimento activo igual que una global. Y no se puede leer por
su número: los niveles globales y los textos tienen la operación, el merchant no, y la consola recorre
las páginas del historial hasta dar con ella.

## Lo decidido antes de la spec

1. **Es un pedido del consumidor, con su evidencia.** OPE-Web 008 lo registró como abierto para el
   backend. Su feature siguiente saca el recorrido de páginas y muestra la columna, con `contract:sync`.
2. **El testigo de concurrencia no está acá.** Es la feature 043, decidida con el dueño el 2026-10-10:
   protege las publicaciones de configuración y la edición de la identidad del merchant.
3. **Nada se inventa.** Una versión dice qué mediciones reinició si el sistema lo registró. Si no hay
   registro, la versión se lee sin el dato, como hoy.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El historial dice qué medición costó cada cambio (Priority: P1)

Un operador abre el historial de plataforma, de defaults, de textos o de la configuración de un merchant.
Cada versión correctiva dice qué experimentos reinició, lo mismo que dijo el aviso al publicarla, hoy y
después de un reinicio del servidor.

**Why this priority**: es lo que el contrato ya promete y no cumple, y es la razón de ser de una versión
correctiva. Sin esto, el costo de un cambio sólo se ve una vez, en el momento de publicarlo.

**Independent Test**: con un experimento activo, publicar una correctiva en un nivel que lo alcanza;
leer el historial de ese nivel y la versión por número, y ver el identificador del experimento en las
dos; reiniciar el servidor y ver lo mismo.

**Acceptance Scenarios**:

1. **Given** un experimento activo sobre un merchant y una versión correctiva de plataforma que reinició
   su medición, **When** se lee el historial de plataforma, **Then** esa versión trae el identificador
   del experimento en `windowsRestarted`, igual que la respuesta de publicar.
2. **Given** la misma versión, **When** se la lee por su número, **Then** trae la misma lista.
3. **Given** lo mismo con una correctiva de defaults de tratamiento, de un texto de la plataforma o de un
   texto de un merchant, **When** se lee su historial y su versión por número, **Then** cada lectura
   trae los experimentos que esa versión reinició.
4. **Given** una correctiva de la configuración de un merchant que reinició la medición de su
   experimento activo, **When** se la publica y después se lee el historial del merchant, **Then** la
   respuesta de publicar y el historial traen el experimento en `windowsRestarted`.
5. **Given** una versión que no reinició nada (normal, o correctiva sin experimento alcanzado), **When**
   se la lee, **Then** llega sin `windowsRestarted`, como hoy.
6. **Given** cualquiera de las anteriores, **When** el servidor se reinicia y se vuelve a leer, **Then**
   la respuesta es la misma.

---

### User Story 2 - Una versión del merchant se lee por su número (Priority: P2)

Un operador abre una versión vieja de la configuración de un merchant desde su historial. La consola la
pide por su número, como ya hace con plataforma, defaults y textos.

**Why this priority**: hoy la consola lo resuelve recorriendo páginas. Funciona con pocas versiones y no
escala; es una operación que falta, no un dato que se pierde.

**Independent Test**: publicar tres versiones de un merchant, pedir la segunda por su número y recibir lo
que declaró; pedir la cuarta y recibir «no existe».

**Acceptance Scenarios**:

1. **Given** un merchant con versiones 1 a 3, **When** se pide la versión 2, **Then** llega lo que esa
   versión declaró, con su correctiva, su motivo, su instante, su operador y las mediciones que
   reinició, igual que en la página del historial.
2. **Given** el mismo merchant, **When** se pide la versión 4, **Then** se responde «no existe» con el
   mismo tipo de problema que un número inexistente de un nivel global.
3. **Given** un operador cuyo alcance no incluye al merchant, **When** pide cualquier versión suya,
   **Then** se le responde lo mismo que en toda operación sobre un merchant fuera de su alcance, sin
   revelar si el merchant o la versión existen.
4. **Given** dos merchants con versiones del mismo número, **When** se pide la versión 1 de uno,
   **Then** llega la suya y nunca la del otro.

---

### Edge Cases

- **Una correctiva que alcanzó a varios experimentos** (una global con experimentos activos en varios
  merchants) los nombra a todos, cada uno una vez.
- **Una versión publicada antes de esta feature** dice qué reinició si el sistema lo había registrado.
  Si no hay registro, llega sin el dato, como hoy, y nada se inventa.
- **Un experimento cerrado después** sigue nombrado en la versión que lo reinició: el historial dice lo
  que pasó entonces, no lo que rige hoy.
- **Un reintento idempotente de una correctiva** (la misma clave, el mismo cuerpo) devuelve la misma
  versión con la misma lista, y no la vacía.
- **Una versión de texto** reinicia por su clave y su capa: la lista de la versión 3 de un texto no
  mezcla los reinicios de la versión 3 de otro texto, ni los de la versión 3 de un nivel de
  configuración.
- **El número de versión del merchant** que no es un entero positivo se rechaza como entrada inválida,
  igual que en los niveles globales.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Toda lectura de una versión de plataforma, de defaults de tratamiento o de texto (su
  historial y su versión por número) MUST decir qué experimentos reinició esa versión, con la misma
  lista que dio la respuesta de publicarla.
- **FR-002**: La versión de la configuración de un merchant MUST declarar en el contrato qué
  experimentos reinició, y su publicación, su historial y su versión por número MUST decirlo.
- **FR-003**: Una versión que no reinició ninguna medición MUST leerse sin el dato, como hoy.
- **FR-004**: Lo que una versión reinició MUST sobrevivir a un reinicio del servidor.
- **FR-005**: Lo que una versión reinició MUST ser lo que pasó al publicarla: no cambia si el experimento
  se cierra después, ni si otra versión del mismo número se publica en otro nivel, otra clave o otro
  merchant.
- **FR-006**: El consumidor `admin` MUST poder leer una versión de la configuración de un merchant por su
  número, con la capacidad de leer configuración.
- **FR-007**: Esa lectura MUST respetar el alcance del operador como toda operación sobre un merchant, y
  MUST responder «no existe» a un número que el merchant no publicó.
- **FR-008**: El cambio del contrato MUST ser compatible (menor): un campo opcional nuevo y una operación
  nueva.
- **FR-009**: Las pruebas MUST incluir el aislamiento entre merchants de las dos cosas: ni la versión por
  número ni lo que una versión reinició mezclan merchants.

### Key Entities

- **Versión publicada**: de un nivel de configuración (merchant, plataforma, defaults) o de un texto. Ya
  tiene número, nombre estampado en los globales, correctiva, motivo, instante y operador. Gana, en toda
  lectura, la lista de experimentos cuya medición reinició.
- **Reinicio de medición**: lo que un experimento registra cuando una correctiva lo alcanza: cuándo, por
  qué, y qué versión de qué nivel o de qué texto lo causó. Ya existe desde las features 036 y 038.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: En los cinco historiales (configuración del merchant, plataforma, defaults, textos de la
  plataforma, textos de un merchant) y en sus cinco lecturas por número, una correctiva que
  reinició una medición la nombra el 100 % de las veces, también después de un reinicio del servidor.
- **SC-002**: La lista que da cada lectura coincide con la que dio la respuesta de publicar, para toda
  versión publicada en las pruebas.
- **SC-003**: Una versión del merchant se obtiene con una sola petición, cualquiera sea su número y el
  largo del historial.
- **SC-004**: OPE-Web saca su recorrido de páginas y muestra la columna de mediciones reiniciadas sin
  tocar su comprobación de conformidad, después de `contract:sync`.
- **SC-005**: Ninguna prueba de aislamiento entre merchants existente deja de pasar, y las nuevas cubren
  las dos lecturas del merchant.

## Supuestos

- Una correctiva del merchant reinicia la medición del experimento activo de ese merchant y de ningún
  otro (D-G); una global puede alcanzar experimentos de varios merchants.
- El registro de cada reinicio, con el nivel y el número de la versión que lo causó, existe desde las
  features 036 (configuración) y 038 (textos). Lo publicado antes de eso no tiene registro.
- La versión por número del merchant usa el mismo problema «no existe» que las de los niveles globales
  (`configuration-version-not-found`).
- El orden de la lista es el de los reinicios. No se promete otro.

## Lo que queda afuera

- El testigo de concurrencia (`If-Match`): feature 043.
- Mostrar el dato en la consola: lo hace la feature siguiente de OPE-Web.
- Un historial de reinicios por experimento: ya existe en el experimento y no cambia.
