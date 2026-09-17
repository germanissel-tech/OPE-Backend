# Feature Specification: Auditoría de calidad y arquitectura — gates deterministas, auditoría verificable e idioma del código

**Feature Branch**: `005-auditoria-calidad`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Auditoría de calidad y arquitectura: gates deterministas, skill
de auditoría verificable e idioma inglés en código y contrato. El repo ya tiene tipado
estricto, lint estricto con tipos, reglas de dependencia por anillo y módulo con fixtures
(ADR-013) y gobernanza del contrato (ADR-007..009). Esta feature cubre las dimensiones que hoy
nadie mide y hace que la auditoría cognitiva (SOLID, DRY, claridad) sea verificable, no
opinión. Bloque A: todo lo que lee un desarrollador o un consumidor de la API va en inglés;
docs, ADRs, specs, glosario y commits siguen en español; verificación determinista y
migración de lo existente. Bloque B: gates nuevos bloqueantes en CI, cada uno con fixture:
complejidad y forma de función, duplicación semántica y estructural, código muerto, calidad
de las pruebas por mutación sobre el diff, reglas de forma por anillo, números mágicos.
Bloque C: skill de auditoría con criterios definidos en este repo, hallazgos verificables,
segunda pasada adversarial y estado global derivado mecánicamente. Primero la migración a
inglés. Fuera de alcance: cambiar de herramienta de dependencias, servidor de análisis
externo, traducir docs/ADRs/specs/commits."

## Contexto

Las features 001–004 dejaron el repositorio con tipado estricto, lint con tipos, reglas de
dependencia entre anillos y módulos verificadas por prueba, y gobernanza del contrato. Eso
cubre **qué puede depender de qué** y **qué tipos circulan**. No cubre tres cosas que hoy sólo
un revisor humano vería: la **forma** del código (funciones largas, anidadas, con muchas
ramas), el **conocimiento duplicado** (dos funciones que hacen lo mismo, bloques copiados,
exports que nadie usa) y la **calidad de las pruebas** (una prueba que pasa aunque el código
esté roto). Son exactamente las tres patologías del código generado por agentes: hermoso
línea por línea, acumulativo, y con pruebas que confirman lo que el código ya hace.

Además, el código, los comentarios y el contrato están en español, mientras que los
identificadores están en inglés. Quien lea el código sin hablar español —un consumidor de la
API, un revisor externo, un modelo— lee un texto bilingüe. La decisión (DECIDIDO por el
usuario) es que todo lo que lee un desarrollador o un consumidor de la API va en inglés, y la
documentación de decisión sigue en español.

Por último, la revisión de principios de diseño (una responsabilidad por módulo, dependencia
sólo de abstracciones, ninguna regla duplicada, nombres que expresan intención) es hoy opinión
de quien revisa. Esta feature la convierte en un procedimiento repetible: criterios escritos
en términos de este repositorio (constitución y ADRs), hallazgos que citan archivo, línea y
regla, y una verificación que descarta lo que no se sostiene.

Misma disciplina que la 002 y la 003: cada regla tiene un caso que la viola y una prueba que
confirma la falla; el código existente pasa o cada excepción está justificada en línea.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El código y el contrato se leen en inglés (Priority: P1)

Un agente escribe un comentario, un mensaje de error, un texto de log, una descripción de
operación del contrato o un mensaje de regla en español. La verificación falla nombrando
archivo, línea y el fragmento detectado. Si un texto debe estar en español por motivo
legítimo (por ejemplo un ejemplo del contrato que reproduce un texto de un merchant), lo
declara en esa línea con un motivo, y la herramienta lo cuenta como excepción. Todo lo que
ya existe se migra en esta feature, de modo que la regla nace con el repositorio en verde.

**Why this priority**: es una decisión ya tomada y toca casi todos los archivos de código;
hacerla primero evita tocar cada archivo dos veces cuando entren los gates nuevos, y deja el
contrato publicable para consumidores que no hablan español.

**Independent Test**: se agrega un archivo de código con un comentario en español → la
verificación falla nombrándolo; se traduce → pasa. El repositorio entero pasa al cierre.

**Acceptance Scenarios**:

1. **Given** un archivo de código, prueba, script, contrato, configuración raíz o
   integración continua con un comentario, string o descripción en español, **When** se corre
   la verificación de idioma, **Then** falla nombrando archivo, línea y fragmento.
2. **Given** un texto en español sin acentos ni eñes (por ejemplo "lista de eventos"),
   **When** se corre la verificación, **Then** falla igual: la detección no depende sólo de
   caracteres especiales.
3. **Given** un texto en español declarado como excepción en su línea con motivo escrito,
   **When** se corre la verificación, **Then** pasa y el resumen cuenta la excepción; sin
   motivo, falla.
4. **Given** documentación, ADRs, specs, glosario de dominio, guía de agentes, constitución y
   mensajes de commit en español, **When** se corre la verificación, **Then** no los examina.
5. **Given** los artefactos generados y los fixtures que contienen español a propósito,
   **When** se corre la verificación, **Then** los ignora, y la lista de exclusiones es única
   y explícita.
6. **Given** el contrato con sus descripciones traducidas, **When** se compara contra la
   versión publicada, **Then** el cambio es compatible: ningún consumidor necesita cambiar
   nada.
7. **Given** el repositorio al cierre de la feature, **When** se corre la verificación,
   **Then** pasa, y las pruebas existentes siguen en verde sin modificar aserciones (salvo
   las que afirman sobre textos traducidos).
8. **Given** un desarrollador nuevo, **When** lee la guía de agentes, **Then** encuentra la
   regla de idioma y su motivo registrado como decisión.

---

### User Story 2 - La forma del código tiene límites que fallan el build (Priority: P1)

Un agente escribe una función con demasiadas ramas anidadas, demasiados parámetros o
demasiadas líneas, dos ramas de un condicional que hacen lo mismo, dos funciones idénticas, o
un número sin nombre en medio de una regla. El lint falla nombrando archivo, línea, regla y el
valor medido contra el límite. Cada límite está escrito con su justificación al lado, no como
constante mágica.

**Why this priority**: es la parte del gate que atrapa lo que el tipado y las reglas de
dependencia no ven, y la más barata de instalar. Sin límites de forma, el orquestador de
5.429 líneas de la POC (constitución I) es posible otra vez, sólo que en archivos de 300.

**Independent Test**: un archivo con cada violación falla el lint con esa regla; el código
existente pasa o cada excepción está justificada en línea.

**Acceptance Scenarios**:

1. **Given** una función cuya complejidad cognitiva supera el límite (15), **When** se corre
   el lint, **Then** falla indicando el valor medido y el límite.
2. **Given** bloques anidados a más de 3 niveles, una función con más de 4 parámetros, o una
   función de más de 60 líneas, **When** se corre el lint, **Then** falla con la regla
   correspondiente.
3. **Given** dos funciones con el mismo cuerpo, un condicional cuyas ramas son idénticas,
   condiciones repetidas en una misma cadena, un `if` anidado que puede colapsarse, o una
   expresión booleana redundante, **When** se corre el lint, **Then** falla.
4. **Given** un número literal distinto de 0, 1 y −1 usado directamente en código de
   producción, **When** se corre el lint, **Then** falla; el mismo número en una prueba, pasa.
5. **Given** cada límite numérico de la configuración, **When** se lee la configuración,
   **Then** tiene un comentario que explica por qué ese valor.
6. **Given** el código existente, **When** se corre el lint, **Then** pasa, o cada excepción
   está en su línea con motivo y contada.

---

### User Story 3 - Lo duplicado y lo muerto no entran (Priority: P2)

Un agente copia un bloque de lógica en lugar de reutilizar el existente, o deja un archivo,
un export o una dependencia que ya nadie usa. La verificación falla nombrando los dos lugares
del duplicado, o el export o la dependencia sin uso. Las exclusiones (código generado, puntos
de entrada) son explícitas y únicas.

**Why this priority**: los agentes agregan código y rara vez lo quitan, y escriben una segunda
versión en lugar de buscar la primera. Es la deuda que más rápido crece y la que menos se ve.

**Independent Test**: un bloque copiado de 5 líneas o más en dos archivos de producción falla
la verificación de duplicación nombrando ambos; un export sin uso falla la de código muerto;
se corrige → pasa.

**Acceptance Scenarios**:

1. **Given** dos fragmentos de código de producción estructuralmente iguales de al menos 5
   líneas (o su equivalente en tokens), **When** se corre la verificación, **Then** falla
   nombrando ambos lugares.
2. **Given** el mismo duplicado en código de prueba, **When** se corre la verificación,
   **Then** se informa pero no bloquea: la repetición en pruebas puede ser deliberada.
3. **Given** un archivo de producción que nadie importa, un export que nadie usa, o una
   dependencia declarada que ningún archivo importa, **When** se corre la verificación,
   **Then** falla nombrándolo.
4. **Given** los puntos de entrada, el código generado y las dependencias que se usan sólo
   por línea de comandos, **When** se corre la verificación, **Then** están excluidos en una
   lista única y explícita.
5. **Given** el repositorio al cierre, **When** se corren ambas verificaciones, **Then**
   pasan con cero hallazgos bloqueantes.

---

### User Story 4 - Una prueba que no prueba nada se detecta (Priority: P2)

Un agente agrega lógica y una prueba que pasa aunque la lógica esté rota (una aserción vacía,
un doble que confirma su propia salida, una rama nunca ejercitada). La verificación por
mutación altera el código nuevo o modificado del cambio y exige que alguna prueba falle por
cada alteración; si un mutante sobrevive, el cambio no entra. Sobre el repositorio completo,
el mismo análisis corre de forma informativa y publica su reporte sin bloquear.

**Why this priority**: es la única verificación que mide si las pruebas protegen algo; sin
ella, "cobertura" es una cifra vacía. Acotarla al cambio la hace viable en cada integración.

**Independent Test**: un cambio con una función nueva y una prueba que no la ejercita
realmente → la verificación falla listando el mutante sobreviviente; se corrige la prueba →
pasa.

**Acceptance Scenarios**:

1. **Given** un cambio que introduce o modifica líneas de producción, **When** corre la
   verificación de mutación sobre ese cambio, **Then** cada mutante generado en esas líneas
   es eliminado por alguna prueba, o la verificación falla nombrando el mutante, el archivo y
   la línea.
2. **Given** líneas no tocadas por el cambio, **When** corre la verificación bloqueante,
   **Then** no las analiza: el costo es proporcional al cambio.
3. **Given** el repositorio completo, **When** corre el análisis programado, **Then** publica
   el reporte con el puntaje global y no bloquea nada.
4. **Given** un cambio sin líneas de producción (sólo documentación, sólo pruebas), **When**
   corre la verificación, **Then** pasa sin analizar nada y lo dice.

---

### User Story 5 - Los anillos tienen forma, no sólo dirección (Priority: P2)

Un agente crea un archivo de dominio de 600 líneas, un controller que atiende dos
operaciones, o instancia un adaptador de infraestructura fuera del punto de composición. La
prueba de arquitectura falla nombrando el archivo y la regla. Son reglas de forma sobre los
anillos ya definidos (ADR-013), y cada una tiene su fixture que la viola.

**Why this priority**: hoy las reglas de dirección de dependencias son verificables y las de
forma viven en la guía de agentes como prosa. Codificarlas cierra la brecha entre lo que la
guía dice y lo que el build exige.

**Independent Test**: un fixture por regla falla la prueba de arquitectura; el repositorio
pasa.

**Acceptance Scenarios**:

1. **Given** un archivo de dominio o de aplicación que supera el tamaño máximo (300 líneas),
   **When** corre la prueba de arquitectura, **Then** falla nombrándolo.
2. **Given** un controller que registra más de una operación, o una operación del contrato
   sin controller propio, **When** corre la prueba, **Then** falla.
3. **Given** una instanciación de infraestructura (servidor, cliente de base de datos,
   reloj de sistema) fuera del punto de composición, **When** corre la prueba, **Then** falla.
4. **Given** un módulo que importa de otro por una ruta que no es su API pública, **When**
   corre la prueba, **Then** falla (regla existente; se verifica que su fixture la cubra).
5. **Given** cada regla de forma, **When** se revisa la carpeta de fixtures, **Then** hay uno
   que la viola y la prueba confirma la falla.

---

### User Story 6 - Un solo comando, en CI, con todo lo anterior (Priority: P2)

Un agente o CI corre un único comando de calidad que ejecuta todas las verificaciones nuevas
y las existentes, en orden, y falla ante la primera roja nombrando cuál. La guía de agentes
lo lista con lo que hace, y CI lo ejecuta en cada cambio.

**Why this priority**: un check que se puede saltar no es un check; la integración es lo que
convierte las reglas en gates.

**Independent Test**: con una violación de cualquier gate, el comando falla y CI queda en
rojo; sin violaciones, pasa.

**Acceptance Scenarios**:

1. **Given** una violación de cualquier gate nuevo, **When** corre el comando de calidad,
   **Then** falla y nombra el gate que la produjo.
2. **Given** un cambio propuesto con esa violación, **When** corre la integración continua,
   **Then** queda en rojo.
3. **Given** la guía de agentes, **When** se lee la tabla de comandos, **Then** el comando y
   cada verificación nueva figuran con lo que hacen.

---

### User Story 7 - La auditoría de diseño es un procedimiento, no una opinión (Priority: P3)

Un desarrollador pide auditar un módulo, un directorio o el cambio actual contra la rama
principal. El procedimiento (1) corre los gates deterministas y toma su salida como hechos;
(2) revisa el código contra criterios de diseño escritos en términos de este repositorio,
citando la constitución y los ADRs; (3) intenta refutar cada hallazgo de diseño y descarta
los que no se sostienen; (4) verifica que cada hallazgo confirmado apunte a un archivo y una
línea existentes y a una regla que existe; (5) emite un reporte con estado global derivado
mecánicamente. No hay puntuación numérica inventada.

**Why this priority**: es la capa que da sentido a las anteriores, pero depende de que
existan. Sin los gates, la auditoría cognitiva no tiene hechos sobre los que pararse.

**Independent Test**: sobre tres fixtures con defectos conocidos (un controller que instancia
infraestructura; dos funciones idénticas en dominio; un bloque `catch` vacío), el
procedimiento produce un hallazgo confirmado por cada uno, con archivo, línea y regla
correctos; sobre un módulo limpio, produce estado Aprobado sin hallazgos Altos.

**Acceptance Scenarios**:

1. **Given** un alcance (módulo, directorio o cambio contra la rama principal), **When** se
   invoca la auditoría, **Then** corre primero los gates deterministas y los reporta como
   hechos, no como opiniones.
2. **Given** un hallazgo de diseño, **When** se emite, **Then** trae archivo y línea, la regla
   violada con su fuente (sección de la constitución, ADR o regla de lint), la evidencia, la
   severidad según criterio fijo, una propuesta antes/después y qué prueba lo cubriría.
3. **Given** un hallazgo cuya evidencia no se sostiene al intentar refutarlo (por ejemplo, la
   "duplicación" son dos reglas distintas que coinciden hoy, o el "objeto grande" tiene un
   ADR que lo justifica), **When** pasa la segunda revisión, **Then** se descarta y no aparece
   en el reporte.
4. **Given** un hallazgo confirmado, **When** se verifica, **Then** el archivo y la línea
   existen y la regla citada existe; si no, el hallazgo se rechaza antes de emitirse.
5. **Given** el reporte, **When** se lee el estado global, **Then** es Aprobado, Requiere
   cambios o Rechazado, y se deriva de una regla fija: cualquier gate en rojo o cualquier
   hallazgo Alto ⇒ Rechazado; hallazgos Medios ⇒ Requiere cambios; sólo Bajos o nada ⇒
   Aprobado.
6. **Given** los tres fixtures de evaluación, **When** se audita cada uno, **Then** el
   defecto conocido aparece como hallazgo confirmado con archivo, línea y regla correctos.
7. **Given** los criterios de diseño, **When** se leen, **Then** cada principio está definido
   en términos de este repositorio (qué es "una responsabilidad" acá, qué es "una
   abstracción" acá) y cita la fuente interna que lo respalda.

---

### User Story 8 - Las herramientas están en su versión vigente, empezando por el compilador (Priority: P2)

Un desarrollador clona el repo y encuentra el compilador de TypeScript en su versión mayor
vigente, no en una de un año atrás; y cada herramienta del toolchain (linter, generador de
tipos, reglas de dependencia, pruebas, mutación) en su última versión publicada. Donde una
herramienta todavía no admite la versión nueva del compilador, el repositorio usa el
mecanismo que el propio proveedor del compilador documenta para convivir con la anterior, y
esa convivencia queda registrada como decisión con su condición de retiro.

**Why this priority**: es una decisión del usuario (DECIDIDO): no se degradan herramientas ni
se congela el compilador para acomodar a otras. Va antes que los gates nuevos porque el lint
con tipos y la generación de tipos dependen de la API del compilador.

**Independent Test**: `tsc --version` reporta la versión mayor vigente; compilación,
typecheck, lint con tipos, generación de tipos del contrato, reglas de dependencia y la suite
completa pasan; ninguna dependencia declarada queda por debajo de su última versión publicada
sin una nota que lo justifique.

**Acceptance Scenarios**:

1. **Given** el repositorio instalado, **When** se consulta la versión del compilador que
   ejecuta `build` y `typecheck`, **Then** es la versión mayor vigente.
2. **Given** las herramientas que importan la API programática del compilador, **When**
   corren lint, generación de tipos y reglas de dependencia, **Then** pasan usando la API
   que el proveedor del compilador designa para esa convivencia.
3. **Given** un diagnóstico nuevo o más estricto del compilador vigente sobre código
   existente, **When** se corre typecheck, **Then** el código está corregido (no la regla
   relajada) y las pruebas que afirman sobre códigos de diagnóstico usan los vigentes.
4. **Given** cada dependencia declarada, **When** se compara con su última versión publicada,
   **Then** coincide, o hay una nota con el motivo y la condición para actualizarla.
5. **Given** la convivencia de dos versiones del compilador, **When** se lee el registro de
   decisiones, **Then** dice por qué existe, qué herramientas la requieren y qué evento la
   retira.

---

### Edge Cases

- **Nombres del dominio que son palabras del español**: los identificadores ya están en
  inglés; la verificación de idioma examina comentarios, strings y textos del contrato, no
  identificadores. Un identificador como `orden` no se detecta; un comentario que lo explica
  en español, sí.
- **Palabras compartidas por ambos idiomas** ("no", "error", "final", "general"): la
  detección usa palabras funcionales del español que no existen en inglés y límites de
  palabra, para no producir falsos positivos sobre texto en inglés.
- **Textos que deben estar en español** (un ejemplo del contrato que reproduce un texto de
  merchant en su idioma): excepción en línea con motivo, contada.
- **Traducir descripciones del contrato**: es compatible hacia atrás; no cambia versión.
  Traducir un `title` o `detail` de Problem Details que una prueba afirma literalmente:
  la prueba se actualiza junto con el texto.
- **Complejidad legítima** (un `switch` exhaustivo sobre una unión de muchos casos, un
  parser): excepción en línea con motivo, contada, y la auditoría la revisa como hallazgo
  Bajo si el motivo no convence.
- **Duplicación en pruebas y fixtures**: informativa, nunca bloqueante; los fixtures de
  violación deliberada están excluidos de toda verificación en la misma lista que hoy usan
  lint y formato.
- **Mutación sobre código sin lógica** (tipos, constantes, punto de composición): esos
  archivos quedan fuera del análisis de mutación por lista explícita; mutar un `import` no
  mide nada.
- **Cambio que sólo toca líneas ya cubiertas por pruebas antiguas**: la verificación de
  mutación sobre el cambio analiza sólo las líneas del diff; si una prueba vieja las cubre,
  el mutante muere igual.
- **Rama sin base de comparación** (primer commit, rama huérfana): la verificación sobre el
  diff informa que no hay base y no bloquea; el análisis completo programado sigue midiendo.
- **Auditoría sobre alcance vacío o inexistente**: el procedimiento lo dice y termina sin
  reporte, no inventa hallazgos.
- **Auditoría sobre un cambio que rompe los gates**: el reporte es Rechazado por los gates y
  la revisión de diseño se hace igual, para que el autor tenga la lista completa.

## Requirements _(mandatory)_

### Functional Requirements

**Idioma**

- **FR-001**: Todo texto legible por un desarrollador o por un consumidor de la API MUST
  estar en inglés: comentarios, strings, mensajes de error y de log, descripciones y
  resúmenes del contrato, catálogos de tipos de problema y de motivos de `NO_OP`, mensajes
  de reglas del contrato, configuraciones raíz y definiciones de integración continua.
  Documentación, ADRs, specs, glosario de dominio, guía de agentes, constitución y mensajes
  de commit MUST permanecer en español.
- **FR-002**: Una verificación MUST fallar ante texto en español en el alcance de FR-001,
  nombrando archivo, línea y fragmento; MUST detectar tanto caracteres propios del español
  como palabras funcionales del español sin acentos; MUST NOT examinar identificadores.
- **FR-003**: Una excepción MUST declararse en la línea afectada con motivo escrito; sin
  motivo MUST fallar; el resumen MUST contar las excepciones vigentes.
- **FR-004**: Los artefactos generados y los fixtures con español deliberado MUST quedar
  excluidos en la misma lista única que hoy usan lint y formato.
- **FR-005**: Todo el texto existente en el alcance de FR-001 MUST migrarse en esta feature;
  las descripciones del contrato traducidas MUST ser compatibles hacia atrás.
- **FR-006**: La regla de idioma y su motivo MUST registrarse como decisión transversal y en
  la guía de agentes.

**Forma del código**

- **FR-010**: El lint MUST fallar ante una función con complejidad cognitiva mayor que 15,
  anidamiento mayor que 3 niveles, más de 4 parámetros o más de 60 líneas, indicando valor
  medido y límite.
- **FR-011**: El lint MUST fallar ante funciones idénticas, ramas idénticas de un
  condicional, condiciones repetidas en una cadena, condicionales anidados colapsables y
  expresiones booleanas redundantes.
- **FR-012**: El lint MUST fallar ante un número literal distinto de 0, 1 y −1 en código de
  producción; MUST NOT aplicarlo en pruebas.
- **FR-013**: Cada límite numérico de configuración MUST llevar al lado su justificación.

**Duplicación y código muerto**

- **FR-020**: Una verificación MUST fallar ante fragmentos estructuralmente iguales de al
  menos 5 líneas (o su equivalente en tokens) entre archivos de producción, nombrando ambos
  lugares; sobre pruebas MUST informar sin bloquear.
- **FR-021**: Una verificación MUST fallar ante archivos de producción sin importador,
  exports sin uso y dependencias declaradas sin uso, con exclusiones explícitas y únicas
  para puntos de entrada, código generado y dependencias de línea de comandos.

**Calidad de las pruebas**

- **FR-030**: Una verificación MUST analizar por mutación sólo las líneas de producción
  introducidas o modificadas por el cambio respecto de la rama principal, y MUST fallar si
  algún mutante sobrevive, nombrándolo con archivo y línea.
- **FR-031**: Un análisis de mutación sobre el repositorio completo MUST correr de forma
  programada e informativa, publicando su reporte sin bloquear.
- **FR-032**: Archivos sin lógica (tipos, constantes, punto de composición, generados) MUST
  quedar fuera del análisis por lista explícita.
- **FR-033**: Sin líneas de producción en el cambio, o sin base de comparación, la
  verificación MUST pasar informándolo.

**Forma de los anillos**

- **FR-040**: La prueba de arquitectura MUST fallar ante un archivo de dominio o de
  aplicación de más de 300 líneas, un controller que atienda más de una operación o una
  operación sin controller propio, y una instanciación de infraestructura fuera del punto de
  composición.
- **FR-041**: Cada regla de FR-040 y la regla existente de importación por API pública de
  módulo MUST tener un fixture que la viola y una prueba que confirma la falla.

**Integración**

- **FR-050**: Un único comando MUST ejecutar todas las verificaciones nuevas y fallar ante la
  primera roja nombrándola; MUST correr en integración continua; la guía de agentes MUST
  listarlo junto con cada verificación.
- **FR-051**: Cada regla o verificación de FR-002, FR-010, FR-011, FR-012, FR-020, FR-021,
  FR-030 y FR-040 MUST tener un caso que la viola y una prueba que confirma la falla.
- **FR-052**: El código existente MUST pasar todas las verificaciones al cierre, con cero
  excepciones sin motivo; la suite existente MUST pasar sin modificar aserciones salvo las
  que afirman sobre textos traducidos.

**Auditoría de diseño**

- **FR-060**: Un procedimiento invocable sobre un módulo, un directorio o el cambio contra
  la rama principal MUST ejecutar primero los gates deterministas y reportar su salida como
  hechos.
- **FR-061**: Los criterios de diseño (una responsabilidad por módulo, dependencia sólo de
  abstracciones, sustitución de implementaciones, interfaces pequeñas, conocimiento sin
  duplicar, nombres con intención, errores explícitos) MUST estar escritos en términos de
  este repositorio y citar la sección de constitución o el ADR que los respalda.
- **FR-062**: Cada hallazgo MUST traer archivo y línea, regla violada con fuente, evidencia,
  severidad por criterio fijo (Alta: viola constitución o ADR; Media: viola convención de la
  guía de agentes; Baja: claridad), propuesta antes/después y la prueba que lo cubriría.
- **FR-063**: Cada hallazgo de diseño MUST pasar una segunda revisión que intenta refutarlo;
  sólo los confirmados MUST aparecer en el reporte.
- **FR-064**: Antes de emitirse, cada hallazgo MUST verificarse mecánicamente: archivo y
  línea existen, y la regla citada existe.
- **FR-065**: El estado global MUST derivarse de una regla fija (gate rojo o hallazgo Alto ⇒
  Rechazado; Medio ⇒ Requiere cambios; si no ⇒ Aprobado); MUST NOT existir puntuación
  numérica.
- **FR-066**: Tres escenarios de evaluación con fixtures (controller que instancia
  infraestructura; dos funciones idénticas en dominio; bloque de captura de error vacío) MUST
  existir, y el procedimiento MUST detectar el defecto de cada uno con archivo, línea y regla
  correctos.

**Herramientas vigentes**

- **FR-070**: El compilador que ejecuta `build` y `typecheck` MUST ser la versión mayor
  vigente de TypeScript; las herramientas que necesitan la API programática MUST usar el
  mecanismo de convivencia que el proveedor documenta, sin degradar ninguna de ellas.
- **FR-071**: Los diagnósticos nuevos del compilador vigente sobre código existente MUST
  corregirse en el código; las pruebas que afirman sobre códigos de diagnóstico MUST usar
  los vigentes.
- **FR-072**: Toda dependencia declarada MUST estar en su última versión publicada al cierre,
  o llevar una nota con motivo y condición de actualización; la convivencia de versiones del
  compilador MUST registrarse como decisión transversal con su condición de retiro.

### Key Entities

- **Gate**: verificación determinista con nombre, alcance (qué directorios), exclusiones,
  umbral justificado, fixture que la viola y prueba que confirma la falla; bloqueante o
  informativa.
- **Excepción justificada**: línea, regla, motivo; contable; misma forma para lint, idioma y
  complejidad.
- **Lista de palabras del español**: única, curada, con límite de palabra; ampliable.
- **Hallazgo de auditoría**: archivo:línea, regla y fuente, evidencia, severidad, propuesta
  antes/después, prueba que lo cubriría, estado (propuesto / confirmado / refutado).
- **Criterio de diseño**: principio, definición en términos del repositorio, fuente interna
  (constitución §, ADR-NNN, regla de lint), ejemplos de violación y de cumplimiento.
- **Reporte de auditoría**: alcance, salida de gates, hallazgos confirmados, estado global
  derivado.
- **Escenario de evaluación**: fixture con defecto conocido, hallazgo esperado (archivo,
  línea, regla).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de las reglas y verificaciones de FR-051 tiene un caso que la viola y
  una prueba que confirma la falla.
- **SC-002**: Al cierre, la verificación de idioma pasa sobre todo el alcance de FR-001 con
  cero excepciones sin motivo, y una búsqueda manual de texto en español en ese alcance no
  encuentra nada fuera de las excepciones contadas.
- **SC-003**: El comando de calidad completo corre localmente en menos de 3 minutos sobre el
  estado de esta feature, excluida la verificación de mutación; la verificación de mutación
  sobre un cambio típico (hasta 200 líneas de producción) termina en menos de 10 minutos en
  integración continua.
- **SC-004**: Toda la suite anterior pasa; las únicas aserciones modificadas son las que
  afirman sobre textos traducidos, y cada una queda listada en el cierre de la feature.
- **SC-005**: Los tres escenarios de evaluación producen su hallazgo esperado en tres
  ejecuciones consecutivas del procedimiento de auditoría (repetible, no ocasional), y un
  módulo sin defectos conocidos produce estado Aprobado sin hallazgos Altos ni Medios.
- **SC-006**: El 100 % de los hallazgos de un reporte de auditoría resuelve a archivo, línea
  y regla existentes (verificado mecánicamente).
- **SC-007**: El contrato traducido pasa la comparación de compatibilidad contra la versión
  publicada sin ningún cambio incompatible.
- **SC-008**: `tsc --version` reporta la versión mayor vigente de TypeScript, y el 100 % de
  las dependencias declaradas está en su última versión publicada o tiene nota justificada.

## Assumptions

- Las herramientas concretas (analizador de complejidad, detector de duplicación, detector de
  código muerto, motor de mutación) se eligen en el plan; la spec fija el comportamiento y los
  umbrales. Los umbrales de forma (15 / 3 / 4 / 60 / 5 líneas / 300 líneas) son los que el
  usuario fijó y coinciden con los valores de referencia de la industria; cada uno se documenta
  con su justificación en la configuración (FR-013).
- La verificación de idioma se apoya en una lista curada de palabras funcionales del español
  (artículos, preposiciones, conjunciones, adverbios frecuentes) con límite de palabra, más
  caracteres propios del español. No usa detección estadística de idioma: la lista es
  auditable y sus falsos positivos se corrigen editándola, con el mismo patrón que la lista de
  datos personales prohibidos.
- Los mensajes de las reglas del contrato se traducen; su comportamiento no cambia.
- La verificación de mutación bloqueante corre sólo en integración continua sobre el diff
  contra la rama principal; localmente es opcional. El análisis completo corre de forma
  programada (por ejemplo, semanal) y sube su reporte como artefacto.
- El análisis de mutación cubre dominio, aplicación, adaptadores de interfaz e
  infraestructura; excluye tipos generados, punto de composición y punto de entrada.
- "Un controller por operación" se verifica contra el contrato: cada `operationId` del
  bundle tiene exactamente un archivo de controller con su nombre.
- "Instanciación de infraestructura" se define por lista: creación del servidor, clientes de
  persistencia, reloj de sistema y cualquier adaptador registrado en el punto de composición.
- El procedimiento de auditoría se entrega como skill del repositorio siguiendo la guía de
  autoría de skills del proveedor: instrucciones cortas con lista de pasos, criterios en
  archivos de referencia a un nivel de profundidad, scripts para lo determinista. La segunda
  revisión adversarial es parte del procedimiento, no una herramienta aparte.
- Orden de implementación: primero la migración a inglés, después los gates, por último el
  procedimiento de auditoría. Así cada archivo se toca una vez y los gates nacen sobre código
  ya migrado.
- El compilador vigente (TypeScript 7) no publica API programática hasta su siguiente
  versión menor; el proveedor documenta la convivencia con la 6.0 para las herramientas que
  la importan. Esa convivencia es temporal y se retira cuando el linter con tipos y las
  reglas de dependencia admitan la API nueva.
- Fuera de alcance: cambiar la herramienta de reglas de dependencia, un servidor de análisis
  externo, traducir documentación, ADRs, specs o mensajes de commit, y cualquier cambio de
  comportamiento del servidor.
