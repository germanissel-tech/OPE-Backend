---
description: "Task list for feature 036 — los niveles 1 y 2 se configuran por API"
---

# Tasks: Los niveles 1 y 2 se configuran por API

**Input**: `specs/036-niveles-por-api/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Tests**: sí, y **primero** donde hay una regla que decidir. El caso que decide la corrección de la
feature —lo alcanzado por hoja y no por campo— se escribe antes que el cálculo.

**Organización**: una fase por historia, más una fase 1 con el mecanismo que las cuatro comparten.

**Orden del contrato**: esta feature toca HTTP, así que cada historia que agrega operaciones sigue los seis
pasos de `.claude/rules/contrato.md` — el mapa primero (fase 1), después el contrato, `contract:check`,
tipos, código, gates. Nada entra al contrato sin estar antes en el mapa.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: El mecanismo (bloquea las cuatro historias)

**Goal**: una versión de nivel que se pueda publicar, guardar, leer y comparar, y un almacén que la
conserve — sin ninguna operación HTTP todavía.

**Independent Test**: las versiones se publican y se leen por el puerto, sobreviven un reinicio, y el
cálculo de hojas distingue el caso del objeto declarado a medias.

- [x] T001 `contracts/api-map.yaml` — las **seis** operaciones como `planned` (paso 0 del orden del
      contrato): publicar cada nivel, listar versiones de cada nivel, leer una versión de cada nivel. Con
      consumidor `admin`, tag, capacidades (`configuration:write` / `configuration:read`), `roadmap` y
      fuente. `npm run check:api-map` compara el mapa y el contrato en los dos sentidos.
- [x] T002 `tests/unit/domain/configuration/level-version.test.ts` — **antes de la entidad**: un contenido
      igual al vigente no es una versión nueva; una versión correctiva **exige** motivo; `rehydrate` no
      re-juzga (ADR-024).
- [x] T003 `src/domain/configuration/level-version.ts` — la entidad: `private constructor`, `of(...)` que
      devuelve `Result`, `rehydrate`, `record()`. El número **no** se declara: lo acuña el almacén.
- [x] T004 `tests/unit/domain/configuration/changed-leaves.test.ts` — **antes del cálculo, y es el caso que
      decide si la feature es correcta**: un merchant que declara **una** hoja de un objeto y no las otras
      queda **alcanzado**. Más: declarar todas las hojas que cambiaron lo deja fuera; declarar el objeto
      contenedor no alcanza; dos versiones idénticas no cambian ninguna hoja.
- [x] T005 `src/domain/configuration/` — el cálculo, **como método de quien lo sabe y no como función
      suelta** (`src/domain/` no exporta funciones sueltas): una versión sabe qué hojas cambian contra otra,
      y el conjunto resultante sabe si un `declared` lo cubre.
- [x] T006 `src/application/configuration/ports/level-store.ts` — el puerto: publicar (numerando),
      la última de un nivel, listar paginado, leer una. `Result` con `StoreUnavailable` en las escrituras
      (ADR-021).
- [x] T007 `src/interface-adapters/configuration/gateways/memory-level-store.ts` — el gateway en memoria,
      con su prueba unitaria.
- [x] T008 `migrations/005-configuration-levels.sql` — una tabla para los dos niveles, clave `(level,
version)`, índice único, las dos reglas del dueño (`created_at`, `updated_at`), y
      `PRAGMA user_version = 5`. Con su fila en el inventario de `migrations/README.md`.
- [x] T009 `src/interface-adapters/configuration/gateways/sqlite-level-store.ts` — el gateway durable:
      `MAX(version)+1` **dentro de la transacción** (dos publicaciones no comparten número), `record()` de
      la entidad al escribir, rehidratación al leer (regla de gateways durables).
- [x] T010 `tests/durability/level-store.test.ts` — lo que sólo se ve contra un almacén de verdad: las
      versiones cruzan un reinicio, el arranque usa la última, dos publicaciones no comparten número.
- [x] T011 `tests/architecture/storage-inventory.test.ts` — el almacén nuevo gana su fila, en los dos
      sentidos (SC-011 de la feature 033).
- [x] T012 `src/composition/` — los archivos del release pasan a ser **semilla**: se importan sólo si el
      almacén del nivel está vacío, a nombre del operador del sistema, y el arranque **dice** qué hizo
      (FR-012, SC-009). Cierra la mitad de la semilla de **D-29**.
- [x] T013 `tests/unit/configuration/release-levels.test.ts` — la huella de `decisionPolicy` y
      `commercialPolicy` cambia de trabajo: pasa a fijar el contenido de la **semilla**, no del nivel
      vigente (research R-05). Su comentario dice por qué.

**Checkpoint**: se puede publicar y leer una versión de nivel por el puerto, sobrevive un reinicio, y nada
de HTTP cambió todavía.

---

## Phase 2: User Story 1 — Los defaults de tratamiento se publican por API (P1)

**Goal**: un operador publica una versión de defaults y vale desde la petición siguiente, sin reiniciar.

**Independent Test**: publicar por la API, comprobar que la resolución la usa en el pedido siguiente, que
la versión quedó numerada y que hay entrada en el registro.

- [x] T014 [US1] `contracts/` — la operación de publicar defaults y su cuerpo (paso 1): `content` y,
      cuando corresponda, `corrective` + `reason`; `additionalProperties: false`; respuestas `201`/`200`
      (repetida), `409`, `422`, `503`. El `409` reusa el problema de configuración congelada que ya existe.
- [x] T015 [US1] `npm run contract:check` en verde (paso 2) y `npm run contract:types` (paso 3). **Nunca
      editar lo generado a mano.**
- [x] T016 [US1] `src/application/configuration/use-cases/publish-treatment-defaults.use-case.ts` — el
      caso de uso, con el orden del molde y **seis dependencias como máximo** (ADR-023). El alcance se juzga
      contra **todos** los merchants: exige operador de alcance total (FR-011).
- [x] T017 [US1] `src/application/configuration/services/configuration.service.ts` — la **invalidación**:
      una publicación de nivel tira los niveles memoizados y la configuración efectiva por merchant, y no
      recalcula nada (research R-03). El siguiente pedido de cada merchant la recalcula, como después de un
      arranque.
- [x] T018 [US1] `src/interface-adapters/configuration/controllers/publish-treatment-defaults.ts` y el
      cableado en `src/composition/modules/configuration.ts` (paso 4): `served(...)`, y el handler **no
      elige** si se audita — lo decide el módulo.
- [x] T019 [P] [US1] `tests/unit/application/configuration/publish-treatment-defaults.test.ts` — versión
      correlativa, cuerpo idéntico que repite, valor inválido que no crea versión, alcance insuficiente,
      almacén que no acepta escribir.
- [x] T020 [US1] `tests/integration/levels.test.ts` — por HTTP: publicar, y que **el pedido siguiente**
      resuelva con el valor nuevo sin reiniciar; que un merchant que declara el campo no cambie; y la
      entrada del registro con actor, instante y versión.
- [x] T021 [US1] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: el panel puede ajustar el tratamiento de la plataforma. **No se entrega sin la fase 3.**

---

## Phase 3: User Story 2 — El congelamiento y las ventanas (P1)

**Goal**: con experimentos activos alcanzados, publicar exige motivo y reinicia la ventana de cada uno.

**Independent Test**: con un experimento activo, publicar sin motivo (rechazo) y con motivo (publica y
reinicia), contando alcanzados y no alcanzados en la misma corrida.

- [x] T022 [US2] `contracts/components/schemas/Experiment.yaml` — el registro de reinicio de ventana dice
      **de qué nivel** es la versión que lo causó (pasos 1 a 3). Con tres niveles publicando, «versión 3»
      no identifica nada (research R-04).
- [x] T023 [US2] `tests/unit/domain/experiment/experiment.test.ts` + `src/domain/experiment/experiment.ts`
      — `WindowRestart` gana el nivel; `windowRestarted` lo recibe. La prueba primero: un reinicio causado
      por defaults y otro por el merchant no se confunden.
- [x] T024 [US2] `tests/unit/application/configuration/reached-experiments.test.ts` — **antes del
      servicio**: qué experimentos alcanza un conjunto de hojas. Activos sí, en calibración no; un merchant
      que declara todas las hojas que cambiaron no queda alcanzado.
- [x] T025 [US2] `src/application/configuration/services/reached-experiments.service.ts` — el servicio que
      se queda con las tres piezas de experimentos (encontrar los activos, decidir cuáles alcanza, reiniciar
      sus ventanas) y que el caso de uso recibe como **una** dependencia (research R-04).
- [x] T026 [US2] `publish-treatment-defaults.use-case.ts` — el congelamiento: alcanzados y sin motivo ⇒
      rechazo; con motivo ⇒ publica y reinicia cada ventana alcanzada. Todo dentro de la unidad de trabajo
      (ADR-042): o queda con su entrada de auditoría, o no queda.
- [x] T027 [US2] `tests/integration/levels.test.ts` — los cinco escenarios de la historia, con dos
      merchants: uno que declara lo que cambia y otro que no, y un experimento activo en cada uno.
      **Quedaron en el archivo de US1** (`describe` propio) y no en `levels-frozen.test.ts`: las dos
      historias comparten el cuerpo que se publica y la ayuda que lo arma desde lo vigente, y partirlas
      obligaba a duplicar eso.
- [x] T028 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las historias 1 y 2 juntas son la feature mínima entregable.

---

## Phase 4: User Story 3 — Las reglas de la plataforma se publican por API (P2)

**Goal**: los trece valores del nivel de plataforma se publican por API y valen sin reiniciar.

**Independent Test**: publicar una versión que cambie una ventana y ver el comportamiento nuevo en el
pedido siguiente, en el mismo proceso.

- [x] T029 [US3] `contracts/` — la operación de publicar el nivel de plataforma (pasos 1 a 3), con el mismo
      cuerpo y las mismas respuestas que la de defaults.
- [x] T030 [US3] `src/application/configuration/ports/` — el **lector** del nivel vigente: un puerto que
      devuelve el nivel de plataforma cuando se lo pide, en memoria y sin I/O. Es una **interfaz con un
      método** y no una función: un componente que una prueba reemplaza entre casos se lee por un proxy sobre
      sus miembros, y una función no se puede proxiar así. Lo declara `release.ts` —el único lugar neutral
      que el mapa de contextos deja para algo que leen cinco módulos— y lo enlaza el módulo de configuración.
- [x] T031 [US3] `src/composition/modules/` — los **once sitios** que hoy reciben un valor pasan a recibir
      el lector y consultan al usar (research R-02): dos de ingesta (`dedupWindow`), acceso (ventana de
      firma, gracia de rotación), decisión (ventana de visitante, duración de sesión, tope de identidades),
      cuatro de administración (los dos topes de retención), el kernel (las dos tolerancias de reloj) y
      `bootstrap.ts` (`retryAfterSeconds`). El compilador encuentra cada uno al cambiar la forma del enlace.
- [x] T032 [US3] `src/application/configuration/use-cases/publish-platform-configuration.use-case.ts` — el
      caso de uso, igual al de defaults salvo el vocabulario contra el que valida.
- [x] T033 [US3] `src/interface-adapters/configuration/controllers/publish-platform-configuration.ts` y su
      cableado.
- [x] T034 [US3] `tests/integration/platform-level.test.ts` — **una prueba por valor** (SC-001): cada uno se
      cambia por la API y se observa su efecto sin reiniciar. Los tres que sólo se ven moviendo el reloj se
      observan por la lectura del nivel vigente, con el caso diciendo dónde se prueba el vencimiento. Y dos
      casos más que la tarea no previó: **el congelamiento del nivel 1 no es el del nivel 2**, porque cinco de
      sus campos deciden qué se cuenta y los otros cinco no.
- [x] T035 [US3] `tests/integration/sdk-config.test.ts` — lo que el SDK recibe **conserva su forma**
      (FR-017): cambia el valor y el número de versión que ya viajaba, y `additionalProperties: false` sigue
      valiendo.
- [x] T036 [US3] `npm run test:mutation` acotado al diff de la historia. **Se corre una vez al cierre**
      (T044) y no por historia: la corrida paga cinco minutos de arranque antes de juzgar un mutante, y las
      historias 3 y 4 tocan los mismos archivos.

**Checkpoint**: «todo se configura desde el panel» es cierto de los 22 valores.

---

## Phase 5: User Story 4 — El historial de cada nivel (P3)

**Goal**: un operador ve las versiones de un nivel y puede leer una.

- [x] T037 [US4] `contracts/` — las cuatro operaciones de lectura (listar versiones y leer una, por nivel),
      con la paginación por cursor que ya usa el registro de administración.
- [x] T038 [US4] Los casos de uso, controllers y cableado de las cuatro; la lectura de una versión devuelve
      el contenido **tal como se publicó**.
- [x] T039 [US4] `tests/integration/levels-history.test.ts` — más nueva primero, paginada, con actor y
      motivo; y una versión concreta inmutable.

---

## Phase 6: Lo que queda dicho

- [x] T040 `docs/adr/031-merchants-operados-y-tres-niveles.md` — **la enmienda**, con la comparación
      escrita: el punto 3 decía «nunca modificables en caliente porque el radio es multitenant», y nunca
      comparó contra el deploy, que hace el mismo daño sin rastro y sin reiniciar ninguna ventana. La
      enmienda registra la tabla, el trato nuevo (motivo obligatorio, alcanzados por hoja, ventanas
      reiniciadas) y la idea que la feature agrega: **un nivel se lee, no se hornea al arrancar**.
- [x] T041 [P] `docs/deudas.md` — **lo contrario de lo que esta tarea decía**: la feature no cerró ninguna
      mitad de **D-29** y la agrandó una entrada. La importación de los dos niveles es una acción
      administrativa auditada más, y tiene el mismo defecto: no dice si importó o no había nada que
      importar, porque decirlo es cambiar `AdminResult`, que es contrato publicado. La revisión fechada lo
      registra con las cuatro entradas que ahora deja cada arranque, y refuerza la salida 1.
- [x] T042 [P] Los READMEs que el cambio toca, con su inventario (ADR-032): `migrations/` por la migración
      nueva (en la fase 1) y `config/` porque los dos archivos cambian de rol —de fuente a semilla—.
      `tests/` no: su inventario es por directorio y ninguno es nuevo.
- [x] T043 Correr el **quickstart** de punta a punta, los seis pasos, y **anotar lo que aparezca**. Lo
      anotado, en su sección fechada: la regla entera funciona contra el servidor real (seis publicaciones,
      dos congelamientos, dos ventanas reiniciadas, cada una diciendo de qué nivel vino la versión), el tope
      de retención se vio en el acto y lo vigente sobrevivió el apagado. Tres cosas que ningún gate veía:
      **`rm -rf data` no borra nada si un servidor de otra sesión tiene el archivo abierto** —y el paso corre
      contra el almacén de otro día sin avisar—, **una publicación lleva el contenido entero** así que el
      panel tiene que mandar lo que leyó, y el registro de administración quedó con **cuatro** entradas del
      sistema por arranque, que es D-29 una entrada más grande.
- [x] T044 La cadena de cierre: `contract:check` (36 built, sin cambios incompatibles), `build`, `test:all`
      (1876 en 208 archivos), `test:durability` (189), `test:mutation` (**every mutant died**),
      `test:contract` y `release-check`. Dos cosas que la cadena encontró y no estaban previstas:
      **tres supervivientes de mutación** —dos de ellos la línea que hace que la semilla sea semilla, que
      nadie probaba— y **un `500` en `GET /v1/admin/log`** que el fuzzer del contrato sacó: el registro
      admitía un motivo de 500 caracteres y las tres publicaciones aceptan 512, así que un motivo largo se
      aceptaba al escribir y rompía la lectura. El defecto es más viejo que esta feature; lo que la feature
      hizo fue darle dos puertas más por donde entrar.

---

## Dependencies & Execution Order

### Entre fases

- **La fase 1 bloquea todo**: sin la entidad, el cálculo de hojas y el almacén no hay nada que publicar.
- **US1 y US2 son las dos P1 y ninguna se entrega sola**: la primera le da al panel el poder de cambiar el
  tratamiento, la segunda es lo que hace que ese poder no arruine una medición en silencio.
- **US3 (fase 4) depende de la fase 1 y no de US1/US2**: es el otro nivel por el mismo camino. Va después
  porque cuesta más —los once sitios— y porque su parte de medición reusa el servicio de US2.
- **US4 (fase 5) es independiente** de las otras tres salvo de la fase 1.
- **La fase 6 va al final**, porque una enmienda que describe lo que todavía no se corrió es una promesa.

### Dentro de cada fase

**Las pruebas primero donde hay una regla**: T002→T003, T004→T005, T023 (la prueba con su cambio),
T024→T025. Que T004 falle antes de que el cálculo exista es parte de la verificación.

**El orden del contrato es rígido**: mapa (T001) → contrato → `contract:check` → tipos → código → gates. Un
esquema cambiado sin pasar por el mapa lo rechaza `check:api-map`.

Marcadas `[P]`: T019, T041, T042. Tocan archivos distintos y ninguna espera a otra.

### Lo que este orden evita

- **Calcular lo alcanzado por campo**: T004 se escribe antes que T005 y su caso central es el objeto
  declarado a medias, que es el único que distingue las dos lecturas.
- **Olvidar uno de los once sitios** del nivel de plataforma: T031 cambia la forma del enlace, así que el
  compilador los nombra todos; T034 pide una prueba por valor.
- **Que el contrato y el mapa se separen**: T001 es la primera tarea de la feature y no la última.
- **Entregar US1 sin US2**: el checkpoint de la fase 2 lo dice explícitamente.
