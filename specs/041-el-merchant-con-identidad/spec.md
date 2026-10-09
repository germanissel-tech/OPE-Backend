# Feature Specification: El merchant con identidad

**Feature Branch**: `041-el-merchant-con-identidad`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Decisión del dueño del 2026-10-09, después de construir la consola (OPE-Web 005 y 006) y la
feature 040: la ficha del merchant lleva sólo lo operativo y no hay forma de saber qué merchant es sin
leer su primer origen. Cuatro campos nuevos del merchant, una operación de edición, y la decisión de
principio de que la persona de contacto del merchant no es una persona observada. Depende de la 040
(constitución VII 1.5.0, la excepción `x-personal-datum` del lint, los punteros bajo `/body`).

## Por qué existe

Un merchant, hoy, es `merchantId` acuñado, estado, orígenes, fecha de alta y credenciales por tipo
(ADR-031). Alcanza para operar: dar de alta, rotar, apagar. No alcanza para **reconocerlo**: la consola
lista merchants por identificador y por su primer origen, que es un dato técnico, puede ser uno de
veinte y puede ser `localhost`. Un operador con tres merchants los distingue de memoria; con diez, no.

Y no hay dónde dejar nada de la relación comercial: con quién se habla, en qué etapa está el piloto,
por qué se dio de alta. Hoy eso vive en la cabeza del operador o en un documento aparte que no está
atado al merchant.

Los idiomas, que también parecen «datos del merchant», no faltan: viven en su configuración
(`locales`, 01 §14.2) porque son una bandera que gobierna qué texto se sirve, y ahí se quedan.

## Lo decidido antes de la spec

1. **La persona de contacto no es una persona observada.** La constitución VII (1.5.0) protege al
   visitante y al comprador: las personas que OPE observa sin que lo sepan. La persona de contacto del
   merchant es parte del contrato de negocio, como el operador: una persona **identificada** de la
   relación comercial, que sabe que OPE la tiene registrada y para qué. La frase de VII que hoy nombra
   sólo al operador como excepción se amplía a «las personas identificadas de la relación comercial:
   el operador y el contacto del merchant», con una enmienda de redacción. Decidido con el dueño el
   2026-10-09.
2. **Lo que VII protege sigue protegido por la herramienta.** El lint que prohíbe datos personales
   sigue prohibiendo nombre, email y teléfono en todo esquema del contrato; la excepción se declara en
   el esquema que lleva el dato, con nombre y razón por propiedad, y alcanza **sólo** al contacto del
   merchant bajo el consumidor `admin`. Los consumidores `public`, `sdk`, `platform` y `portal` siguen
   sin ningún dato personal, y el lint lo verifica.
3. **El contacto no sale de la administración.** Nunca entra en una decisión, en lo que ve el SDK, en
   lo que ve la plataforma, en el registro de administración (que registra **qué** cambió y quién, no
   los valores) ni en los registros del servidor.
4. **Un merchant existente sigue siendo válido.** `displayName` es obligatorio al crear, no al leer:
   los merchants creados antes de esta feature y la semilla de desarrollo se sirven sin él hasta que
   un operador los edite. Nadie inventa un nombre.
5. **Editar la identidad no es editar el merchant.** La operación nueva cambia sólo estos cuatro
   campos. Orígenes, estado, interruptor y credenciales tienen sus propias operaciones y sus propias
   reglas, y no se tocan desde acá.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El operador reconoce cada merchant por su nombre (Priority: P1)

Un operador da de alta un merchant con el nombre de la tienda y, si la tiene, la URL por la que una
persona entra a comprar. Desde entonces la consola lo lista y lo encabeza por ese nombre, y la ficha
muestra la URL como un enlace, separada de los orígenes técnicos.

**Why this priority**: es el hueco que se ve primero y en todas las pantallas: sin nombre, cada lista
de merchants es una lista de identificadores.

**Independent Test**: crear un merchant con `displayName` y `storeUrl`, leerlo y verlo en la lista con
los dos campos; crear uno sin `displayName` y recibir el rechazo que señala el campo.

**Acceptance Scenarios**:

1. **Given** un operador con alcance sobre todos los merchants, **When** crea un merchant con
   `displayName: "Tienda Norte"`, `storeUrl: "https://www.tiendanorte.example"` y sus orígenes,
   **Then** la respuesta del alta y toda lectura posterior (ficha y lista) traen los dos campos tal
   como se escribieron.
2. **Given** un alta sin `displayName`, **When** se pide, **Then** se rechaza antes de crear nada,
   señalando el campo, y no queda ningún merchant a medias.
3. **Given** un alta con `displayName` vacío o sólo espacios, o con un `storeUrl` que no es una URL
   `http` o `https`, **When** se pide, **Then** se rechaza señalando el campo.
4. **Given** un merchant creado antes de esta feature, **When** se lo lee, **Then** llega sin
   `displayName` ni `storeUrl`, y la consola lo muestra por su identificador como hasta hoy.

---

### User Story 2 - El operador edita la identidad del merchant (Priority: P1)

Un operador corrige el nombre de un merchant, le pone la URL que faltaba, anota con quién habla y en
qué etapa está. Lo hace con una sola operación que cambia sólo eso, y la acción queda en el registro
de administración como cualquier escritura de un operador.

**Why this priority**: sin edición, un nombre mal escrito al alta es para siempre, y los merchants
existentes nunca tendrían nombre.

**Independent Test**: editar los cuatro campos de un merchant, leerlo y encontrarlos; intentarlo
sobre un merchant fuera del alcance del operador y recibir `403` sin que la respuesta revele si el
merchant existe; ver la entrada en el registro de administración sin ninguno de los valores.

**Acceptance Scenarios**:

1. **Given** un merchant con nombre, **When** un operador con alcance edita `displayName`, `storeUrl`,
   `contact` y `notes`, **Then** la lectura siguiente trae exactamente lo enviado, y los orígenes, el
   estado y las credenciales no cambiaron.
2. **Given** un merchant con `storeUrl`, `contact` y `notes`, **When** la edición no trae alguno de los
   tres, **Then** ese campo queda vacío: la edición es la identidad completa, no un parche.
3. **Given** un merchant creado antes de esta feature, **When** un operador lo edita con un
   `displayName`, **Then** desde entonces se lee con nombre, y una edición sin `displayName` se rechaza
   señalando el campo.
4. **Given** un operador cuyo alcance no incluye al merchant, **When** intenta editarlo, **Then**
   recibe `403 merchant-out-of-scope` con el mismo cuerpo que recibiría para un merchant que no
   existe, y la denegación queda en el registro.
5. **Given** una edición aceptada, **When** se lee el registro de administración del merchant,
   **Then** hay una entrada con el operador, la operación y el merchant, y ninguno de los valores
   escritos (ni el nombre, ni el contacto, ni las notas).
6. **Given** un merchant desactivado, **When** se edita su identidad, **Then** se acepta: la
   identidad es de la relación comercial, no del estado operativo.

---

### User Story 3 - El contacto del merchant vive en la ficha, y en ningún otro lado (Priority: P2)

Un operador anota la persona de contacto del merchant —nombre, email, teléfono, rol— y la ve en la
ficha. Nada más la ve: ni el SDK, ni la plataforma, ni el registro, ni los logs del servidor.

**Why this priority**: es el dato que hoy vive fuera de OPE y el que más cuidado exige, porque es el
primer dato personal del contrato que no es del operador. Va después de las otras dos porque sin ellas
no hay ficha que lo muestre.

**Independent Test**: editar un merchant con `contact`, leerlo y encontrarlo; con el lint del
contrato, verificar que `email` en el esquema de una orden, de un evento o del portal falla, y que
en el del contacto pasa con su razón; con el servidor, verificar que el contacto no aparece en los
registros de un pedido que lo escribe ni en lo que ve el SDK.

**Acceptance Scenarios**:

1. **Given** un merchant, **When** un operador lo edita con
   `contact: { name, email, phone?, role? }`, **Then** la ficha lo trae completo y la lista de
   merchants también, porque son el mismo esquema.
2. **Given** un `contact` con `email` que no tiene forma de email, o con `name` vacío, **When** se
   pide, **Then** se rechaza señalando el campo.
3. **Given** el contrato, **When** se corre su lint, **Then** `name`, `email` y `phone` pasan sólo en
   el esquema del contacto del merchant, cada uno con su razón declarada, y fallan en cualquier otro
   esquema; una excepción sin razón falla.
4. **Given** una edición con contacto, **When** se leen los registros del servidor de ese pedido,
   **Then** no contienen el nombre, el email ni el teléfono; y lo que el SDK y la plataforma reciben
   del merchant no cambia en nada.

---

### Edge Cases

- **Dos merchants con el mismo nombre**: se admite. El nombre es para reconocer, no para identificar;
  el identificador sigue siendo `merchantId`, y los orígenes siguen siendo únicos entre merchants.
- **Un `storeUrl` que no coincide con ningún origen registrado**: se admite. La URL es para una
  persona (puede ser `https://www.tienda.example/es/` con camino y todo); los orígenes son para el
  tag.
- **Una edición que trae orígenes, estado o credenciales**: se rechaza como campo no declarado, igual
  que cualquier campo que el contrato no admite en ese cuerpo.
- **Notas largas**: hay un tope, declarado en el contrato; una nota que lo supera se rechaza señalando
  el campo, no se recorta.
- **Dos operadores editan el mismo merchant a la vez**: gana el último. El testigo de concurrencia es
  de una feature posterior (`TAN-10` como referencia), como ya se decidió en la 040.
- **El merchant de la semilla de desarrollo**: puede traer los cuatro campos en su archivo, y los
  valores de contacto que trae son de prueba, no de una persona.
- **Desactivar un merchant no borra su identidad ni su contacto**: la relación comercial sigue, y el
  régimen de retención de datos personales (D5) sigue abierto y no se cierra acá.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El merchant que la administración lee (ficha y lista) MUST llevar `displayName`,
  `storeUrl`, `contact` y `notes`, los cuatro opcionales en la lectura, con `contact` como objeto de
  `name` (obligatorio dentro del contacto), `email` (obligatorio dentro del contacto), `phone` y
  `role`.
- **FR-002**: El alta de un merchant MUST exigir `displayName` y MUST admitir `storeUrl`, `contact` y
  `notes`; todo lo demás del alta no cambia.
- **FR-003**: El contrato MUST declarar una operación del consumidor `admin`, sobre el merchant
  nombrado en la ruta, que reemplaza su identidad completa (`displayName` obligatorio; `storeUrl`,
  `contact` y `notes` opcionales, y ausentes significa vacíos) y MUST NOT admitir ningún otro campo
  del merchant.
- **FR-004**: Esa operación MUST exigir la capacidad de escritura sobre merchants, MUST respetar el
  alcance del operador con `403 merchant-out-of-scope` sin revelar la existencia del merchant, y MUST
  auditarse como toda escritura de un operador.
- **FR-005**: La entrada del registro de administración de esa operación MUST NOT llevar ninguno de
  los valores escritos; registra operador, operación, merchant y resultado.
- **FR-006**: `displayName` MUST ser texto no vacío, sin espacios en los bordes, con un largo máximo
  declarado en el contrato; `storeUrl` MUST ser una URL absoluta `http` o `https`; `contact.email`
  MUST tener forma de email; `notes` MUST tener un largo máximo declarado. Un valor que no cumple se
  rechaza señalando el campo, antes de escribir nada.
- **FR-007**: Un merchant que existe sin `displayName` MUST seguir leyéndose y operándose
  (configuración, credenciales, interruptor, experimentos) exactamente como hoy.
- **FR-008**: Los cuatro campos MUST sobrevivir un reinicio del servidor con el almacén durable, y
  MUST aislarse entre merchants: un operador cuyo alcance no incluye un merchant no lee ni escribe su
  identidad.
- **FR-009**: Ninguna operación de los consumidores `public`, `sdk`, `platform` ni `portal` MUST
  llevar estos campos en sus esquemas, y los registros del servidor MUST NOT contener el nombre, el
  email ni el teléfono del contacto.
- **FR-010**: La constitución VII MUST ampliar su excepción del operador a «las personas identificadas
  de la relación comercial: el operador y el contacto del merchant», con versión nueva y fecha, sin
  cambiar lo que protege.
- **FR-011**: El lint `ope-no-pii` MUST admitir más de una propiedad excusada por esquema, cada una
  con su razón, y la excepción MUST declararse sólo en el esquema del contacto del merchant; una
  fixture MUST verificar que `email` en otro esquema sigue fallando y que una excepción sin razón
  falla.
- **FR-012**: El cambio del contrato MUST ser compatible (cambio menor): campos opcionales en la
  lectura, un campo obligatorio nuevo en el alta aceptado como compatible porque el contrato está
  marcado `building` (ADR-003) y la operación de edición nueva.
- **FR-013**: La operación nueva MUST pasar por el mapa del contrato (`planned` → `built`, feature
  `041`), y la nota de dominio del merchant, el glosario y los README con inventario MUST decir lo
  que quedó.
- **FR-014**: `generated/contract/` MUST traer los campos nuevos en las restricciones de los cuerpos
  de pedido, y OPE-Web MUST poder sincronizar con `contract:sync` sin tocar su conformidad.

### Key Entities

- **La identidad del merchant**: nombre para mostrar, URL de la tienda, persona de contacto y notas
  del operador. Es de la relación comercial; cambia con una sola operación y no toca lo operativo.
- **La persona de contacto**: nombre, email, teléfono opcional y rol opcional. Es la segunda persona
  identificada del sistema (la primera es el operador) y la única cuyo nombre, email y teléfono el
  contrato lleva; sólo bajo `admin`.
- **El merchant operativo** (ADR-031): identificador, estado, orígenes, credenciales. No cambia.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **La consola lista por nombre y muestra la ficha completa** con los cuatro campos,
  después de `contract:sync` y de su propio cambio de pantallas, con su conformidad en verde sin
  tocarla. Verificable corriendo `npm run contract:sync` y `npx ope-check` en OPE-Web.
- **SC-002**: **Un alta y una edición con los cuatro campos se leen tal cual**, y un merchant de antes
  sigue leyéndose sin ellos. Verificable contra `npm run dev` con `curl`.
- **SC-003**: **Un operador fuera del alcance recibe `403`** con el mismo cuerpo que para un merchant
  inexistente, y la denegación queda registrada. Verificable con las pruebas de aislamiento.
- **SC-004**: **El contacto no aparece** en el registro de administración, en los registros del
  servidor ni en ninguna respuesta de `public`, `sdk`, `platform` o `portal`. Verificable con las
  pruebas de privacidad de registros y con el lint del contrato.
- **SC-005**: **Nada de lo que hoy se verifica deja de verificarse**: `contract:check`, `npm test`,
  `test:contract`, mutación y durabilidad en verde; `ope-no-pii` sigue fallando con `email` fuera del
  contacto.
- **SC-006**: **El contrato es compatible**: `contract:diff` lo clasifica como cambio menor.

## Assumptions

- Los largos máximos son del contrato y se fijan en el plan con criterio de formulario: un nombre de
  tienda, una URL, un email, un teléfono y unas notas de unos párrafos. No son políticas de negocio;
  son el tope de lo que un operador teclea.
- La edición es un reemplazo completo de la identidad (los cuatro campos), no un parche: es lo que la
  consola ya hace con las versiones de configuración, y evita definir qué significa «ausente» en un
  parche.
- `storeUrl` se guarda como se escribió, sin normalizar: es para que una persona la abra.
- El contacto es uno por merchant. Dos contactos, o un contacto por rol, es una feature posterior si
  hace falta.
- La semilla de desarrollo (`config/dev-merchants.json`) puede traer los campos; si no los trae, el
  merchant de desarrollo se lee sin nombre hasta que alguien lo edite.
- La ampliación de VII es de redacción: no cambia a quién protege ni qué prohíbe, dice quién más
  queda fuera de lo observado. El plan la lleva al Constitution Check con versión nueva, y el dueño la
  ratifica al acordar el plan.

## Out of Scope

- Buscar o filtrar merchants por nombre: la lista es corta y la consola ordena del lado del cliente.
- Más de un contacto por merchant, o el contacto como una cuenta que entra a algún lado (el portal
  tiene su propio principal, ADR-020).
- Testigo de concurrencia en la edición (`If-Match`): feature posterior, `TAN-10` como referencia.
- Retención y borrado de los datos del contacto: régimen de datos personales D5, abierto en ADR-010.
- Cambiar orígenes, estado o credenciales desde la edición de identidad: tienen sus operaciones.
- Las pantallas de la consola: esta feature da los datos; cómo se muestran es de OPE-Web.
