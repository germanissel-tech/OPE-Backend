# Feature Specification: Gobernanza del contrato y del código

**Feature Branch**: `002-gobernanza-contrato-codigo`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Gobernanza del contrato y del código adoptada de las-animas. Alcance
(todo verificable por herramienta, con una prueba por regla como en la 001): (1) registro de
decisiones de arquitectura con verificación de citas; (2) marcadores de estado epistémico
contables y puerta de release; (3) schemas de media type siempre por referencia; (4)
`x-invariants` con verificación y una prueba por invariante; (5) catálogo de errores sin
genéricos; (6) glosario de lenguaje ubicuo verificado contra el contrato; (7) capacidad
declarada por operación autenticada; (8) estructura de código por capas con prueba de
arquitectura; (9) disciplina documental: sin números en prosa viva. No agrega operaciones de
dominio ni persistencia. `GET /v1/health` sigue siendo la única operación."

## Contexto

La feature 001 dejó una cadena de herramientas que verifica el contrato y obliga al servidor a
cumplirlo. Al comparar con `las-animas/backend` (un repositorio hermano de contrato + gobernanza
documental) se identificaron prácticas que allá sostienen un contrato de ~50 operaciones sin
que se degrade, y que acá todavía son prosa: decisiones enterradas en el research de una
feature, estados epistémicos que nadie cuenta, reglas de negocio que el esquema no expresa y
nadie enumera, términos de dominio que cada agente traduce distinto, y una arquitectura de
capas que la constitución exige pero ninguna prueba hace cumplir.

Esta feature convierte esas prácticas en verificaciones que fallan el build, **antes** de que
entre la primera operación de dominio (ingesta, feature 003). Cada regla nueva llega con la
prueba que demuestra que atrapa la violación, igual que en la 001. El código existente se
reacomoda en capas sin cambiar comportamiento: todas las pruebas de la 001 siguen en verde.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las reglas que el esquema no puede expresar quedan declaradas y probadas (Priority: P1)

Un agente agrega una operación con una regla de negocio que el esquema no valida ("la orden
no puede repetir `orderId`", "la suma de los ítems tiene que dar el total"). La declara en el
contrato, junto a la operación o al esquema, con el tipo de error que produce. La verificación
falla si la declaración está incompleta, si el tipo de error no existe en el catálogo, o si no
hay una prueba del servidor nombrada por ese tipo. Ningún `422` de una operación usa el tipo
genérico: cada uno nombra su regla.

**Why this priority**: es la práctica de mayor valor para OPE. La constitución dice que
`NO_OP` es un resultado con motivo y que la ingesta rechaza lo que no está en la lista blanca;
sin esto, esas reglas viven en la cabeza de quien las implementó y quien lea el contrato cree
que el esquema las cubre.

**Independent Test**: se agrega a un contrato de prueba una invariante completa con su tipo en
el catálogo y su prueba nombrada → pasa; se le quita un campo, se le pone un tipo inexistente,
o se borra la prueba → falla nombrando la invariante.

**Acceptance Scenarios**:

1. **Given** una operación o esquema con una invariante declarada con tipo, código HTTP, regla y
   descripción, y el tipo existe en el catálogo de errores, **When** se corre la verificación,
   **Then** pasa y lista la invariante.
2. **Given** una invariante a la que le falta cualquiera de los cuatro campos, **When** se corre
   la verificación, **Then** falla nombrando la invariante y el campo.
3. **Given** una invariante cuyo tipo no está en el catálogo, **When** se corre la
   verificación, **Then** falla nombrando el tipo.
4. **Given** una invariante declarada sin una prueba del servidor cuyo nombre incluya su tipo,
   **When** se corre la verificación, **Then** falla indicando qué prueba falta y dónde.
5. **Given** una operación cuya respuesta `422` referencia el tipo genérico `unprocessable`,
   **When** se corre la verificación, **Then** falla pidiendo un tipo propio.
6. **Given** el contrato actual (sólo `getHealth`, sin invariantes), **When** se corre la
   verificación, **Then** pasa informando cero invariantes.

---

### User Story 2 - Nada del contrato ni del dominio se inventa: glosario verificado (Priority: P1)

Un agente escribe una ruta o un esquema con un sustantivo de dominio. La verificación falla si
ese sustantivo no tiene una nota en el glosario con su término en castellano, su término en
inglés y la fuente (sección de los documentos del MVP o de la constitución) de la que sale. La
fuente tiene que existir. El vocabulario técnico del contrato (`health`, `problem`, `error`) no
necesita nota: está en una lista de exclusión única.

**Why this priority**: constitución y documentos están en castellano; el contrato en inglés.
Sin glosario cada sesión traduce `barrera`, `brazo`, `exposición` como le parece, y el contrato
termina con tres nombres para una cosa. Es la práctica que en el repo hermano evitó un vault
inventado.

**Independent Test**: se agrega al contrato de prueba una ruta `/v1/widgets` sin nota →
falla nombrando `widgets`; se agrega la nota con fuente inexistente → falla nombrando la
fuente; se corrige → pasa.

**Acceptance Scenarios**:

1. **Given** el contrato actual y el glosario con sus términos, **When** se corre la
   verificación, **Then** pasa listando los términos usados.
2. **Given** un segmento de ruta o título de esquema que no resuelve al término en inglés de
   ninguna nota ni está en la lista de exclusión, **When** se corre la verificación, **Then**
   falla nombrando el sustantivo huérfano.
3. **Given** una nota del glosario sin `fuente`, o cuya `fuente` apunta a un archivo o sección
   inexistente, **When** se corre la verificación, **Then** falla nombrando la nota.
4. **Given** una nota del glosario cuyo término no aparece en el contrato y no declara por qué
   (`uso: disponible` o `uso: pendiente`), **When** se corre la verificación, **Then** falla
   nombrando la nota.

---

### User Story 3 - Las decisiones y lo que falta decidir se encuentran sin leer todo (Priority: P2)

Un agente que retoma el repo quiere saber por qué los errores usan URN, por qué un `422` no es
un `400`, o qué queda abierto antes de un release. Las decisiones transversales están en un
registro propio, numerado, con estado y fecha; cualquier documento que cite una decisión
inexistente falla la verificación. Lo no resuelto se marca con palabras fijas dentro del texto
al que pertenece; un comando lo lista y otro falla si queda algo bloqueante.

**Why this priority**: hoy las decisiones de la 001 están en el research de esa feature; la
feature 004 no lo va a leer. Y los estados DECIDIDO / PROPUESTO / ABIERTO existen en prosa pero
nadie los cuenta.

**Independent Test**: se cita `ADR-999` en un documento → falla; se escribe `ABIERTO` en una
descripción del contrato de prueba → `release-check` falla y el listado lo muestra con archivo
y línea.

**Acceptance Scenarios**:

1. **Given** las decisiones transversales de la 001 (mapa de códigos 400/422, espacio de
   nombres de los tipos de error, versionado del contrato y prefijo de rutas, elección de las
   herramientas de lint y compatibilidad), **When** se abre el registro, **Then** cada una es un
   documento numerado con estado, fecha y fuente, y el research de la 001 las cita en vez de
   contenerlas.
2. **Given** un documento del repo que cita una decisión con un número que no existe, **When**
   se corre la verificación, **Then** falla nombrando el documento y el número.
3. **Given** un marcador `ABIERTO`, `PROPUESTO` o `PLACEHOLDER` en una descripción del contrato
   o en la documentación, **When** se corre el listado, **Then** aparece con archivo, línea y
   texto.
4. **Given** al menos un marcador `ABIERTO` o `PLACEHOLDER`, **When** se corre la puerta de
   release, **Then** falla; con sólo `PROPUESTO`, pasa con aviso.
5. **Given** un documento vivo (guía de agentes, índice) con una cifra sobre el estado del
   sistema ("13 reglas", "68 pruebas"), **When** se lee la guía de agentes, **Then** la guía
   prohíbe escribirlas y remite al comando que las informa.

---

### User Story 4 - La arquitectura de capas se hace cumplir, no se recomienda (Priority: P2)

Un agente implementa una autoridad de dominio y, por comodidad, importa el framework HTTP o el
cliente de una base de datos dentro del módulo de dominio. La compilación o las pruebas fallan
señalando el import y la regla violada. El código existente queda organizado en capas —dominio
puro, puertos, adaptadores, manejadores— y todo lo de la 001 sigue funcionando igual.

**Why this priority**: la constitución (principio I) exige un módulo por autoridad, composition
root único y ningún cliente de infraestructura fuera de él. Hoy es prosa; la 003 (ingesta) es
la primera tentación real.

**Independent Test**: se agrega un archivo de dominio que importa el framework HTTP → la
verificación falla nombrando archivo y regla; se quita → pasa. Toda la suite de la 001 pasa
sin modificar sus aserciones.

**Acceptance Scenarios**:

1. **Given** un módulo bajo la capa de dominio que importa de la capa de adaptadores, del
   framework HTTP o de cualquier dependencia externa que no sea sólo tipos, **When** se corre
   la verificación de arquitectura, **Then** falla nombrando el archivo, el import y la regla.
2. **Given** un adaptador que importa de otro adaptador, o un manejador que instancia
   infraestructura, **When** se corre la verificación, **Then** falla.
3. **Given** el código de la 001 reubicado en capas, **When** se corre la suite completa,
   **Then** todas las pruebas pasan y el servidor responde igual (mismos códigos y cuerpos).
4. **Given** una operación autenticada (seguridad declarada no vacía), **When** se corre la
   verificación del contrato, **Then** falla si la operación no declara al menos una capacidad
   requerida; una operación pública no debe declararla.

---

### User Story 5 - Los esquemas se reutilizan, no se copian (Priority: P3)

Un agente escribe el esquema de una respuesta directamente dentro de la operación. La
verificación falla pidiendo que el esquema viva en componentes y se referencie.

**Why this priority**: evita el esquema duplicado "con variaciones sutiles" entre operaciones,
que es la forma más común en que un contrato grande deja de ser una sola verdad. Bajo costo.

**Independent Test**: contrato de prueba con un esquema inline en un media type → falla; con
`$ref` → pasa.

**Acceptance Scenarios**:

1. **Given** un media type de request o de respuesta cuyo esquema está escrito inline, **When**
   se corre la verificación, **Then** falla nombrando la operación y el media type.
2. **Given** el mismo media type con el esquema referenciado desde componentes, **When** se
   corre la verificación, **Then** pasa.

---

### Edge Cases

- **Invariante sobre un esquema compartido por varias operaciones**: se declara una vez sobre
  el esquema; la prueba nombrada por el tipo vale para todas.
- **Invariante cuyo tipo aún no tiene operación que lo emita** (por ejemplo, declarada en la
  spec de una feature antes del contrato): no existe fuera del contrato; la verificación sólo
  mira el contrato.
- **Sustantivo compuesto en una ruta** (`account-statement`): cada palabra resuelve por
  separado o el compuesto entero tiene nota; cualquiera de las dos vale.
- **Término del glosario sin uso en el contrato**: válido si declara `uso: disponible`
  (vocabulario del negocio que ninguna operación expone a propósito) o `uso: pendiente`
  (contrato aún no escrito); sin `uso` es error.
- **Marcador dentro de un ejemplo o de un bloque de código**: cuenta igual; si hace falta
  mencionar la palabra sin marcar nada, se escribe en minúsculas.
- **Cita a una decisión dentro del propio registro** (un ADR que cita a otro): se verifica
  igual.
- **Tipos importados de dependencias externas en el dominio** (`import type`): permitidos; el
  dominio no puede depender de ellas en runtime.
- **Archivo generado desde el contrato**: los manejadores y puertos pueden importar sus tipos;
  el dominio no lo importa (los DTO se traducen en el manejador).

## Requirements *(mandatory)*

### Functional Requirements

**Invariantes y catálogo de errores**

- **FR-001**: El contrato MUST permitir declarar invariantes sobre un esquema o una operación,
  cada una con: tipo de error (identificador del catálogo), código HTTP, regla (texto
  inequívoco) y descripción.
- **FR-002**: La verificación MUST fallar si una invariante carece de alguno de los cuatro
  campos, si su tipo no está en el catálogo, o si su código HTTP no coincide con el del tipo.
- **FR-003**: La verificación MUST fallar si una invariante declarada no tiene una prueba del
  servidor cuyo nombre contenga su tipo; el mensaje indica el tipo y dónde debe vivir la prueba.
- **FR-004**: La verificación MUST fallar si una operación declara una respuesta `422` cuyo
  ejemplo o descripción referencia el tipo genérico `unprocessable`; toda `422` de una
  operación nombra el tipo de su invariante. El tipo genérico permanece en el catálogo sólo
  como respuesta del servidor ante un rechazo sin tipo específico, y ninguna operación lo
  declara.
- **FR-005**: La verificación MUST listar, con el contrato actual, cero invariantes sin fallar.

**Glosario**

- **FR-010**: El repositorio MUST tener un glosario con una nota por término, con término en
  castellano, término en inglés, fuente y estado; la fuente es una referencia a un archivo (y
  opcionalmente una sección) de los documentos del MVP, de la constitución o del propio repo.
- **FR-011**: La verificación MUST fallar si un segmento de ruta o un título de esquema del
  contrato no resuelve (sin distinguir mayúsculas, singular/plural ni sufijos de convención
  como `Request`/`Response`/`List`) al término en inglés de una nota, salvo que esté en la
  lista de vocabulario técnico.
- **FR-012**: La verificación MUST fallar si una nota carece de fuente o la fuente no existe.
- **FR-013**: La verificación MUST fallar si una nota no se usa en el contrato y no declara
  `uso: disponible` o `uso: pendiente`.
- **FR-014**: La lista de vocabulario técnico MUST vivir en un solo lugar y ser ampliable.

**Decisiones y marcadores**

- **FR-020**: El repositorio MUST tener un registro de decisiones numerado (`ADR-NNN`) con
  estado, fecha y fuente por decisión, y las decisiones transversales de la 001 MUST
  migrarse a él; el research de la 001 pasa a citarlas.
- **FR-021**: La verificación MUST fallar si cualquier documento del repo cita un `ADR-NNN`
  que no existe.
- **FR-022**: Un comando MUST listar todos los marcadores `ABIERTO`, `PROPUESTO` y
  `PLACEHOLDER` presentes en el contrato y en la documentación, con archivo y línea.
- **FR-023**: Un comando de puerta de release MUST fallar si queda al menos un `ABIERTO` o
  `PLACEHOLDER`, y pasar con aviso si sólo hay `PROPUESTO`.
- **FR-024**: La guía de agentes MUST prohibir cifras sobre el estado del sistema en prosa
  viva y nombrar el comando que las informa.

**Contrato**

- **FR-030**: La verificación MUST fallar si un media type de request o respuesta lleva el
  esquema inline en vez de una referencia a componentes.
- **FR-031**: La verificación MUST fallar si una operación con seguridad no vacía no declara
  una lista no vacía de capacidades requeridas, y si una operación pública la declara.

**Arquitectura**

- **FR-040**: El código MUST organizarse en cuatro capas con dirección de dependencia fija:
  dominio (no importa de ninguna otra capa ni de dependencias externas salvo tipos), puertos
  (interfaces; sólo importan dominio), adaptadores (implementan puertos; importan puertos y
  dominio; no se importan entre sí), manejadores (traducen DTO ↔ dominio; importan dominio,
  puertos y tipos generados; no importan adaptadores). El composition root es el único que
  importa todo.
- **FR-041**: Una verificación ejecutable MUST fallar ante cualquier import que viole
  FR-040, nombrando archivo, import y regla, y MUST correr en el chequeo previo a commit y en
  integración continua.
- **FR-042**: El código de la 001 MUST reubicarse en esas capas sin cambiar comportamiento:
  toda prueba de la 001 pasa sin modificar sus aserciones (sólo rutas de import).

**Pruebas**

- **FR-050**: Cada regla nueva (FR-002, FR-003, FR-004, FR-011, FR-012, FR-013, FR-021,
  FR-023, FR-030, FR-031, FR-041) MUST tener un caso que la viola y una prueba que verifica la
  falla, siguiendo la convención de fixtures de la 001.
- **FR-051**: Todas las verificaciones nuevas MUST integrarse al comando único de verificación
  del contrato o al de pruebas, de modo que la integración continua las ejecute sin cambios de
  configuración adicionales.

### Key Entities

- **Invariante**: regla de negocio no expresable por esquema; atributos tipo, código HTTP,
  regla, descripción; pertenece a un esquema o a una operación; se prueba por su tipo.
- **Decisión (ADR)**: número, título, estado (propuesta / aceptada / reemplazada), fecha,
  fuente, contexto, decisión, consecuencias; citable como `ADR-NNN`.
- **Marcador**: palabra fija (`ABIERTO`, `PROPUESTO`, `PLACEHOLDER`) dentro de un texto;
  atributos archivo, línea, bloqueante o no.
- **Término del glosario**: castellano, inglés, contexto, fuente, estado, uso opcional.
- **Capa**: dominio, puertos, adaptadores, manejadores, composition root; relación "puede
  importar de".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las reglas nuevas tiene una prueba que demuestra la falla ante la
  violación (mismo criterio que la 001).
- **SC-002**: La verificación completa del contrato (la de la 001 más las nuevas) sigue
  corriendo localmente en menos de 30 segundos.
- **SC-003**: Toda la suite de la 001 pasa sin modificar ninguna aserción tras la
  reubicación en capas; el servidor responde byte a byte igual en los escenarios de la 001.
- **SC-004**: Un agente nuevo puede encontrar cualquier decisión transversal de la 001 en el
  registro de decisiones sin abrir el research de la 001.
- **SC-005**: El comando de listado de marcadores devuelve cero bloqueantes sobre el estado de
  esta feature (lo abierto de la constitución, D3–D6, se registra como ADRs en estado
  propuesta o como `PROPUESTO`, no como `ABIERTO` del contrato).
- **SC-006**: Con el contrato actual, el glosario contiene sólo los términos que el contrato
  usa (`health` es vocabulario técnico) y la verificación pasa; la primera ruta de dominio
  que se agregue sin nota falla.

## Assumptions

- Esta feature no agrega operaciones, persistencia ni autenticación; la regla de capacidades
  (FR-031) queda definida y probada con fixtures, sin operación real que la ejercite hasta
  la 003.
- La convención de nombre de prueba por invariante (FR-003) se resuelve en el plan; lo que la
  spec fija es que la relación invariante → prueba sea verificable por herramienta.
- Los marcadores de estado epistémico de la constitución (DECIDIDO / PROPUESTO / ABIERTO) se
  mantienen; `PLACEHOLDER` se agrega para valores de relleno (URLs de servidores, credenciales
  de ejemplo). `DECIDIDO` no es un marcador contable.
- Las decisiones D3–D6 de la constitución (hosting, merchant piloto, datos personales, muestra)
  siguen abiertas en los documentos del MVP; acá se referencian, no se cierran.
- La reubicación en capas no crea módulos de dominio nuevos: la capa de dominio nace vacía
  (o con el único valor puro existente, el estado de salud) y la prueba de arquitectura
  protege la dirección de dependencias desde ya.
- El repositorio hermano `las-animas` es la referencia de las prácticas; no se copia código de
  él sin adaptarlo a Problem Details y a las convenciones de la 001.
