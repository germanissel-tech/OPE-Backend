# Feature Specification: Deudas técnicas del tooling y las skills (registro abierto)

**Feature Branch**: `019-deudas-tecnicas`

**Created**: 2026-09-21

**Status**: Draft — registro abierto (se le agregan deudas; ver "Cómo se agrega una deuda")

**Input**: User description: "Abrir una feature que reúna las deudas técnicas que la revisión en
curso va encontrando, empezando por las dos ya evaluadas —la skill `auditing-architecture` está
acoplada a este repo y no sirve en otro proyecto; no hay skill de acondicionamiento para que un
proyecto nuevo o existente se vuelva auditable— y preparada para seguir sumando: cada deuda es
una historia numerada con su alcance, su criterio de éxito y su estado; una deuda nueva se agrega
al final sin renumerar; el plan y las tareas se generan por historia y se regeneran cuando entra
una nueva sin invalidar lo ya implementado." (Decisión del dueño, 2026-09-21.)

## Contexto

La feature 018 dejó el anillo de adaptadores por módulo y, al revisar el resto del repositorio,
el dueño encontró que las skills de Claude Code que viven en `.claude/skills/` están escritas
para esta solución: la auditoría de arquitectura conoce por su nombre los anillos, los gates, las
rutas y las fuentes de verdad de este repo, y sus evaluaciones y fixtures son de esta
arquitectura. Nada de eso es reutilizable en otro proyecto, y nada permite que otro proyecto se
prepare para usarla. La revisión de deudas sigue; esta feature es el lugar donde entran.

### Cómo funciona esta feature (registro abierto)

- **Una deuda = una historia.** Cada deuda tiene un identificador estable `D-NN` (dos dígitos,
  correlativo, nunca se reutiliza), un título, su origen (quién la encontró y cuándo), su estado y
  su historia de usuario con alcance propio, escenarios de aceptación y criterios de éxito propios
  (`SC-NN-x`). Las historias son independientes entre sí salvo que la tabla lo diga.
- **El registro es la única lista de qué entra.** La tabla "Registro de deudas" de abajo
  enumera todas las deudas conocidas con su estado: `evaluada` (analizada con el dueño, sin
  historia todavía), `especificada` (tiene historia completa en esta spec), `implementada`
  (historia cerrada con sus gates en verde y su commit), `descartada` (no entra, con el motivo).
  Lo que no está en la tabla no es parte de la feature.
- **Agregar una deuda** es: una fila al final de la tabla con estado `evaluada`, y cuando el
  dueño la acepta, su historia al final de la sección de historias con el siguiente `D-NN`; las
  anteriores no se renumeran ni se reescriben. Los requisitos transversales (FR-0xx) y los
  criterios comunes (SC-0xx) aplican a toda deuda; una deuda puede agregar requisitos propios con
  su prefijo (`FR-NN-x`).
- **Plan y tareas por historia.** `/speckit-plan` y `/speckit-tasks` se regeneran cuando entra
  una deuda nueva; una historia `implementada` no cambia de plan ni de tareas (sus tareas quedan
  marcadas y su commit citado en el registro). La feature se cierra cuando el dueño decide que la
  revisión terminó; una deuda que llega después abre otra feature con el mismo formato.
- **Una deuda que no cabe** (toca contrato, dominio, aplicación o persistencia; o excede lo que
  esta feature puede cerrar) se registra como `descartada` con la referencia a la feature que la
  tomará, para que el hallazgo no se pierda.

### Registro de deudas

| Id   | Título                                                                         | Origen                         | Estado         | Fecha      | Cierre |
| ---- | ------------------------------------------------------------------------------ | ------------------------------ | -------------- | ---------- | ------ |
| D-01 | La skill de auditoría de arquitectura está acoplada a este repo                | Revisión del dueño tras la 018 | `especificada` | 2026-09-21 | —      |
| D-02 | No hay skill de acondicionamiento: un proyecto no puede volverse auditable     | Evaluación con el dueño (D-01) | `especificada` | 2026-09-21 | —      |
| D-03 | `engineering-baseline`: scaffold opinado con la cadena de calidad de este repo | Evaluación con el dueño (D-02) | `evaluada`     | 2026-09-21 | —      |

Fuera del alcance de toda deuda de esta feature: cambiar el contrato, agregar operaciones,
tocar dominio o aplicación, persistencia.

## User Scenarios & Testing _(mandatory)_

### User Story D-01 - La auditoría de arquitectura sirve en cualquier proyecto (Priority: P1)

Como ingeniero que dirige proyectos construidos por agentes, quiero que la skill de auditoría
de arquitectura sea un **método** portable —los siete pasos, el formato del hallazgo, la
refutación, la verificación mecánica y el veredicto derivado— y que todo lo que es de **este
proyecto** —qué gates hay y cómo entregan hallazgos, cómo se resuelve un módulo, qué fuentes de
verdad existen y con qué severidad, dónde están los criterios de diseño y las evaluaciones
propias— viva en el proyecto como un perfil, para instalar la misma skill en otro repositorio y
que audite con el mismo rigor sin que nadie la reescriba.

**Why this priority**: es la deuda que disparó la feature y la condición de la siguiente (D-02
acondiciona un proyecto _para_ esta skill); sin ella nada de lo demás tiene sentido.

**Independent Test**: la skill, instalada como algo externo al repositorio, audita este repo
leyendo su perfil y produce sobre las nueve evaluaciones existentes exactamente el mismo
resultado que hoy; no importa ningún archivo del repo por su ruta; sin perfil dice qué falta y
termina; con un perfil de versión que no entiende lo rechaza con un mensaje claro.

**Acceptance Scenarios**:

1. **Given** este repositorio con su perfil de auditoría, **When** se corre la skill portable
   sobre cada una de las nueve evaluaciones conocidas, **Then** el resultado (archivo, línea,
   fuente, severidad, verificado) coincide con el esperado de cada evaluación sin cambiar
   ninguno de esos esperados.
2. **Given** la skill instalada fuera del repositorio, **When** se inspeccionan sus scripts y
   referencias, **Then** ninguno importa ni lee un archivo de este repo por su ruta: todo lo que
   necesita del proyecto lo obtiene del perfil.
3. **Given** un perfil, **When** la skill lo lee, **Then** encuentra la raíz del código, cómo se
   resuelve cada alcance (`--module`, `--dir`, `--diff` y la base contra la que se compara),
   la lista de gates con cómo se ejecuta cada uno, cómo entrega sus hallazgos (archivo, línea,
   regla, mensaje) y si es bloqueante o informativo, las clases de fuente de verdad con cómo se
   resuelve cada una y la severidad que impone, la ruta del documento de criterios de diseño y
   la ruta de las evaluaciones propias del proyecto.
4. **Given** un directorio sin perfil, **When** se invoca la skill, **Then** informa qué falta
   (el perfil y cómo obtenerlo) y termina sin auditar ni inventar hallazgos.
5. **Given** un perfil cuya versión la skill no conoce (más nueva o más vieja), **When** se
   invoca, **Then** lo rechaza diciendo la versión encontrada y la que entiende, sin auditar.
6. **Given** un gate declarado en el perfil que falla al ejecutarse o no entrega hallazgos en la
   forma acordada, **When** la skill corre los gates, **Then** lo reporta como gate degradado
   (con el motivo) y continúa con los demás; un gate bloqueante degradado impide el veredicto
   `approved`.
7. **Given** los criterios de diseño de este repositorio, **When** termina la historia, **Then**
   viven en el repositorio (en la documentación de auditoría) y no dentro de la skill; la skill
   los lee por la ruta del perfil.
8. **Given** las evaluaciones, **When** termina la historia, **Then** las universales (las que
   cualquier proyecto con esa clase de gate reproduce) viajan con la skill y las propias de esta
   arquitectura se quedan en el repositorio con sus fixtures; las nueve siguen corriendo en el
   proyecto de pruebas de herramientas.
9. **Given** un hallazgo cuya fuente es de una clase que el perfil no declara, **When** se
   verifica, **Then** queda `verified: false` con el motivo, igual que hoy con una fuente que no
   resuelve.

---

### User Story D-02 - Un proyecto nuevo o existente se vuelve auditable (Priority: P2)

Como ingeniero que arranca un proyecto (o que quiere auditar uno que ya existe), quiero una
skill de acondicionamiento —análoga al `init` de spec-kit— que inspeccione el repositorio,
pregunte sólo lo que no puede detectar, escriba el perfil de auditoría, el documento de criterios
prellenado con lo que las fuentes de verdad del proyecto ya dicen y los adaptadores que los gates
necesiten, y corra un _doctor_ que me diga qué está listo, qué falta y hasta dónde podría llegar
una auditoría hoy, para que "compatible con la auditoría" sea un estado verificable y no una
tarea manual que cada proyecto repite a su modo.

**Why this priority**: sin ella, la skill portable de D-01 sólo sirve en el proyecto que ya
tiene el perfil escrito a mano; con ella cualquier repo entra en minutos.

**Independent Test**: sobre este repositorio, la skill reconstruye un perfil equivalente al de
D-01 y el doctor queda en verde; sobre un repositorio vacío de fixture escribe el perfil mínimo
y la plantilla de criterios y el doctor lista lo que falta sin fallar; correrla dos veces
seguidas no cambia ningún archivo la segunda vez.

**Acceptance Scenarios**:

1. **Given** un repositorio, **When** se invoca la skill, **Then** inspecciona y reporta lo que
   encuentra: constitución de spec-kit, registros de decisiones (ADR), guía para agentes,
   herramientas de lint, arquitectura, duplicación, código muerto y mutación presentes, y la
   organización del código fuente; propone una regla de resolución de módulos derivada de esa
   organización.
2. **Given** lo detectado, **When** falta algo que sólo el dueño puede decidir (la regla de
   módulo si no se infiere, qué gates bloquean, la base de comparación para `--diff`), **Then**
   lo pregunta con opciones y un valor sugerido; lo demás no lo pregunta.
3. **Given** las respuestas, **When** escribe, **Then** produce el perfil de auditoría, el
   documento de criterios de diseño desde una plantilla prellenada con lo que la constitución y
   los ADR ya dicen (cada criterio con su fuente citada; donde el proyecto no decidió, un
   marcador `PLACEHOLDER`), y para cada gate que no entrega hallazgos como datos, un adaptador o
   una marca de pendiente con lo que falta.
4. **Given** el perfil escrito, **When** corre el doctor, **Then** verifica que cada gate corre
   y entrega hallazgos en la forma acordada, que cada clase de fuente resuelve al menos una vez,
   que el documento de criterios no tiene marcadores bloqueantes, y devuelve una tabla
   listo/falta/degradado y el veredicto máximo que una auditoría podría emitir hoy (sin fuentes
   de severidad alta la auditoría no puede rechazar nada, y lo dice).
5. **Given** un repositorio sin constitución ni ADR, **When** se invoca, **Then** no los
   inventa: recomienda el comando de spec-kit para crear la constitución, deja esas fuentes
   como pendientes en el perfil y el doctor lo refleja.
6. **Given** este repositorio, **When** se invoca la skill, **Then** el perfil que reconstruye
   es equivalente al de D-01 (mismos alcances, gates, fuentes y rutas) y el doctor queda en
   verde.
7. **Given** un repositorio vacío de fixture, **When** se invoca, **Then** escribe el perfil
   mínimo y la plantilla de criterios, el doctor lista lo que falta y termina sin fallar.
8. **Given** un repositorio ya acondicionado, **When** se invoca de nuevo, **Then** no cambia
   ningún archivo y el doctor da el mismo resultado (idempotente).
9. **Given** el perfil y los criterios escritos por la skill, **When** se corre la auditoría de
   D-01 sobre ese repositorio, **Then** la auditoría los acepta sin ajuste manual.

---

### D-03 - `engineering-baseline` (Priority: —, `evaluada`, sin historia)

Scaffold opinado para backends TypeScript con la cadena de calidad de este repositorio (lint
estricto con tipos, arquitectura con anillos y mapa de contextos, duplicación, código muerto,
mutación, control de idioma, cadena `quality`, hooks de pre-commit, CI). Se anota como candidata
a **feature aparte y opt-in**: la auditoría (D-01) y el acondicionamiento (D-02) deben funcionar
sin exigirla, y por eso no entra en esta feature salvo decisión del dueño. Cuando entre, su
historia se escribe aquí o en su propia feature, y el registro lo dice.

---

### Edge Cases

- **Convivencia con la copia actual.** Hoy la skill vive en `.claude/skills/auditing-architecture/`
  y el proyecto de pruebas de herramientas la ejercita. Al volverse externa, o se reemplaza por
  la instalación del plugin (y el repo deja de contener el método) o se conserva una copia fijada
  a una versión; en cualquiera de los dos casos las pruebas del repo deben poder correr la skill
  en CI sin acceso a nada fuera del repositorio o de sus dependencias declaradas. Es una decisión
  de plan; la spec sólo exige que las nueve evaluaciones sigan corriendo en CI.
- **Un gate que no existe en otro proyecto.** Un perfil puede declarar menos gates que este
  repo (o ninguno bloqueante); la auditoría corre con los que hay y el veredicto máximo lo
  refleja; nunca asume un gate que el perfil no declara.
- **Fuentes de verdad en otro idioma o con otra forma.** El perfil describe cómo resolver cada
  clase (por ejemplo, un prefijo y un directorio); la skill no asume que los ADR estén en
  español ni que la constitución sea la de spec-kit.
- **Un adaptador de gate que emite hallazgos sin línea.** Un hallazgo sin `file:line` no entra
  al reporte (regla existente del método); el gate se reporta como degradado si ninguno de sus
  hallazgos trae ubicación.
- **Criterios con `PLACEHOLDER`.** La auditoría corre igual, pero cualquier hallazgo que cite un
  criterio con marcador queda en severidad baja y el reporte lo dice; el doctor de D-02 lo lista
  como "falta".
- **Idempotencia con cambios manuales.** Si el dueño editó el perfil o los criterios a mano, la
  skill de acondicionamiento no los pisa: reporta la diferencia entre lo detectado y lo escrito y
  deja la decisión al dueño.
- **Versiones.** Skill y perfil llevan versión; una skill nueva que cambia la forma del perfil
  documenta la migración y el doctor la detecta.
- **Una deuda nueva que toca lo ya implementado.** Si una historia posterior obliga a cambiar el
  resultado de una `implementada`, se registra como deuda nueva con la referencia, no se reabre
  la cerrada.

## Requirements _(mandatory)_

### Functional Requirements (transversales a toda deuda)

- **FR-001**: Toda deuda MUST figurar en el registro con id estable, título, origen, estado y
  fecha; un id nunca se reutiliza ni se renumera.
- **FR-002**: Una deuda MUST pasar a `implementada` sólo con su historia cerrada, sus gates en
  verde y su commit citado en la columna de cierre del registro.
- **FR-003**: Cada historia MUST cerrar con `format:check`, `quality`, `typecheck`, las pruebas
  rápidas y las pruebas de herramientas en verde, y con cero excepciones nuevas de lint, idioma,
  arquitectura, duplicación, código muerto o mutación.
- **FR-004**: Las verificaciones de identificadores, idioma y ADR MUST seguir en verde: una
  skill escrita en español con scripts en inglés sigue la regla de idioma del repositorio
  (ADR-015).
- **FR-005**: La decisión transversal "método portable vs perfil por proyecto" MUST quedar en un
  ADR nuevo; las instrucciones para agentes y el README MUST actualizarse donde citen la skill o
  sus rutas.
- **FR-006**: Ninguna deuda de esta feature MUST cambiar el contrato, agregar operaciones, tocar
  dominio o aplicación ni persistencia; una deuda que lo requiera se registra como `descartada`
  con la feature que la tomará.

### Functional Requirements D-01

- **FR-01-1**: La skill de auditoría MUST no importar ni leer ningún archivo de este repositorio
  por su ruta; todo lo específico del proyecto MUST llegar por el perfil.
- **FR-01-2**: El perfil MUST declarar, con versión: raíz del código; resolución de cada
  alcance (`--module`, `--dir`, `--diff` con su base); gates con cómo se ejecutan, cómo
  entregan hallazgos (archivo, línea, regla, mensaje) y su modo bloqueante o informativo; clases
  de fuente de verdad con su resolución y la severidad que imponen; ruta del documento de
  criterios; ruta de las evaluaciones propias del proyecto.
- **FR-01-3**: La skill MUST rechazar un perfil de versión desconocida con un mensaje que nombre
  la versión encontrada y la esperada, y MUST terminar diciendo qué falta cuando no hay perfil.
- **FR-01-4**: Un gate que falla o no entrega hallazgos en la forma acordada MUST reportarse
  como degradado con motivo, sin detener los demás; un bloqueante degradado MUST impedir
  `approved`.
- **FR-01-5**: Los criterios de diseño de este repositorio MUST vivir en su documentación de
  auditoría; las evaluaciones universales MUST viajar con la skill y las propias de esta
  arquitectura MUST quedarse en el repositorio con sus fixtures.
- **FR-01-6**: Las nueve evaluaciones existentes MUST producir el mismo resultado esperado que
  hoy, sin cambiar sus esperados, y MUST seguir corriendo en el proyecto de pruebas de
  herramientas en CI.
- **FR-01-7**: El método (siete pasos, formato del hallazgo, refutación, verificación mecánica,
  veredicto derivado) MUST conservarse sin cambio de fondo; lo único que cambia es de dónde
  toma lo específico del proyecto.

### Functional Requirements D-02

- **FR-02-1**: La skill de acondicionamiento MUST inspeccionar el repositorio y reportar
  fuentes de verdad, herramientas de calidad y organización del código antes de escribir nada.
- **FR-02-2**: MUST preguntar sólo lo que no detecta, con opciones y un valor sugerido, y MUST
  no preguntar lo que detectó.
- **FR-02-3**: MUST escribir el perfil, el documento de criterios prellenado con fuentes citadas
  y marcadores donde falte decisión, y un adaptador o una marca de pendiente por cada gate que
  no entregue hallazgos como datos.
- **FR-02-4**: MUST incluir un doctor que verifique gates, fuentes y criterios y devuelva una
  tabla listo/falta/degradado con el veredicto máximo alcanzable por una auditoría hoy.
- **FR-02-5**: MUST no inventar decisiones del dueño: sin constitución ni ADR, recomienda cómo
  crearlos y deja las fuentes pendientes.
- **FR-02-6**: MUST ser idempotente: una segunda corrida sobre un repositorio acondicionado no
  cambia ningún archivo; ante ediciones manuales reporta la diferencia y no pisa.
- **FR-02-7**: MUST ser agnóstica del stack: nada en ella asume un lenguaje, un framework ni las
  herramientas de este repositorio; lo que detecta lo detecta por presencia, no por supuesto.
- **FR-02-8**: Sobre este repositorio MUST reconstruir un perfil equivalente al de D-01 con el
  doctor en verde; sobre un fixture vacío MUST escribir el mínimo y listar lo que falta sin
  fallar.

### Key Entities

- **Deuda técnica**: un defecto de forma, herramienta o proceso registrado con id estable,
  origen, estado y, cuando el dueño la acepta, una historia con alcance y criterios propios.
- **Registro de deudas**: la tabla de esta spec; la única lista de qué entra en la feature y en
  qué estado está.
- **Skill portable**: un procedimiento para agentes que no contiene nada específico de un
  proyecto y toma todo lo específico de un perfil; se instala fuera del repositorio y lleva
  versión.
- **Perfil de auditoría**: el archivo, versionado, con el que un proyecto describe a la skill su
  raíz de código, sus alcances, sus gates, sus fuentes de verdad, sus criterios y sus
  evaluaciones propias.
- **Fuente de verdad**: una clase de documento que justifica un hallazgo (constitución, ADR,
  guía para agentes, regla de un gate, criterio de claridad), con su forma de resolución y la
  severidad que impone.
- **Gate**: una verificación ejecutable del proyecto que entrega hallazgos como datos (archivo,
  línea, regla, mensaje) y es bloqueante o informativa.
- **Evaluación**: un escenario con un defecto conocido y su resultado esperado; universal si
  cualquier proyecto con esa clase de gate lo reproduce, propia si depende de esta arquitectura.
- **Doctor**: la verificación de que un repositorio está acondicionado: gates que corren,
  fuentes que resuelven, criterios sin marcadores bloqueantes, veredicto máximo alcanzable.

## Success Criteria _(mandatory)_

### Measurable Outcomes (comunes)

- **SC-001**: El 100 % de las deudas del registro tiene estado y fecha; toda `implementada` cita
  su commit; ningún id se repite.
- **SC-002**: Todos los gates del repositorio en verde con cero excepciones nuevas al cierre de
  cada historia.
- **SC-003**: Existe el ADR de "método vs perfil" y ninguna instrucción para agentes ni README
  cita una ruta de la skill que ya no existe.

### Measurable Outcomes D-01

- **SC-01-1**: Nueve de nueve evaluaciones coinciden con su esperado, con los esperados sin diff
  respecto de `main`.
- **SC-01-2**: Cero imports o lecturas por ruta de archivos de este repositorio dentro de la
  skill (verificado por inspección automática de sus scripts).
- **SC-01-3**: Sin perfil, la skill termina en una línea que dice qué falta; con versión
  desconocida, en una línea que nombra las dos versiones; en ambos casos cero hallazgos.
- **SC-01-4**: Un proyecto de prueba con un solo gate declarado y ninguna fuente de severidad
  alta obtiene una auditoría cuyo veredicto máximo es `changes-required` y el reporte lo dice.

### Measurable Outcomes D-02

- **SC-02-1**: Sobre este repositorio, el perfil reconstruido es equivalente al de D-01 y el
  doctor da 0 "falta" y 0 "degradado".
- **SC-02-2**: Sobre un fixture vacío, la skill escribe el perfil mínimo y la plantilla, el
  doctor lista al menos las fuentes pendientes y termina con éxito.
- **SC-02-3**: Dos corridas consecutivas sobre el mismo repositorio: la segunda cambia cero
  archivos.
- **SC-02-4**: El número de preguntas al usuario sobre este repositorio es cero (todo se
  detecta) y sobre el fixture vacío no supera las tres decisiones que la spec enumera.

## Assumptions

- La skill portable y la de acondicionamiento se entregan juntas como un plugin de Claude Code
  con versión (un directorio con las skills, sus scripts y sus evaluaciones universales),
  instalable por ruta o por marketplace; actualizarlo no toca los repositorios que lo usan; cada
  repositorio conserva sólo su perfil, sus criterios y sus evaluaciones propias. Cómo convive con
  la copia actual en `.claude/skills/` (reemplazo o copia fijada) es una decisión de plan.
- El perfil se escribe en JSON con versión propia, en la raíz del repositorio; el nombre exacto y
  el esquema los fija el plan y los documenta el ADR.
- El método de auditoría no cambia de fondo: mismos siete pasos, mismo formato de hallazgo,
  misma refutación, mismo veredicto derivado. Si al portarlo aparece algo que el método asume de
  este repo, se generaliza sin bajar el rigor y se anota en la investigación del plan.
- Las evaluaciones "universales" son las que sólo dependen de una clase de gate que cualquier
  proyecto puede tener (por ejemplo, un `catch` vacío o funciones idénticas); las que dependen
  de anillos, composición o perfiles de este repo son "propias". La clasificación exacta la hace
  el plan.
- La skill de acondicionamiento no instala herramientas de calidad: detecta las que hay y deja
  pendientes las que faltan. Instalar una cadena opinada es D-03, aparte y opt-in.
- Las dos historias son independientes en implementación pero D-02 se valida contra D-01 (su
  doctor y su perfil deben ser aceptados por la auditoría); el orden natural es D-01 → D-02.
- La rama sale de `018-adaptadores-por-modulo` porque la skill actual ya resuelve las rutas del
  anillo nuevo; se rebasa sobre `main` cuando la 018 se mergee.
- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el
  dueño.
