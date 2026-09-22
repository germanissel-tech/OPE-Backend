# Feature Specification: Grafo de composición tipado y seguridad con dueño

**Feature Branch**: `020-grafo-de-composicion`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Auditar `src/composition/` tomando `modules/merchant.ts` y `modules/decision.ts` como referencia y challengear el diseño contra el estado del arte. Intención: que el cableado sea un **grafo tipado** donde la mayor parte de los errores de programación se atrapen en compilación, que la seguridad tenga un dueño, y que la composición deje de decidir comportamiento. Sin cambiar ningún comportamiento observable." (Decisión del dueño, 2026-09-22, tras la sesión de auditoría de la composición.)

## Contexto

El composition root hace DI manual, sin contenedor (ADR-013): cada módulo declara los puertos que
necesita, cómo los sirve cada tecnología y lo que sirve al servidor; un perfil compone. La
dirección es correcta y no se cuestiona. Lo que la auditoría del 2026-09-22 encontró es que la
**ejecución** de esa idea creció sin dos cosas: un grafo que el compilador pueda verificar y un
dueño para lo transversal.

Medido en `main` (`eb32fc2`):

- **Resolución por nombre, no por dependencia.** `Ports` es la intersección de trece slices y el
  enlazador resuelve por clave (`overrides[key] ?? bindings[key]()`). `clock` se declara 14
  veces, `logger` 12, el registro de administración 6, la configuración 5, el store de merchants 4.
- **El perfil es un spread ordenado a mano**, con envoltorios perezosos para las dependencias
  cruzadas y un comentario que admite el orden implícito ("el kernel se enlaza primero porque la
  deduplicación comparte su reloj"). Un orden equivocado no falla al compilar: da un valor
  indefinido en ejecución.
- **ISP roto**: los puertos del plano de decisión heredan los slices de experimento, catálogo,
  barrera y ledger; el plano pide los ingredientes de cuatro módulos en vez de los servicios ya
  construidos.
- **El acoplamiento entre módulos de composición no lo vigila nadie**: el módulo de decisión
  importa cinco módulos y el de ingesta importa el de decisión; el mapa de contextos rige en los
  otros tres anillos pero no en la composición. El módulo de merchants importa el de
  administración **violando ese mapa en silencio**.
- **Servicios construidos en el punto de uso**: el servicio de alcance de merchants se instancia
  en cuatro módulos; el de estado y el registrador de decisiones, dentro de la expresión que arma
  el plano.
- **Ceremonia sin contenido**: dos módulos existen sólo para figurar en la lista (devuelven un
  objeto vacío); hay cinco firmas distintas de tabla de enlace; el nombre de cada operación viaja
  dos veces (el literal del envoltorio de log y la clave del handler), 21 veces en total.
- **La composición decide comportamiento**: un adaptador del root lleva una regla de negocio ("un
  merchant que el store no conoce está apagado"); los topes de memoria de sesión y de visitante se
  toman del tope de la deduplicación de eventos sin decisión que lo respalde; varias
  implementaciones de puerto son objetos anónimos escritos en la composición.
- **La seguridad no tiene dueño**: los tres esquemas del contrato, sus resolvedores y las
  políticas de seguridad del nivel de plataforma (ventana de firma, gracia de rotación, tolerancia
  de reloj) están repartidos entre los módulos de merchants, administración y el kernel. El módulo
  de merchants tiene dos motivos de cambio.

### Decisiones tomadas en la evaluación (2026-09-22, dueño)

- **Se conserva la DI manual**: nada de contenedores ni de adoptar un framework de efectos. Los
  contenedores del ecosistema quedan descartados por las reglas del repositorio (decoradores y
  metadatos reflexivos prohibidos; resolución por texto prohibida).
- **Prohibido resolver por texto.** Un componente se pide por una constante importada, no por su
  nombre. Consecuencia buscada: el acoplamiento entre módulos vuelve a ser un import y la
  verificación de arquitectura puede juzgarlo.
- **Los requisitos viajan en el tipo**: la cobertura la verifica el compilador, no el arranque.
- **La auditoría de operaciones es una obligación de plataforma**, no una función del módulo de
  administración: su puerto de escritura y su decorador van al kernel. Alternativa descartada:
  ampliar el mapa de contextos con una excepción para que todos vean al módulo de administración.
- **Ningún comportamiento observable cambia**: contrato, mapa, respuestas, códigos, headers y logs
  idénticos; la suite existente es el juez.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El cableado es un grafo que el compilador verifica (Priority: P1)

Como persona o agente que agrega o mueve una dependencia, quiero que el ensamblado sea un grafo
donde cada pieza declara qué provee y qué necesita, y que el compilador rechace un ensamblado
incompleto, para que un olvido no llegue a ejecución disfrazado de valor indefinido.

**Why this priority**: es la deuda que origina a las demás; sin el grafo, el resto son parches.

**Independent Test**: el ensamblado del despliegue no compila si falta el proveedor de algo que
alguien necesita; no hay envoltorios perezosos ni orden significativo; el arranque y toda la suite
se comportan igual que antes.

**Acceptance Scenarios**:

1. **Given** un componente que alguien necesita y ningún proveedor lo sirve, **When** se compila,
   **Then** falla nombrando el componente que falta.
2. **Given** una tabla de proveedores de una tecnología a la que le falta uno de los componentes
   que declara servir, **When** se compila, **Then** falla.
3. **Given** el ensamblado del despliegue, **When** se lee, **Then** no tiene orden significativo:
   reordenar sus entradas no cambia el resultado y ninguna entrada recibe un envoltorio perezoso
   para esperar a otra.
4. **Given** un componente que dos consumidores comparten, **When** se resuelve, **Then** es la
   misma instancia (una por arranque), sin estado global ni acceso estático.
5. **Given** un ciclo entre proveedores, **When** arranca el servidor, **Then** falla nombrando el
   ciclo completo, y una prueba lo demuestra.
6. **Given** dos vistas del mismo componente (lectura y escritura), **When** se declara la
   derivada, **Then** enlazarla a otra instancia no compila.
7. **Given** toda la suite (unitaria, integración, contrato, Schemathesis, carga), **When** corre
   tras el cambio, **Then** pasa sin modificar una sola aserción de comportamiento.

---

### User Story 2 - Un módulo de composición tiene una forma y nada más (Priority: P1)

Como dueño del repositorio, quiero que un módulo de composición exporte exactamente tres cosas
—lo que provee por tecnología, lo que expone a otros módulos y lo que sirve al servidor—, para que
no haya canales laterales por donde un módulo alcance a otro sin permiso.

**Why this priority**: sin la forma, el grafo se llena de atajos; con ella, el acoplamiento es
explícito y auditable.

**Independent Test**: una verificación de forma reporta un módulo que exporte cualquier otra cosa;
el mapa de contextos reporta un import prohibido entre módulos de composición, con su fixture.

**Acceptance Scenarios**:

1. **Given** un módulo de composición, **When** se listan sus exportaciones, **Then** son sólo
   proveedores por tecnología, lo expuesto y lo servido; cualquier otra exportación se reporta.
2. **Given** un módulo que no sirve ninguna operación, **When** se lee, **Then** omite esa parte;
   no existe una función que devuelva un objeto vacío para figurar en una lista.
3. **Given** un módulo que consume algo de otro, **When** se revisa el grafo de imports, **Then**
   la dependencia es visible y el mapa de contextos la juzga; una no permitida se reporta.
4. **Given** el módulo de decisión, **When** se leen sus necesidades, **Then** son sólo las suyas:
   pide servicios ya construidos de las otras autoridades, no los ingredientes de sus módulos.
5. **Given** un servicio que varios módulos usan, **When** se busca dónde se construye, **Then**
   hay un solo lugar y los demás lo consumen.

---

### User Story 3 - Ningún puerto queda sin enlace y ninguna implementación esquiva el grafo (Priority: P2)

Como ingeniero, quiero que declarar una abstracción y no enlazarla falle el build, y que nadie
pueda construir la implementación de un puerto fuera del grafo, para que la pregunta "¿esto está
realmente cableado?" no dependa de la disciplina de quien escribió el módulo.

**Why this priority**: es lo que convierte la garantía del grafo en una garantía del repositorio;
sin esto, el camino correcto es opcional.

**Independent Test**: una verificación nueva falla ante una abstracción declarada y no enlazada;
una regla de forma falla ante una implementación de puerto construida fuera de su enlace; cada una
con su fixture.

**Acceptance Scenarios**:

1. **Given** una abstracción declarada por un módulo de aplicación que ningún módulo de
   composición enlaza, **When** corre la verificación, **Then** falla nombrando la abstracción y
   el archivo.
2. **Given** una implementación de puerto construida fuera del enlace correspondiente (una clase
   de adaptador instanciada directamente, o un objeto escrito en línea que hace de
   implementación), **When** corre la verificación de forma, **Then** se reporta.
3. **Given** lo que un módulo sirve o expone, **When** se revisa, **Then** allí sólo se instancian
   casos de uso y servicios de la aplicación, con valores obtenidos del grafo.
4. **Given** las dos verificaciones, **When** se agregan, **Then** cada una tiene su fixture que
   la dispara y el código real pasa limpio.

---

### User Story 4 - La seguridad tiene dueño (Priority: P2)

Como responsable de la seguridad del sistema, quiero un solo lugar donde estén los esquemas de
autenticación de los tres consumidores, sus resolvedores y las políticas de seguridad del nivel de
plataforma, para poder revisar "cómo se autentica cada consumidor" leyendo un módulo en vez de
buscando por el repositorio.

**Why this priority**: es un problema de responsabilidad única con consecuencias de auditoría; no
depende del grafo, pero el grafo lo hace barato.

**Independent Test**: un módulo agrupa los tres esquemas, sus resolvedores y las políticas de
seguridad del nivel de plataforma; el módulo de merchants deja de servir esquemas y conserva el
agregado y su administración; el comportamiento de autenticación no cambia (las pruebas de
seguridad existentes pasan sin tocarse).

**Acceptance Scenarios**:

1. **Given** el módulo de seguridad, **When** se lee, **Then** contiene los tres esquemas del
   contrato, sus resolvedores y las políticas de seguridad del nivel de plataforma.
2. **Given** el módulo de merchants, **When** se lee, **Then** ya no declara esquemas de seguridad
   ni políticas de firma o rotación; conserva el agregado, su administración y la vista de lectura
   que la seguridad consume.
3. **Given** las pruebas de autenticación, autorización, firma y alcance existentes, **When**
   corren, **Then** pasan sin cambiar una aserción.
4. **Given** una política de seguridad del nivel de plataforma, **When** se busca su
   implementación, **Then** tiene nombre y vive con los adaptadores de su módulo, no escrita en la
   composición.

---

### User Story 5 - La composición deja de decidir comportamiento (Priority: P3)

Como dueño, quiero que ninguna regla de negocio ni valor de política viva en el composition root,
para que la constitución XI («ninguna política vive en el código») valga también un nivel más
arriba.

**Why this priority**: es lo que hace que la auditoría de comportamiento se pueda hacer por módulo;
sin esto, quedan reglas escondidas en el ensamblado.

**Independent Test**: el directorio de adaptadores del root no existe; ninguna implementación de
puerto es un objeto anónimo escrito en la composición; el tope compartido entre memorias está
decidido explícitamente; el nombre de una operación aparece una sola vez.

**Acceptance Scenarios**:

1. **Given** la regla del interruptor ("un merchant que el store no conoce está apagado"), **When**
   termina la feature, **Then** vive en el módulo cuyo mapa de contextos lo permite, y el
   directorio de adaptadores del root no existe.
2. **Given** las implementaciones de política del nivel de plataforma, **When** se buscan, **Then**
   tienen nombre y viven con los adaptadores de su módulo.
3. **Given** los topes de memoria de sesión y de visitante, **When** se leen, **Then** cada uno
   tiene su valor propio en el nivel de plataforma, o una decisión registrada dice por qué comparte
   el de la deduplicación.
4. **Given** el nombre de una operación, **When** se busca, **Then** aparece una sola vez (la clave
   que el contrato verifica) y lo demás lo deriva de ahí.
5. **Given** los controllers que hoy reciben un reloj sólo para componer la respuesta, **When**
   termina la feature, **Then** dejan de recibirlo, o queda escrito por qué el instante no puede
   llegar con el resultado.

---

### User Story 6 - La auditoría de operaciones deja de ser una excepción (Priority: P3)

Como dueño, quiero que registrar lo que hace un operador no obligue a un módulo a depender del
módulo de administración, para que el mapa de contextos no necesite una excepción y la trazabilidad
(constitución IX) sea una obligación de plataforma, como el log.

**Why this priority**: cierra la última violación silenciosa del mapa; es requisito para que la
regla de la historia 2 pase en verde sin excepciones.

**Independent Test**: ningún módulo importa el de administración para auditar; el mapa de contextos
pasa sin excepciones; el registro de administración sigue conteniendo exactamente lo mismo que hoy
(las pruebas del registro pasan sin cambios).

**Acceptance Scenarios**:

1. **Given** un módulo que audita lo que hace un operador, **When** se revisan sus imports,
   **Then** depende de una abstracción del kernel, no del módulo de administración.
2. **Given** el módulo de administración, **When** se lee, **Then** conserva la entrada del
   registro, su almacenamiento y las lecturas paginadas, e implementa la abstracción del kernel.
3. **Given** una operación aceptada, rechazada o denegada, **When** se consulta el registro,
   **Then** la entrada es idéntica a la de hoy en todos sus campos.
4. **Given** la identidad del operador, **When** cruza el borde del kernel, **Then** la pérdida de
   tipado está acotada a ese borde y documentada, y la implementación del módulo de administración
   la vuelve a tipar.

---

### Edge Cases

- **Un componente con dos vistas** (lectura y escritura sobre el mismo almacén): la derivación se
  declara; un enlace suelto de la vista no compila.
- **Un ciclo** entre proveedores: el tipo no puede expresarlo de forma practicable; se detecta al
  arrancar, nombra el ciclo y tiene prueba.
- **Dos valores del mismo tipo con distinto significado** (la ventana de visitante y la de sesión):
  el compilador no puede distinguirlos; se cubre con prueba y, donde convenga, con tipos propios.
- **Un módulo que sólo sirve operaciones y nadie requiere sus componentes**: la cobertura de las
  operaciones del contrato lo atrapa en compilación.
- **Sustituciones en pruebas**: reemplazar un componente por un doble debe seguir siendo posible
  sin reconstruir el grafo entero, y la sustitución de una vista derivada no debe poder romper la
  identidad.
- **Una tecnología nueva** (persistencia): agregarla es otra tabla junto a la de memoria y una
  entrada del despliegue; ningún consumidor cambia. La feature no la construye, pero el diseño se
  juzga contra ese caso.
- **Etiquetas de diagnóstico**: cada componente lleva una etiqueta en su única declaración, para
  los mensajes de error; nunca se compara ni se repite, y no es un identificador de resolución.
- **Sustituciones desde el arranque** (semilla de merchants, operadores): siguen entrando por los
  mismos casos de uso y quedan auditadas igual.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El ensamblado MUST resolver cada componente por una referencia declarada, no por su
  nombre; resolver por texto MUST estar prohibido y verificado.
- **FR-002**: Cada proveedor MUST declarar los componentes de los que depende, y el ensamblado de
  un despliegue MUST no compilar si algún requisito queda sin proveedor.
- **FR-003**: Una tabla de proveedores de una tecnología MUST no compilar si le falta alguno de los
  componentes que declara servir.
- **FR-004**: El ensamblado MUST ser independiente del orden y MUST no requerir envoltorios
  perezosos para dependencias cruzadas.
- **FR-005**: Un componente MUST resolverse una sola vez por arranque y compartirse entre sus
  consumidores, sin estado global ni acceso estático.
- **FR-006**: Un ciclo entre proveedores MUST fallar al arrancar nombrando el ciclo.
- **FR-007**: Dos vistas del mismo componente MUST declararse como derivación, de modo que enlazar
  la vista a otra instancia no compile.
- **FR-008**: Un módulo de composición MUST exportar sólo lo que provee por tecnología, lo que
  expone y lo que sirve; una verificación de forma MUST reportar cualquier otra exportación.
- **FR-009**: Un módulo que no sirve operaciones MUST poder omitir esa parte; no MUST existir
  ceremonia vacía para figurar en una lista.
- **FR-010**: Un módulo MUST declarar sólo sus propias necesidades y MUST consumir de otro módulo
  servicios ya construidos, nunca los componentes internos de ese otro módulo.
- **FR-011**: El mapa de contextos MUST regir también entre módulos de composición, con su fixture.
- **FR-012**: Un servicio compartido MUST construirse en un solo lugar y consumirse desde el grafo.
- **FR-013**: La cobertura de las operaciones que el contrato declara MUST verificarse en
  compilación.
- **FR-014**: Toda abstracción que un módulo de aplicación declara como puerto MUST estar enlazada
  en el grafo; una verificación nueva MUST fallar si no lo está.
- **FR-015**: Una implementación de puerto MUST construirse sólo dentro de su enlace; una regla de
  forma MUST reportar una implementación construida fuera (incluido un objeto escrito en línea).
- **FR-016**: Lo que un módulo sirve o expone MUST instanciar sólo casos de uso y servicios de la
  aplicación, con valores obtenidos del grafo.
- **FR-017**: Los esquemas de autenticación de los tres consumidores, sus resolvedores y las
  políticas de seguridad del nivel de plataforma MUST pertenecer a un solo módulo, que MUST
  consumir del módulo de merchants sólo la vista de lectura.
- **FR-018**: El módulo de merchants MUST conservar el agregado y su administración y MUST no
  declarar esquemas de seguridad ni políticas de firma o rotación.
- **FR-019**: Ninguna regla de negocio MUST vivir en el composition root; el directorio de
  adaptadores del root MUST desaparecer.
- **FR-020**: Toda implementación de una política del nivel de plataforma MUST tener nombre y vivir
  con los adaptadores de su módulo.
- **FR-021**: Los topes de memoria de sesión y de visitante MUST tener valor propio en el nivel de
  plataforma, o una decisión registrada MUST declarar por qué comparten el de la deduplicación.
- **FR-022**: El nombre de una operación MUST aparecer una sola vez, en la clave que el contrato
  verifica.
- **FR-023**: Los controllers MUST no recibir un reloj para componer la respuesta si el instante
  puede llegar con el resultado del caso de uso; si no puede, el motivo MUST quedar escrito.
- **FR-024**: La escritura del registro de operaciones MUST ser una abstracción del kernel con su
  decorador; el módulo de administración MUST conservar la entrada, el almacenamiento y las
  lecturas, e implementarla.
- **FR-025**: Ningún módulo MUST importar el módulo de administración para auditar, y el mapa de
  contextos MUST pasar sin excepciones.
- **FR-026**: El comportamiento observable MUST no cambiar: contrato, mapa del contrato,
  respuestas, códigos, headers, logs y entradas del registro idénticos; ninguna aserción de
  comportamiento MUST modificarse.
- **FR-027**: Todos los gates MUST quedar en verde sin ninguna excepción nueva de lint, idioma,
  arquitectura, duplicación, código muerto ni mutación.
- **FR-028**: Las decisiones transversales (el grafo, el dueño de la seguridad, la abstracción de
  auditoría en el kernel) MUST quedar registradas, y las instrucciones para agentes MUST describir
  la forma nueva.

### Key Entities

- **Componente**: algo que el grafo resuelve y comparte: lo que sirve una tecnología (un almacén,
  un reloj, una política) o lo que un módulo expone (un servicio construido).
- **Proveedor**: la manera de construir un componente a partir de los componentes que declara
  necesitar.
- **Tabla por tecnología**: el conjunto de proveedores con que una tecnología sirve los componentes
  de un módulo; el despliegue elige una por módulo.
- **Módulo de composición**: lo que provee, lo que expone y lo que sirve, y nada más.
- **Despliegue**: la lista de módulos con la tecnología elegida para cada uno; la única lista.
- **Vista derivada**: un componente que es otro visto por una interfaz más angosta, con identidad
  garantizada.
- **Etiqueta**: el nombre legible de un componente, declarado una vez, usado sólo en mensajes de
  error.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Agregar un módulo toca **tres** archivos (el del módulo, el del despliegue y el mapa
  de contextos); omitir cualquiera falla en compilación o en la verificación de arquitectura, nunca
  en ejecución.
- **SC-002**: Cero resoluciones por texto; cero envoltorios perezosos en el despliegue; cero
  necesidades heredadas de otro módulo; cero módulos con ceremonia vacía; cero servicios
  compartidos construidos más de una vez; cero adaptadores en el root.
- **SC-003**: Un componente sin proveedor, un despliegue incompleto, una vista mal enlazada y una
  operación del contrato sin servir **no compilan**; cada caso tiene su prueba de tipos.
- **SC-004**: Un ciclo falla al arrancar nombrando el ciclo; hay una prueba que lo demuestra.
- **SC-005**: Una abstracción de puerto sin enlace falla la verificación nueva; una implementación
  fuera de su enlace falla la regla de forma; un import prohibido entre módulos de composición lo
  reporta la verificación de arquitectura; cada regla con su fixture.
- **SC-006**: Un solo módulo contiene los tres esquemas de autenticación, sus resolvedores y las
  políticas de seguridad del nivel de plataforma; el de merchants no contiene ninguno.
- **SC-007**: La suite completa —unitaria, integración, reglas del contrato, gobernanza,
  arquitectura, herramientas, Schemathesis, carga— pasa **sin cambiar ninguna aserción de
  comportamiento**; el contrato y su mapa no tienen diff.
- **SC-008**: Todos los gates en verde con cero excepciones nuevas; el gate de mutación sin
  sobrevivientes.

## Assumptions

- Se conserva la inyección de dependencias manual y el composition root único (ADR-013): no entra
  ningún contenedor ni framework de efectos. Los contenedores del ecosistema quedan descartados por
  reglas vigentes del repositorio (decoradores y metadatos reflexivos prohibidos; resolución por
  texto prohibida).
- La verificación de cobertura se hace con el sistema de tipos; se acepta que los mensajes de error
  sean extensos y se mitiga con un alias legible y pruebas de tipos que fijan el mensaje esperado.
- Se acepta una pérdida de tipado acotada y documentada en el borde de la abstracción de auditoría
  del kernel (la identidad del operador viaja como texto y el módulo de administración la vuelve a
  tipar), porque esa identidad tiene dueño y el kernel no puede verla.
- La etiqueta de diagnóstico de cada componente es un literal en su única declaración: no es
  resolución por texto ni un literal repetido.
- El cambio es de una sola vez sobre los módulos de composición, el despliegue y el arranque: no se
  puede migrar de a un módulo sin mantener dos mecanismos conviviendo.
- El nombre exacto del módulo de seguridad, la forma de la biblioteca del grafo y el destino de
  cada implementación de política los fija el plan.
- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el
  dueño. La rama sale de `main` (`eb32fc2`).
