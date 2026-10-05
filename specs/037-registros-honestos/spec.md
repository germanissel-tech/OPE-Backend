# Feature Specification: Registros honestos y lineamiento de persistencia

**Feature Branch**: `037-registros-honestos`

**Created**: 2026-10-02

**Status**: Draft

**Input**: Evaluación de la persistencia del anillo de adaptadores con el dueño, 2026-10-02. Se
propusieron cinco cambios de diseño y se tensionó cada uno contra el contrato, los ADR y el modelo de
concurrencia; cuatro no sobrevivieron y uno se partió en dos. Esta feature es lo que quedó en pie: un
defecto de tipos que ya se materializó una vez sin que nadie lo notara, y el lineamiento que evita que
el próximo que edite el anillo repita la evaluación desde cero.

## Por qué existe

Cada entidad que un almacén guarda tiene un `record()`, la contraparte de `rehydrate` (ADR-024). El
gateway durable escribe ese registro como documento JSON y al leerlo lo devuelve con `as XRecord`.
**Ese cast miente cuando el registro tiene partes que son clases.** `JSON.parse` devuelve objetos
planos, sin métodos; el tipo del registro dice `Money`, `Origin`, `Correlation`, y el compilador le
cree.

Hoy la regla acotada de gateways durables lo resuelve pidiendo que cada gateway **nombre y rehidrate a
mano** cada clase anidada. Es la clase de regla que se cumple hasta que no: depende de que quien agrega
un campo de clase a una entidad se acuerde de abrir un archivo de otro anillo.

Lo que la evaluación encontró, leyendo el código:

| Hecho                                                                                                                       | Consecuencia                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El catálogo leído desde el almacén durable devuelve el precio de cada variante como objeto plano donde el tipo dice `Money` | Nadie llama hoy un método sobre ese precio. El primer `equals` fallaría **sólo en el despliegue durable** y pasaría la suite rápida, que corre en memoria |
| El gateway de pedidos promete en un comentario que «una quinta clase anidada fallaría el typecheck»                         | No fallaría: el spread la pasa con el tipo que el cast inventó. La protección no existe                                                                   |
| El gateway de merchants declara un tipo auxiliar para describir lo que el documento realmente trae                          | Es la forma honesta hecha a mano en un solo gateway, y no en los demás                                                                                    |

La corrección es del dominio, no del anillo: **el registro declara sus partes anidadas como datos
planos y el constructor de la entidad las convierte en clases.** Un `MoneyRecord` no tiene `equals`,
así que asignarlo a un campo de tipo `Money` no compila. La protección que el comentario promete pasa
a existir de verdad, en el único lugar que no puede olvidarse: el que agrega el campo.

La segunda mitad de la feature es escribir lo que la evaluación estableció y hoy no está en ningún
lado: qué es la abstracción de almacén compartida y qué no es, dónde está la costura para un motor
nuevo, qué se escribe por motor, y por qué los gateways quedan como están. Sin eso, la próxima
revisión de arquitectura vuelve a proponer las mismas cinco abstracciones.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Lo que se lee del almacén se comporta como lo que se escribió (Priority: P1)

Un operador o un integrador trabaja contra un servidor que reinició. Un pedido, un merchant y un
catálogo leídos del almacén durable son indistinguibles de los que se escribieron antes del reinicio:
sus partes responden a sus métodos, y ninguna comparación ni regla de negocio falla porque una parte
volvió como objeto plano.

**Why this priority**: es el defecto real. Ya ocurrió una vez con el catálogo y no lo vio ningún gate,
ninguna prueba y ningún tipo. Sin esta historia el lineamiento de la historia 2 describiría una regla
que el código no cumple.

**Independent Test**: escribir un catálogo con precios en un almacén durable, reiniciarlo, leerlo y
pedirle a un precio que se compare con otro. Hoy ese caso no existe; con la feature, pasa. Y en el
dominio: construir cada una de las tres entidades desde un registro plano y comprobar que sus partes
responden a sus métodos.

**Acceptance Scenarios**:

1. **Given** un catálogo escrito en el almacén durable, **When** el proceso reinicia y lo lee, **Then**
   el precio de cada variante es un objeto de valor que responde a `equals`, y la comparación con un
   precio igual contesta verdadero.
2. **Given** un pedido con total, correlación, redención y devolución escrito en el almacén durable,
   **When** el proceso reinicia y lo lee, **Then** las cuatro partes responden a sus métodos, y repetir
   la devolución contesta «repetida» en vez de fallar.
3. **Given** un merchant con orígenes escrito en el almacén durable, **When** el proceso reinicia y lo
   lee, **Then** el merchant autentica por su credencial y admite su origen, como ya verifica la suite
   de durabilidad.
4. **Given** una entidad que gana un campo nuevo cuyo tipo es una clase, **When** nadie escribe su
   conversión en el constructor, **Then** la compilación falla en el dominio, antes de que exista un
   gateway que lo lea mal.
5. **Given** el registro de una entidad con una parte opcional ausente, **When** se construye desde ese
   registro, **Then** la parte sigue ausente y no se inventa un valor.
6. **Given** la suite rápida, que corre en memoria, **When** se ejecuta con la feature, **Then** ninguna
   expectativa existente cambia: lo que se guarda en memoria son instancias y nunca pasó por JSON.

---

### User Story 2 - Quien edita el anillo encuentra el lineamiento donde trabaja (Priority: P2)

Una persona o un agente que va a escribir o modificar un gateway, una entidad con partes anidadas o la
abstracción de almacén encuentra, en el lugar donde está trabajando, las decisiones que la evaluación
tomó: qué es `SqlStore` y qué no es, dónde está la costura para un motor nuevo, qué se escribe por
motor y con qué pruebas, cómo declara una entidad sus partes que son clases, y por qué los gateways
quedan planos. Y en el registro de deudas encuentra lo que quedó pendiente, con su motivo.

**Why this priority**: va después porque sin la historia 1 describiría una regla que el código no
cumple. Pero no es opcional: la evaluación costó dos días y terminó descartando cuatro de cinco
propuestas. Lo que la hizo posible fue leer los ADR; lo que la hizo necesaria es que ninguno de ellos
decía esto.

**Independent Test**: los gates de documentación en verde (instrucciones, ADR, inventarios de README)
con el ADR nuevo, las dos reglas acotadas actualizadas y el registro de deudas ampliado; y una lectura
de las dos reglas por alguien que no participó de la evaluación, que debe poder responder «¿dónde pongo
la conversión de una parte anidada?» y «¿por qué `SqlStore` no se abstrae?» sin abrir otro documento.

**Acceptance Scenarios**:

1. **Given** una persona que va a escribir un gateway durable, **When** lee la regla acotada que llega
   al tocar `gateways/`, **Then** encuentra que la entidad vuelve sola de su registro y que el gateway
   no rehidrata partes a mano, y encuentra qué no se abstrae y por qué.
2. **Given** una persona que va a escribir una entidad con una parte que es una clase, **When** lee la
   regla acotada de entidades, **Then** encuentra cómo declara el registro esa parte y dónde va la
   conversión.
3. **Given** una persona que evalúa portar la persistencia a otro motor, **When** lee el ADR nuevo,
   **Then** encuentra las cuatro decisiones con el disparador que revisa cada una, y en D-21 la lista
   de lo que ese motor tiene que resolver.
4. **Given** los gates de documentación, **When** corren con la feature, **Then** pasan: cada ruta,
   comando e identificador citado existe, cada ADR citado existe, cada sección de regla tiene su clase
   declarada.
5. **Given** el registro de deudas, **When** se lee después de la feature, **Then** tiene la deuda
   nueva de las lecturas durables que fallan, D-21 ampliada, y el disparador de los dos almacenes de
   versiones anotado.

---

### Edge Cases

- **Una copia de la entidad pasa instancias, no registros planos.** `withReturn`, `rotated`,
  `deactivated` construyen una entidad nueva a partir de `record()`, cuyas partes ya son clases. La
  conversión del constructor tiene que aceptar las dos cosas sin distinguirlas: una instancia cumple con
  la forma de su registro, y convertirla de nuevo produce un valor igual.
- **El catálogo está en el camino de decisión.** Convertir el precio de cada variante agrega una
  asignación por variante en cada construcción, y en el despliegue durable el catálogo se construye en
  cada lectura. La alternativa es declarar ese precio como dato plano: es honesta porque nadie le llama
  un método, y no cuesta nada. El plan elige entre las dos con la medición de latencia de ingesta en la
  mano; la spec acepta cualquiera de las dos y exige que el p95 no empeore de forma apreciable.
- **Una cuarta entidad con partes que son clases.** La evaluación encontró tres. El plan hace el
  inventario completo de los `as XRecord` de los gateways durables y de los registros del dominio; si
  aparece una cuarta, entra en la historia 1 con el mismo trato, y la spec no la deja afuera por no
  haberla visto.
- **Una entidad que guarda sólo datos planos y construye las clases cuando las necesita.** La versión de
  configuración de merchant ya hace eso, y es correcto: su registro no miente. No se toca, y la regla de
  entidades nombra las dos formas válidas.
- **El registro de una parte que es una clase de otro módulo.** `Money` es del kernel compartido y lo
  usan pedidos y catálogo. Su registro ya existe; la feature no crea registros nuevos donde ya hay uno.
- **Una prueba de durabilidad que sólo mira campos.** Un objeto plano tiene los mismos campos que la
  clase, así que una prueba que compara campos pasa con el defecto presente. Toda prueba de esta feature
  que verifique una lectura tiene que **llamar un método** de la parte rehidratada.
- **El gate de mutación sobre las conversiones.** Cada línea de conversión en un constructor es un
  mutante posible (quitarla, cambiar la clase). Cada una necesita la prueba que la mata, y la regla del
  proyecto es que un mutante de líneas propias que sobrevive no entra.
- **El comentario falso.** Se borra, no se corrige: con la conversión en el dominio, el gateway ya no
  tiene nada que prometer sobre clases anidadas.

## Requirements _(mandatory)_

### Functional Requirements

**Registros honestos**

- **FR-001**: El registro de toda entidad que un almacén guarda MUST declarar sus partes anidadas que son
  clases como **registros planos** (la forma de sus datos, sin métodos), y MUST NOT declararlas como la
  clase.
- **FR-002**: El constructor de la entidad MUST convertir cada parte plana en su clase, de modo que una
  entidad construida desde un registro leído del almacén tenga partes que responden a sus métodos.
- **FR-003**: Un campo nuevo de una entidad cuyo tipo es una clase y cuya conversión nadie escribe MUST
  fallar la compilación. La feature MUST demostrarlo, con una prueba de tipos o con el razonamiento
  verificable en el plan.
- **FR-004**: Los gateways durables MUST rehidratar una entidad con una sola llamada a su `rehydrate`
  sobre el documento leído, y MUST NOT conservar rehidrataciones manuales de partes anidadas ni tipos
  auxiliares que describan «lo que el documento realmente trae».
- **FR-005**: Una entidad construida desde una copia de sí misma (sus partes ya son instancias) MUST
  producir el mismo resultado que construida desde el registro plano equivalente.
- **FR-006**: Una parte opcional ausente en el registro MUST seguir ausente en la entidad.
- **FR-007**: La suite de durabilidad MUST incluir un caso para el catálogo tras un reinicio que llame
  un método de un precio leído, y los casos de pedido y merchant MUST seguir llamando un método de cada
  parte rehidratada.
- **FR-008**: Cada entidad alcanzada MUST tener una prueba unitaria que la construye desde un registro
  plano y verifica que sus partes responden a sus métodos.
- **FR-009**: Para el catálogo, el plan MUST decidir entre convertir el precio en el constructor o
  declararlo como dato plano, con la medición de latencia de ingesta de la suite de durabilidad, y el
  p95 de la ingesta con almacén durable MUST NOT empeorar de forma apreciable contra la misma corrida
  sin la feature.
- **FR-010**: El plan MUST inventariar todos los `as XRecord` de los gateways durables y todos los
  registros del dominio con partes que son clases; cualquier entidad que el inventario agregue a las
  tres conocidas entra en esta feature.
- **FR-011**: El comentario del gateway de pedidos que promete una protección del compilador MUST
  eliminarse.

**Lo que no cambia**

- **FR-012**: El contrato, los puertos de aplicación, los gateways en memoria, la composición y el
  comportamiento observable del sistema MUST NOT cambiar. Ninguna expectativa existente de la suite
  rápida cambia; sólo se agregan casos.
- **FR-013**: `record()` de cada entidad MUST seguir devolviendo lo mismo que hoy: una instancia cumple
  con la forma de su registro, así que lo que se escribe no cambia y un documento ya guardado se lee
  igual.

**Lineamiento escrito**

- **FR-014**: Un ADR nuevo MUST fijar cuatro decisiones, cada una con el disparador que la revisa:
  (a) la abstracción de almacén compartida es el **vocabulario del motor SQLite**, síncrona porque el
  driver de la biblioteca estándar lo es y se eligió para no agregar dependencias; se revisa si Node
  publica su API asíncrona y el repo la adopta, o si SQLite recibiera tráfico real; (b) la costura para
  un motor nuevo es el **puerto de aplicación**, no una abstracción entre motores; (c) las transacciones
  cuya corrección depende del escritor único se escriben **por motor**, con sus pruebas de concurrencia,
  y el ADR las lista; (d) los gateways quedan **planos con prefijo** de motor; se revisa cuando exista
  un tercer motor.
- **FR-015**: El ADR MUST nombrar las cuatro abstracciones evaluadas y descartadas con su motivo en una
  línea cada una, para que no se vuelvan a proponer sin leerlo.
- **FR-016**: La regla acotada de gateways durables MUST decir que la entidad vuelve sola de su registro
  y que el gateway no rehidrata partes a mano, y MUST decir qué no se abstrae y por qué.
- **FR-017**: La regla acotada de entidades MUST decir cómo declara un registro sus partes que son
  clases, dónde va la conversión, y que guardar sólo datos planos es la otra forma válida.
- **FR-018**: Si una regla gana una sección, la política de instrucciones MUST declararla; el gate de
  instrucciones MUST pasar.
- **FR-019**: El registro de deudas MUST ganar una deuda nueva: una lectura durable que falla responde
  un error interno en vez de «servicio no disponible» con reintento; fuera de esta feature porque toca
  el contrato.
- **FR-020**: D-21 MUST ampliarse con lo que un motor nuevo tiene que resolver y hoy no está listado: si
  SQLite se queda o se retira cuando llegue, las transacciones que dependen del escritor único, si el
  índice en memoria de ADR-041 se invalida o se consulta, y la reorganización por carpetas de motor.
- **FR-021**: El registro de deudas MUST anotar el disparador: el almacén de versiones de merchant y el
  de niveles son copia literal, y un tercero obliga a extraer lo común.

### Key Entities

- **Registro**: la forma plana de los datos de una entidad, con la que se construye y la que se guarda.
  Sin métodos. Sus partes anidadas son a su vez registros.
- **Objeto de valor**: una parte de una entidad con reglas propias, como un precio o un origen. Sólo
  existe válido y se compara por valor. Vuelve de su registro sin volver a juzgarse (ADR-024).
- **Entidad**: lo que un almacén guarda. Sabe producir su registro y sabe volver de él, y al volver
  convierte cada parte plana en su objeto de valor.
- **Documento**: el registro escrito como texto en el almacén durable. Es lo que vuelve plano.
- **Lineamiento**: las decisiones sobre la persistencia que esta feature deja escritas, en el ADR y
  en las dos reglas acotadas, cada una con su disparador de revisión.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **Ningún gateway durable rehidrata partes a mano.** Verificable contando: cero
  rehidrataciones de partes anidadas y cero tipos auxiliares de forma almacenada fuera de `domain/`.
- **SC-002**: **Un catálogo leído tras un reinicio compara precios**, verificable con el caso nuevo de
  la suite de durabilidad, que hoy no existe y con el código actual fallaría.
- **SC-003**: **Un campo de clase sin conversión no compila**, demostrado en la feature.
- **SC-004**: **Nada observable cambia**: el contrato no tiene diferencias, ninguna expectativa de la
  suite rápida cambia, y los gates del lazo de la historia y de cierre de feature pasan, incluido el de
  mutación sobre las líneas nuevas.
- **SC-005**: **El camino de decisión no paga nada apreciable**: el p95 de la ingesta con almacén
  durable, medido en la misma máquina y la misma corrida, no empeora contra la medición previa.
- **SC-006**: **El lineamiento está donde se lee a tiempo**: los gates de documentación pasan, y
  alguien que no participó de la evaluación responde las dos preguntas de la historia 2 leyendo sólo
  las reglas acotadas.
- **SC-007**: **Lo pendiente tiene nombre**: la deuda nueva, D-21 ampliada y el disparador anotado,
  cada uno con su motivo y su fecha.

## Assumptions

- **El tipado estructural conserva a los llamadores.** Una instancia de `Money` tiene los campos de
  `MoneyRecord`, así que quien construye hoy una entidad pasando clases sigue compilando. Es lo que se
  espera por cómo funcionan los tipos; lo confirma el typecheck del plan, no esta spec.
- **Tres entidades, salvo que el inventario diga otra cosa.** Pedido, merchant y catálogo son las que
  la evaluación encontró leyendo los gateways. El inventario del plan es exhaustivo y manda.
- **La versión de configuración de merchant no cambia.** Guarda sólo datos planos y construye las
  clases cuando las necesita; su registro no miente.
- **SQLite sigue siendo el almacén de desarrollo y piloto** y hay **una instancia** (D-21). Nada de esta
  feature depende de otra cosa.
- **El ADR nuevo no cambia ninguna decisión existente.** ADR-021, ADR-024, ADR-038, ADR-041 y ADR-042
  siguen vigentes tal cual; el ADR nuevo dice lo que ninguno dice y cita a los que ya lo dicen.
- **La deuda de las lecturas que fallan se registra y no se hace.** Dar canal de fallo a las lecturas
  durables declara respuestas nuevas en el contrato y toca casi todos los casos de uso; es otra feature.

## Fuera de alcance, con su motivo

Las cinco abstracciones evaluadas el 2026-10-02 y descartadas con el dueño, para que no se vuelvan a
proponer sin leer el ADR:

- **Un solo nombre de fallo para todo almacén.** `ledger-unavailable`, `store-unavailable` y
  `state-unavailable` son tipos de problema publicados y dos son motivos de `NO_OP`; fundirlos cambia
  el contrato. Los tres envoltorios del anillo ya son una sola función con dos alias.
- **El índice en memoria como decorador.** La mitad durable de esos dos gateways no implementa las
  lecturas del camino caliente, y escribirlas en SQL sería repetir reglas del dominio para código que
  ningún despliegue ejecuta. Lo único duplicado es la regla de orden de ADR-041, y son dos casos.
- **El almacén asíncrono.** Lo que impide portar las transacciones a otro motor es el escritor único,
  no la firma síncrona; una interfaz común daría la ilusión de portabilidad con código incorrecto bajo
  dos escritores, y le quitaría a SQLite la atomicidad por construcción.
- **La tabla de documentos genérica.** Sin la costura entre motores sólo ahorra líneas; casi ningún
  gateway es pura convención, y el SQL a mano es lo que la suite de planes de consulta verifica.
- **La composición por módulo.** El grafo ya lo permite; no hay nada que hacer hasta que exista una
  segunda tecnología durable.
- **Subcarpetas por motor en `gateways/`.** Más de un tercio de los archivos no pertenece a ningún
  motor, el prefijo ya agrupa, y la prueba de inventario de almacenes define qué es un almacén por ese
  prefijo. Se revisa cuando llegue un tercer motor.
- **El canal de fallo de las lecturas durables.** Es la deuda nueva; toca el contrato.
- **PostgreSQL.** Es D-21, que esta feature amplía y no cierra.
