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

| Id   | Título                                                                         | Origen                         | Estado         | Fecha      | Cierre    |
| ---- | ------------------------------------------------------------------------------ | ------------------------------ | -------------- | ---------- | --------- |
| D-01 | La skill de auditoría de arquitectura está acoplada a este repo                | Revisión del dueño tras la 018 | `especificada` | 2026-09-21 | —         |
| D-02 | No hay skill de acondicionamiento: un proyecto no puede volverse auditable     | Evaluación con el dueño (D-01) | `especificada` | 2026-09-21 | —         |
| D-03 | `engineering-baseline`: scaffold opinado con la cadena de calidad de este repo | Evaluación con el dueño (D-02) | `evaluada`     | 2026-09-21 | —         |
| D-04 | `config/` sin documentación ni esquema propio                                  | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `d37093b` |
| D-05 | `contracts/` sin README ni tabla de extensiones `x-*`                          | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `8ffe84e` |
| D-06 | Los directorios de primer nivel no se explican solos                           | Revisión del dueño, 2026-09-21 | `implementada` | 2026-09-21 | `cd292e0` |

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

### User Story D-04 - Los archivos de `config/` se explican solos (Priority: P3)

Como ingeniero o agente que abre `config/`, quiero saber sin leer código qué es cada archivo,
quién lo lee y cuándo, qué variable de entorno lo reemplaza, cuáles viajan con el release y
cuáles son sólo de desarrollo, y qué significa cada campo con su rango, y quiero que el editor me
lo diga al escribir y que un valor inválido se detecte antes de arrancar el servidor, para que
cambiar una ventana, una política o una semilla no dependa de rastrear seis lugares (contrato,
notas del glosario, lectores de composición, instrucciones para agentes, README, una spec
histórica).

**Why this priority**: es la de lectura más frecuente (cada `dev`, cada piloto tocará estos
archivos); no depende de D-01 ni de D-02. El README de `config/` es una instancia de la
convención de D-06; esta historia se queda con lo específico: esquemas, descripciones y
validación.

**Independent Test**: cada archivo de `config/` declara su esquema y valida contra él en una
prueba; los dos esquemas del release se derivan del contrato (sin réplica); un campo nuevo sin
descripción falla; el README de `config/` (D-06) lleva, además del inventario, la variable de
entorno y el momento de lectura de cada archivo.

**Acceptance Scenarios**:

1. **Given** el `README.md` de `config/` (D-06), **When** se lee, **Then** por cada archivo
   dice, además del inventario común, qué nivel o rol cumple, qué variable de entorno lo
   reemplaza, si viaja con el release o es sólo de desarrollo, y cómo se reporta un valor
   inválido (el error que nombra el campo).
2. **Given** los dos archivos del release (nivel de plataforma y defaults de tratamiento),
   **When** corre la generación desde el contrato, **Then** produce un esquema JSON por cada
   uno, derivado de su esquema del contrato (mismos campos, descripciones y rangos), en el
   directorio de lo generado, verificado por drift como el resto de lo generado.
3. **Given** los archivos de semilla de merchants y de operadores (que no son DTO de la API),
   **When** termina la historia, **Then** cada uno tiene su esquema escrito una sola vez, con
   descripción por campo, y una prueba verifica que lo que el esquema acepta es lo que los
   lectores de composición aceptan (un campo del esquema que el lector rechaza, o al revés,
   falla).
4. **Given** cualquiera de los cuatro archivos, **When** se abre en un editor con soporte de
   esquemas JSON, **Then** el archivo referencia su esquema y el editor muestra la descripción y
   el rango de cada campo y marca un valor inválido.
5. **Given** los cuatro archivos, **When** corre la suite, **Then** una prueba los valida
   contra su esquema; un archivo nuevo en `config/` sin esquema ni entrada en el README falla.
6. **Given** las notas del glosario de los dos niveles, **When** se leen, **Then** enlazan al
   README y al esquema, sin duplicar descripciones: la fuente de cada campo sigue siendo el
   contrato.
7. **Given** un campo del contrato sin descripción en alguno de los esquemas de los niveles o
   de sus sub-esquemas (políticas, condiciones, frescura, nivel de sincronización), **When**
   corre la verificación del contrato, **Then** falla nombrando el campo.

---

### User Story D-05 - `contracts/` se explica sola y sus extensiones tienen un lugar (Priority: P3)

Como ingeniero o agente que abre `contracts/`, quiero saber qué es cada entrada (raíz, rutas,
componentes, ejemplos, catálogos, mapa, reglas, severidades, lo derivado), qué convenciones
rigen el multi-archivo (promoción del bundle, componentes sin referencia hasta su primera
operación, subconjunto de OpenAPI 3.0, discriminadores con `mapping`), y qué significa cada
extensión `x-*` —dónde va, qué forma tiene, qué regla la verifica y quién la consume en
runtime—, y cómo se agrega una operación, un esquema, un tipo de problema, un motivo de
`NO_OP`, una regla o un ejemplo, para no reconstruirlo desde cuatro ADR, las instrucciones para
agentes y el README de las pruebas de reglas.

**Why this priority**: es la carpeta con más convenciones del repo y la única fuente de verdad
HTTP; hoy nada dentro de ella lo dice. Independiente de las demás.

**Independent Test**: el README de `contracts/` (D-06) tiene una tabla de extensiones que
nombra cada `x-*` presente en el contrato y una prueba lo verifica; `webhooks/` está
justificado o no existe; las cabeceras de los catálogos y de las severidades son ciertas.

**Acceptance Scenarios**:

1. **Given** el `README.md` de `contracts/` (D-06), **When** se lee, **Then** por cada entrada
   dice si es fuente o derivada, qué la lee (bundle, servidor, generación, reglas, diff) y las
   convenciones del multi-archivo, enlazando a la fuente normativa (instrucciones para agentes,
   ADR, README de las reglas) sin duplicarla.
2. **Given** las extensiones `x-*` que aparecen en el contrato, **When** se lee el README,
   **Then** cada una tiene su fila: nombre, dónde se declara (raíz, operación, esquema), forma,
   regla que la verifica y consumidor en runtime si lo tiene; una extensión nueva sin fila hace
   fallar la prueba, y una fila sin extensión también.
3. **Given** la sección "cómo agregar", **When** se busca operación, esquema, tipo de problema,
   motivo de `NO_OP`, regla o ejemplo, **Then** cada uno tiene su entrada breve con el paso a
   paso o el enlace al lugar que lo describe.
4. **Given** `webhooks/` (vacío desde la primera feature), **When** termina la historia,
   **Then** o no existe, o el README dice para qué está reservado y qué feature del mapa lo usa;
   la decisión es del dueño y queda registrada.
5. **Given** la cabecera de `problem-types.yaml`, **When** se lee, **Then** describe lo que hoy
   ocurre (el catálogo se genera a `generated/`, no se importa como constantes); **Given** las
   severidades de `contract:diff`, **Then** el motivo de cada elevación está en el archivo o, si
   la herramienta no admite comentarios, en el README con la cita al ADR.
6. **Given** las instrucciones para agentes, **When** termina la historia, **Then** su bloque de
   notas del contrato conserva lo normativo y enlaza al README para lo descriptivo.

---

### User Story D-06 - Los directorios de primer nivel se explican solos (Priority: P3)

Como persona o agente que llega al repositorio, quiero que cada directorio de primer nivel que
no sea código (`config/`, `contracts/`, `generated/`, `patches/`, `scripts/`, `docs/`,
`tests/`, `client/`, `reports/`, `specs/`) tenga un `README.md` que inventaríe sus entradas
—qué es cada una, si es fuente o derivada, quién la lee o la ejecuta, cómo se verifica— con una
prueba que impida que el inventario se desactualice, para que la carpeta sea lo primero que
explica y no la última que se entera, y para que las instrucciones para agentes dejen de ser el
índice de todo.

**Why this priority**: es la convención que da forma a D-04 y D-05 y evita que aparezcan D-07,
D-08 y D-09 por `generated/`, `patches/` y `scripts/`; sin la prueba, cinco README divergen
en un mes.

**Independent Test**: una prueba del proyecto de herramientas recorre los directorios de primer
nivel del repositorio y falla si a alguno le falta el README, si una entrada de primer nivel del
directorio no está nombrada, o si el README nombra algo que no existe; dos verificaciones de
cabecera acompañan: todo archivo generado cita un script que existe, y todo parche declara qué
arregla y cuándo se retira.

**Acceptance Scenarios**:

1. **Given** un directorio de primer nivel que no es código (la lista la fija la prueba, con
   `src/` y las dependencias fuera), **When** corre la suite, **Then** falla si falta su
   `README.md`.
2. **Given** el README de un directorio, **When** se compara con el directorio, **Then** cada
   entrada de primer nivel (archivo o subdirectorio) aparece nombrada, y cada nombre del
   inventario existe; la prueba lista lo que falta y lo que sobra.
3. **Given** el inventario de una entrada, **When** se lee, **Then** dice qué es, si es fuente o
   derivada, quién la lee o la ejecuta y cómo se verifica; un directorio puede exigir columnas
   propias (D-04: variable de entorno y momento de lectura; D-05: la tabla de extensiones).
4. **Given** `generated/`, **When** corre la suite, **Then** cada archivo lleva la cabecera de
   generado con el comando que lo regenera y el script que lo produce, y ese script existe (hoy
   uno cita un script inexistente).
5. **Given** `patches/`, **When** corre la suite, **Then** cada parche declara en su cabecera
   qué arregla (con la referencia al upstream) y la condición de retiro, y el README explica la
   política (nunca degradar: parchear o convivencia oficial) y cómo se retira un parche.
6. **Given** `scripts/`, **When** se lee su README, **Then** distingue entrypoints de
   `package.json`, utilidades de línea de comandos, librerías compartidas, el plugin de lint y
   los archivos de datos, y dice cómo se agrega una verificación (en qué cadena se engancha) y
   una regla de lint; toda entrada lleva una cabecera que dice qué hace.
7. **Given** las instrucciones para agentes, **When** termina la historia, **Then** conservan lo
   normativo (qué falla el build, cómo se escribe cada cosa) y enlazan al README de cada
   directorio para lo descriptivo; ninguna ruta citada está rota.
8. **Given** un directorio de primer nivel nuevo en una feature futura, **When** se agrega sin
   README, **Then** la suite falla nombrándolo.

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
- **La referencia al esquema dentro del archivo.** Los lectores de los niveles rechazan
  claves desconocidas (forma cerrada); la clave que referencia el esquema no es un valor de
  configuración y debe ignorarse sin abrir la forma a nada más.
- **Un campo del contrato que la semilla admite con otro nombre** (porcentajes enteros, claves
  crudas en vez de huellas): el esquema de la semilla describe la forma de la semilla, no la del
  DTO; la prueba contra los lectores es la que evita que diverjan.
- **Directorios derivados o efímeros** (`dist/`, `node_modules/`, `reports/` en parte,
  `contracts/dist/`): la prueba de inventario los excluye por lista explícita o los exige con un
  README que diga que su contenido no se inventaría (es derivado, ignorado por git) y qué lo
  produce. `reports/` conserva el archivo incremental de mutación y merece README.
- **Inventario a nivel de entrada, no de archivo**: en `contracts/components/schemas/` o
  `scripts/lint/` el README nombra el subdirectorio y su convención, no cada archivo; la prueba
  verifica el primer nivel de cada directorio y nada más.
- **Cifras en prosa**: los README no dicen cuántas entradas hay (documentación viva); la prueba
  es la que cuenta.
- **Una extensión `x-*` que sólo aparece en el bundle o en lo generado** no cuenta: la prueba
  de D-05 lee la fuente del contrato.
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

### Functional Requirements D-04

- **FR-04-1**: El README de `config/` (D-06) MUST decir, por cada archivo, qué nivel o rol
  cumple, qué variable de entorno lo reemplaza, si viaja con el release o es sólo de desarrollo,
  y cómo se reporta un valor inválido; la prueba de inventario de D-06 MUST exigir esas columnas
  en ese directorio.
- **FR-04-2**: Los esquemas JSON de los dos niveles del release MUST derivarse del contrato por
  la misma generación que el resto de lo generado, sin réplica manual, y verificarse por drift.
- **FR-04-3**: La semilla de merchants y los operadores MUST tener cada uno un esquema escrito
  una sola vez con descripción por campo, y una prueba MUST verificar que coincide con lo que
  aceptan sus lectores.
- **FR-04-4**: Cada archivo de `config/` MUST referenciar su esquema y una prueba MUST validarlo
  contra él; un archivo nuevo sin esquema o sin entrada en el README MUST fallar.
- **FR-04-5**: Todo campo de los esquemas del contrato que alimentan los niveles (y sus
  sub-esquemas) MUST tener descripción; la verificación del contrato MUST fallar si falta.
- **FR-04-6**: Las notas del glosario de los dos niveles MUST enlazar al README y al esquema sin
  duplicar descripciones.
- **FR-04-7**: Ningún valor ni regla de validación MUST cambiar: los archivos actuales validan
  contra sus esquemas sin editarlos (salvo la referencia al esquema) y los mensajes de error de
  configuración se conservan.

### Functional Requirements D-05

- **FR-05-1**: El README de `contracts/` (D-06) MUST decir, por cada entrada, si es fuente o
  derivada y qué la lee, y MUST enunciar las convenciones del multi-archivo enlazando a la
  fuente normativa sin duplicarla.
- **FR-05-2**: El README MUST tener una tabla de extensiones `x-*` (nombre, dónde se declara,
  forma, regla que la verifica, consumidor en runtime) y una prueba MUST verificar que coincide
  en los dos sentidos con las extensiones presentes en la fuente del contrato.
- **FR-05-3**: El README MUST tener una sección "cómo agregar" para operación, esquema, tipo de
  problema, motivo de `NO_OP`, regla y ejemplo.
- **FR-05-4**: `webhooks/` MUST no existir o estar justificado en el README con la feature del
  mapa que lo usará; decisión del dueño registrada.
- **FR-05-5**: Las cabeceras de `problem-types.yaml` y de las severidades de `contract:diff`
  MUST describir lo que ocurre hoy, con el motivo o la cita al ADR.
- **FR-05-6**: El contrato, el mapa y lo generado MUST no cambiar (sólo comentarios).

### Functional Requirements D-06

- **FR-06-1**: Todo directorio de primer nivel que no sea código ni dependencia MUST tener un
  `README.md`; la lista de directorios y las exclusiones MUST ser explícitas en la prueba.
- **FR-06-2**: Una prueba del proyecto de herramientas MUST verificar, por directorio, que el
  README existe, que nombra cada entrada de primer nivel y que no nombra nada inexistente,
  listando faltantes y sobrantes.
- **FR-06-3**: Cada entrada del inventario MUST decir qué es, si es fuente o derivada, quién la
  lee o la ejecuta y cómo se verifica; un directorio MAY exigir columnas propias, declaradas en
  la prueba.
- **FR-06-4**: Todo archivo de `generated/` MUST llevar cabecera de generado con el comando y
  el script que lo produce, y el script MUST existir; una prueba lo verifica.
- **FR-06-5**: Todo parche MUST declarar qué arregla (referencia al upstream) y su condición de
  retiro; una prueba lo verifica; el README de `patches/` MUST enunciar la política de no
  degradar y cómo se retira un parche.
- **FR-06-6**: Todo archivo de `scripts/` MUST llevar una cabecera que diga qué hace; el README
  MUST clasificar entrypoints, utilidades, librerías, plugin de lint y datos, y decir cómo se
  agrega una verificación y una regla.
- **FR-06-7**: Las instrucciones para agentes MUST conservar lo normativo y enlazar al README de
  cada directorio para lo descriptivo; ninguna ruta citada MUST quedar rota
  (`check:identifiers` y la prueba de documentación lo verifican).
- **FR-06-8**: Ningún README MUST llevar cifras de estado en prosa (documentación viva).

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
- **Inventario de directorio**: el README de un directorio de primer nivel que nombra cada
  entrada con qué es, si es fuente o derivada, quién la lee y cómo se verifica; una prueba lo
  mantiene igual al directorio.
- **Extensión del contrato**: una propiedad `x-*` del contrato con lugar, forma, regla que la
  verifica y consumidor en runtime.

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

### Measurable Outcomes D-04

- **SC-04-1**: Cuatro de cuatro archivos de `config/` referencian un esquema y validan contra
  él en la suite; los dos del release contra esquemas derivados del contrato.
- **SC-04-2**: Cien por ciento de los campos de los esquemas de los niveles y sus sub-esquemas
  con descripción, verificado por el contrato.
- **SC-04-3**: El README de `config/` lleva, para el 100 % de los archivos, variable de entorno
  y momento de lectura; la prueba de inventario (D-06) lo verifica.
- **SC-04-4**: Cero cambios en los valores de los archivos actuales ni en los mensajes de
  error de configuración (la suite existente pasa sin cambiar una aserción).

### Measurable Outcomes D-05

- **SC-05-1**: El 100 % de las extensiones `x-*` presentes en la fuente del contrato tiene su
  fila, y el 100 % de las filas tiene su extensión; una prueba lo verifica.
- **SC-05-2**: `webhooks/` resuelto (ausente o justificado); cero cabeceras desactualizadas en
  los catálogos y las severidades.
- **SC-05-3**: Cero cambios en el contrato bundleado, el mapa y lo generado (sólo comentarios).

### Measurable Outcomes D-06

- **SC-06-1**: El 100 % de los directorios de primer nivel que la prueba lista tiene README con
  inventario completo (cero faltantes, cero sobrantes) en la suite.
- **SC-06-2**: El 100 % de los archivos generados cita un script existente; el 100 % de los
  parches declara arreglo y retiro; el 100 % de los scripts lleva cabecera.
- **SC-06-3**: Las instrucciones para agentes pierden líneas descriptivas (medido en el
  cierre, sin cifra en prosa) y no citan ninguna ruta rota.
- **SC-06-4**: Un directorio de primer nivel nuevo sin README falla la suite (probado con un
  fixture).

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
- D-04 no cambia el contrato salvo agregar descripciones donde falten (aditivo, sin cambio de
  forma); los esquemas de la semilla y de los operadores no entran al contrato (no son DTO de la
  API): dónde viven y cómo se verifican contra los lectores lo fija el plan. La referencia al
  esquema desde cada archivo (`$schema`) debe ser tolerada por los lectores sin cambiar su
  validación.
- D-05 y D-06 son documentación y pruebas de documentación: no cambian código de `src/`, el
  contrato bundleado ni lo generado. El orden natural es D-06 (la convención y la prueba)
  antes que los README específicos de D-04 y D-05, o en el mismo commit que el primero de ellos.
- Las dos historias son independientes en implementación pero D-02 se valida contra D-01 (su
  doctor y su perfil deben ser aceptados por la auditoría); el orden natural es D-01 → D-02.
- La rama sale de `018-adaptadores-por-modulo` porque la skill actual ya resuelve las rutas del
  anillo nuevo; se rebasa sobre `main` cuando la 018 se mergee.
- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el
  dueño.
