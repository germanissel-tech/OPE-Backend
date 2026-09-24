---
description: "Task list template for feature implementation"
---

# Tasks: El núcleo se lee siempre; el resto carga cuando hace falta

**Input**: Design documents from `/specs/025-instrucciones-por-ruta/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/policy.md](./contracts/policy.md)

**Tests**: sí. El gate tiene que fallar con el núcleo sin partir **antes** de partirlo, o no está
verificando el límite (SC-001, SC-004, SC-005).

**Organization**: por historia, **con US2 antes que US1** aunque las dos sean P1. Lo dice el plan: el
gate se extiende primero, así el primer archivo que se cree ya nace verificado y una regla sin
acotar no puede colarse mientras se trabaja.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3
- Toda tarea nombra su archivo

---

## Phase 1: Setup — la condición de arranque y la cuenta de partida

- [ ] T001 `claude --version` dice **2.1.198 o superior** (verificado al abrir: 2.1.280). **Si bajó,
      parar**: sin reglas acotadas esta feature no tiene mecanismo y hay que replantearla.
- [ ] T002 Congelar la cuenta de partida: `wc -l CLAUDE.md` da **573**, y anotar el desglose por
      sección. Es contra esto que se mide todo, y si alguien lo tocó antes hay que rehacer el
      reparto del plan con el número nuevo.

---

## Phase 2: User Story 2 - El gate mira los siete archivos (Priority: P1) 🎯 Va primero

**Goal**: el gate deja de mirar un archivo y mira todos, y verifica el límite del núcleo.

**Independent Test**: correrlo con la política ya extendida y el núcleo **todavía sin partir**:
tiene que reportar que el núcleo tiene 573 líneas contra un límite de 200.

### La política y la biblioteca

- [ ] T003 `scripts/instructions-policy.json` — pasa de declarar secciones sueltas a declarar
      **archivos** (`files[]`), cada uno con `role` (`core` o `rule`), sus secciones y, los `rule`,
      su `paths`. Gana `coreMaxLines: 200`. **El límite va en la política, no en el script**: es el
      valor que gobierna el comportamiento (constitución XI), y su fuente es la documentación
      oficial.
- [ ] T004 `scripts/instructions-lib.mjs` — la envoltura por archivo, más las tres verificaciones
      nuevas: el núcleo no supera `coreMaxLines`; todo `rule` declara `paths` **o** su
      `unscopedReason`; y el patrón de un `rule` alcanza al menos un archivo del repositorio. Con
      `checkJs`: toda función exportada con su firma (ADR-012).
- [ ] T005 `scripts/check-instructions.mjs` — recorre los archivos de la política, reporta con
      nombre de archivo además de línea, y su resumen gana el recuento de archivos.

### Las otras tres verificaciones

- [ ] T006 [P] [US2] `scripts/check-identifiers.mjs` — las reglas entran a su lista de documentos,
      junto al núcleo que ya recibió en la feature 024.
- [ ] T007 [P] [US2] `scripts/check-adrs.mjs` y `scripts/check-markers.mjs` — lo mismo, una línea en
      cada uno: los dos ya arman una lista que incluye `CLAUDE.md`.

### La prueba de que el límite se verifica

- [ ] T008 [US2] **Correr acá, con el núcleo todavía sin partir**: `npm run check:instructions`.
      Tiene que reportar que el núcleo tiene **573** líneas contra un límite de **200**. Si pasa en
      verde, el límite no se está verificando y todo lo que sigue sería teatro.
- [ ] T009 [US2] `tests/docs/instructions.test.ts` — los casos nuevos: un núcleo que supera el
      límite falla; un `rule` sin `paths` y sin motivo falla; un `rule` cuyo patrón no alcanza nada
      falla; y los casos de la 024 siguen pasando ahora que la política declara archivos.

**Checkpoint**: el gate ya sabe medir lo que la feature va a cambiar. Recién ahora se parte.

---

## Phase 3: User Story 1 - El núcleo entra en una pasada (Priority: P1)

**Goal**: las seis secciones acotadas salen del núcleo y la tabla de comandos se fusiona.

**Independent Test**: contar el núcleo (< 200) y comprobar que cada sección que se fue está completa
en su archivo.

**Cómo se hace cada una**, y el orden no es negociable: **primero se escribe la regla con su
acotación, se comprueba que el gate la ve, y recién entonces se reemplaza la sección por su
invariante**. En commits separados, para que el diff muestre que nada se perdió.

- [ ] T010 [US1] `.claude/rules/auditoria.md` (12 líneas) → se acota a las evaluaciones y las
      skills. **La más chica primero**: sirve para calibrar el tamaño del puntero antes de mover las
      grandes, y para ver el mecanismo funcionando de punta a punta.
- [ ] T011 [P] [US1] `.claude/rules/entidad.md` (48) → se acota al dominio. Invariante que queda:
      clase si hay reglas, tipo si no; las reglas viven con su dueño.
- [ ] T012 [P] [US1] `.claude/rules/gates-de-calidad.md` (51) → al código fuente y las pruebas.
      Invariante: un cambio no entra si un mutante de sus propias líneas sobrevive.
- [ ] T013 [P] [US1] `.claude/rules/caso-de-uso.md` (59) → a la capa de aplicación. **Es el caso que
      más se acercó a no moverse** (FR-004: un agente creando el primer archivo de la capa todavía
      no leyó ninguno). Su invariante tiene que ser la que `lint` rechaza en el acto: una clase con
      `execute`, dependencias interfaces, y un error de negocio que se devuelve y nunca se lanza.
- [ ] T014 [P] [US1] `.claude/rules/anillos-y-modulos.md` (85) → al código fuente. Invariante: la
      dependencia va sólo hacia adentro; un módulo importa de otro sólo por su índice y sólo si el
      mapa lo permite.
- [ ] T015 [P] [US1] `.claude/rules/contrato.md` (92) → al contrato. **La más grande.** Invariante:
      el contrato es la única fuente de verdad de toda la superficie HTTP.
- [ ] T016 [US1] **La fusión, que no es una mudanza**: lo que le falte a `scripts/README.md` de la
      tabla de comandos se le agrega **antes** de borrarla (26 de los 30 ya están). El núcleo
      conserva los siete del lazo normal; los cuatro que no son scripts de `scripts/` —`build`,
      `arch`, `format`, `check:mutation-report`— **no se pierden**: se ubican explícitamente.
- [ ] T017 [US1] Verificar que **nada se perdió**, por sección y no por total: un total que cierra
      puede esconder una sección que se fue entera. Enumerar lo consolidado a propósito.
- [ ] T018 [US1] `wc -l CLAUDE.md` — **bajo 200**, y el gate en verde. Registrar la cifra contra la
      serie: 360 → 675 → 573 → …

**Checkpoint**: el núcleo entra en una pasada y las seis reglas llegan cuando hacen falta.

---

## Phase 4: User Story 3 - Quien agrega una instrucción sabe dónde ponerla (Priority: P2)

- [ ] T019 [US3] `CLAUDE.md` — los tres destinos escritos con la pregunta que los separa
      («¿hace falta en **toda** sesión?» y, si no, «¿es un procedimiento de varios pasos?») y un
      ejemplo real de cada uno. Va en la sección de documentación viva, junto al criterio de la 024.
- [ ] T020 [US3] El criterio de admisión de la feature 024 gana la pregunta que le falta: ser
      normativo no alcanza, tiene que hacer falta en toda sesión. Es la enmienda que la fuente
      oficial pide y la que evita que el núcleo vuelva a crecer por inercia.
- [ ] T021 [US3] Verificar el criterio contra las catorce secciones de hoy: tiene que dar el mismo
      reparto que esta feature hizo. Si da otro, el criterio está mal escrito o el reparto estaba
      mal, y hay que decir cuál.

---

## Phase 5: Cierre y documentación

- [ ] T022 **La verificación que ningún comando decide** (FR-004, del quickstart §6): por cada una
      de las seis, leer **sólo** lo que quedó en el núcleo y preguntarse si alcanza para no
      equivocarse antes de que la regla llegue. Si alguna no alcanza, **esa sección vuelve**, con el
      motivo escrito. Mirar con más cuidado la del caso de uso.
- [ ] T023 `docs/adr/032-metodo-portable-y-perfil-por-proyecto.md` — la enmienda: el reparto entre
      los tres destinos, el umbral y **la cita de la documentación oficial como su fuente**, para
      que las doscientas líneas se lean como el número que la herramienta publica y no como una
      preferencia. Registrar también las dos correcciones que el plan le hizo a la spec.
- [ ] T024 `specs/025-instrucciones-por-ruta/quickstart.md` — correr el quickstart entero y dejar su
      tabla de estado fechada, con el antes y el después y lo consolidado enumerado.
- [ ] T025 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `test:contract`, `release-check`.
- [ ] T026 **La feature se aplica a sí misma**: el núcleo, ya partido, pasa el gate que él mismo
      enuncia —incluido su propio límite— y las secciones que quedan están clasificadas en la
      política. Si no lo cumple, no está terminada.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: T001 es una **condición de arranque**; T002 congela el número contra el que se
  mide todo.
- **US2 (F2)**: va **primero**, aunque US1 sea igual de P1. T003 → T004 → T005 en orden; T006 y T007
  son independientes. **T008 antes de tocar `CLAUDE.md`**: es la prueba de que el límite se verifica.
- **US1 (F3)**: después de US2. T010 primero (calibra); T011 a T015 son independientes entre sí, cada
  una en dos tiempos. T016 es aparte porque es una fusión, no una mudanza. T017 y T018 al final.
- **US3 (F4)**: después de US1, porque necesita la partición hecha para dar ejemplos ciertos.
- **F5**: al final. T022 puede devolver una sección al núcleo, así que va **antes** de T023.

### Paralelismo real

- T006 y T007: tres scripts distintos.
- T011 a T015: cinco reglas, cada una con su archivo y su sección. Independientes.
- No hay paralelismo en F2 fuera de T006/T007: la política y la biblioteca son dos archivos
  encadenados.

---

## Implementation Strategy

### No hay MVP parcial

US1 y US2 son las dos P1 y **van juntas**: partir sin extender el gate deshace la feature 024 —siete
archivos nuevos sin verificación— y extender el gate sin partir no baja una línea. US3 sí es
separable, y sin ella el núcleo vuelve a crecer por inercia, pero más tarde.

### Commits

Uno por fase, más **uno por regla en dos tiempos** (se escribe la regla, después se vacía la
sección). La fusión de la tabla de comandos va en el suyo, porque es la única que consolida.

---

## Notes

- **T008 es la tarea que decide si el gate sirve.** Con el núcleo en 573 y un límite de 200, tiene
  que fallar. Si pasa en verde, el límite no se está verificando.
- **T022 no la decide ningún comando, y es la que protege al agente.** El gate mide el largo y la
  existencia; que la invariante **alcance** lo dice quien la lee. Es el único lugar de esta feature
  donde el juicio no se puede automatizar, y por eso está escrito como tarea y no como esperanza.
- **La revisión de que nada se perdió es por sección, no por total** (T017): un total que cierra
  puede esconder una sección que se fue entera.
- **`.claude/` está excluido de la política de inventarios de README** (ADR-032), así que las reglas
  nuevas **no** necesitan un `README.md` ahí. Agregarlo sería inventar trabajo.
- **Las reglas son Markdown en castellano**, como el resto de la documentación (ADR-015);
  `check:language` no mira `.md`, así que no hay nada que excluir.
- El umbral es un techo, no una meta a superar: bajar de 200 es el éxito, perseguir menos premia
  borrar cosas útiles.
