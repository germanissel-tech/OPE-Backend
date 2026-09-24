---
description: "Task list template for feature implementation"
---

# Tasks: Las instrucciones tienen criterio de admisión y gate

**Input**: Design documents from `/specs/024-instrucciones-verificadas/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/policy.md](./contracts/policy.md)

**Tests**: sí. La prueba del gate es la feature: si no falla con lo que tiene que fallar, el gate no
sirve. La spec las pide (SC-001, SC-003, SC-005).

**Organization**: por historia. La política y su biblioteca son fundacionales porque las tres las
usan.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3
- Toda tarea nombra su archivo

---

## Phase 1: Setup — congelar la evidencia

**Purpose**: los dos hallazgos son el fixture de toda la feature. Si alguien los arregla antes, la
historia 1 pierde su prueba.

- [x] T001 Confirmar la base: `git log --oneline main..HEAD` y anotar si las ramas 022, 023 y 024
      siguen encadenadas o si el dueño ya mergeó.
- [x] T002 **No arreglar todavía.** Confirmar que los dos hallazgos siguen en pie:
      `grep -n "merchant/policies/signature-window" CLAUDE.md` da la línea, y
      `grep -c "check:mutation-report" CLAUDE.md` da cero. **Si alguno ya está arreglado, parar**: la
      historia 1 necesita fallar antes de pasar, y hay que reponer el caso en un fixture.

---

## Phase 2: Foundational — la política y su biblioteca

**Purpose**: dónde se declara lo que el gate espera. Las tres historias la usan.

**⚠️ CRITICAL**: bloquea US1 y US2.

- [x] T003 `scripts/instructions-policy.json` — el archivo declarado, con la forma de
      `contracts/policy.md`: raíces implícitas, formas no-ruta, secciones y excepciones. Los
      encabezados son en castellano porque son los del documento; **los motivos en inglés**, que es
      configuración (ADR-015). Arranca con las raíces y las formas medidas; las secciones llegan en
      US2 y las excepciones se llenan cuando el gate las pida.
- [x] T004 `scripts/instructions-lib.mjs` — funciones puras sobre texto, como
      `scripts/readme-inventory-lib.mjs`: extraer las citas con su línea, clasificarlas en las tres
      formas, resolver una ruta contra las raíces declaradas, comparar comandos en los dos sentidos,
      comparar secciones contra la política en los dos sentidos. Con `checkJs`: toda función
      exportada con su firma en JSDoc (ADR-012).
- [x] T005 `scripts/check-language.mjs` — agregar `scripts/instructions-policy.json` a
      `ALWAYS_EXCLUDED`, con su comentario, como ya está `readme-inventory-policy.json`. **Sin esto
      `check:language` falla** en cuanto la política nombre un encabezado en castellano.

---

## Phase 3: User Story 1 - Una instrucción que dejó de ser cierta falla el build (Priority: P1) 🎯 MVP

**Goal**: el gate verifica las tres formas de referencia y encuentra lo que hoy nadie ve.

**Independent Test**: correrlo **contra el documento sin corregir**: exactamente dos problemas, y
ninguna de las diecinueve que se escriben con barras y no son rutas.

### El gate

- [x] T006 [US1] `scripts/check-instructions.mjs` — lee la política, recorre `CLAUDE.md`, reporta
      una línea por problema con archivo y línea, y siempre una línea de resumen (en verde también:
      un gate que sólo habla cuando falla no deja ver que sigue mirando). Sale 1 con problemas.
- [x] T007 [US1] `package.json` — el script `check:instructions`, encadenado en `contract:check`
      junto a los otros seis `check:*` de gobernanza. **No** en el proyecto `tools`: medido en
      research R-01, ni `CLAUDE.md` ni `src/` disparan `tools`, así que allá no habría corrido en el
      commit que rompió esto.
- [x] T008 [US1] `scripts/check-identifiers.mjs` — una línea: `CLAUDE.md` entra a `documents`, como
      ya está en `check-adrs.mjs` y `check-markers.mjs`. **No tocar `PROSE_CHARS`**: descarta las
      rutas por diseño y está bien; las rutas se resuelven contra el disco, no se buscan en un texto.
- [x] T009 [US1] `scripts/identifiers-allowlist.json` — `multipleOf` con su motivo (palabra de JSON
      Schema, no un identificador del sistema). Es el único que aparece al extender el alcance.

### La prueba de que sirve

- [x] T010 [US1] **Correr acá, antes de arreglar nada**: `npm run check:instructions`. Tiene que
      reportar **exactamente dos** cosas: la ruta de la ventana de firma en su módulo viejo y
      `check:mutation-report` sin documentar. **Si reporta una tercera, mirarla antes de seguir**: o
      es un hallazgo más o es un falso positivo, y las dos cosas cambian el trabajo.
- [x] T011 [US1] Verificar **cero falsos positivos** sobre las diecinueve no-rutas (`errors.ts`,
      `services/`, `ports/`, `index.ts`, `use-cases/`, `controllers/`, `ids.ts`, las siete `ope/*`,
      `origin/main`, `merchantId/orderId`, `HANDOFF.md`, `research.md`). Un gate ingenuo reporta
      setenta y cinco: está medido, y es el criterio que separa este gate de uno inservible.
- [x] T012 [US1] `tests/docs/instructions.test.ts` — la prueba, proyecto `tools`, con fixtures en
      `tests/docs/fixtures/`: una ruta que no existe se reporta; una ruta abreviada con una raíz
      declarada no; cada una de las tres formas no-ruta no; un comando sin documentar y uno
      documentado que no existe se reportan; una excepción sin motivo falla.

### El arreglo

- [x] T013 [US1] `CLAUDE.md` — corregir la ruta de la ventana de firma (vive en el módulo `access`
      desde la feature 020) y agregar la fila de `check:mutation-report` a la tabla de comandos.
- [x] T014 [US1] **El caso circular**: el gate nuevo agregó `check:instructions` a `package.json`, y
      el gate exige que todo comando esté documentado, así que **se exige a sí mismo**. Agregar su
      fila. Es la primera vez que la feature se aplica a sí misma y conviene notarlo en el commit.
- [x] T015 [US1] `npm run check:instructions` en verde, y `npm run contract:check` también.

**Checkpoint**: US1 entregable sola. Una referencia vieja ya no sobrevive un commit.

---

## Phase 4: User Story 2 - El documento dice qué entra y qué no (Priority: P2)

**Goal**: el criterio escrito, cada sección clasificada, y abrir una sección obliga a decidir.

**Independent Test**: agregar una sección sin declararla y ver que falla; y comprobar que ninguna de
las catorce quedó sin clasificar ni mixta sin motivo.

- [x] T016 [US2] `scripts/instructions-policy.json` — las catorce secciones con su clase, según la
      tabla de research R-05. **Tres son `mixed`** (Anillos y módulos, Gates de calidad,
      Convenciones) y las tres **llevan motivo**: una mixta sin motivo es lo mismo que no
      clasificarla.
- [x] T017 [US2] `scripts/instructions-lib.mjs` y `scripts/check-instructions.mjs` — la verificación
      en los dos sentidos: una sección del documento sin entrada falla, y una entrada para una
      sección que no existe también. Es la simetría de `checkPolicies` y es la mitad que se olvida.
- [x] T018 [US2] `CLAUDE.md` — el criterio de admisión escrito, en la sección de documentación viva:
      qué es normativo, qué es descriptivo, qué hace una sección mixta, y **la frontera de lo que el
      gate verifica** (que lo nombrado exista, no que lo escrito sea cierto). Sin esa última frase,
      un gate en verde se lee como más de lo que es.
- [x] T019 [P] [US2] `tests/docs/instructions.test.ts` — sus fixtures: una sección sin política
      falla, una política sin sección falla, una mixta sin motivo falla, una clase que no es ninguna
      de las tres falla.
- [x] T020 [US2] Verificar con un comando que las catorce están clasificadas y que hay **cero mixtas
      sin motivo** (el del quickstart).

**Checkpoint**: abrir una sección ya no se puede hacer en silencio.

---

## Phase 5: User Story 3 - Lo descriptivo vive en su hogar (Priority: P3)

**Goal**: los diez bloques de «Notas operativas del contrato» van a su ADR; acá queda el puntero.

**Independent Test**: por bloque — lo que decía está en el destino, y desde las instrucciones se
llega en un paso.

**Cómo se hace cada bloque**, y el orden no es negociable: **primero se agrega al ADR, después se
borra de acá**, en **commits separados**, para que el diff muestre que nada se perdió.

- [x] T021 [P] [US3] Ledger (4 líneas) → ADR-021/023. El más chico: sirve para calibrar el tamaño
      del puntero que queda antes de mover los grandes.
- [x] T022 [P] [US3] Puerto de plataforma (9) → ADR-025.
- [x] T023 [P] [US3] Verdad de producto (11) → ADR-025.
- [x] T024 [P] [US3] Firma de plataforma (13) → ADR-029.
- [x] T025 [P] [US3] Consumidores (19) → ADR-020.
- [x] T026 [P] [US3] Outcomes y cadena de evidencia (21) → ADR-028.
- [x] T027 [P] [US3] Asignación y experimentos (23) → ADR-022/024/031.
- [x] T028 [P] [US3] Merchants operados (28) → ADR-031.
- [x] T029 [P] [US3] Plano de decisión (34) → ADR-026/027. El más grande.
- [x] T030 [US3] **Configuración del SDK (33) — va último y puede no moverse.** Cita la feature 017
      y el documento de arquitectura, **no un ADR**: no tiene destino. Si al llegar no hay uno, **se
      queda**, con el motivo escrito en el documento. Inventar un ADR para poder mudar sería el
      trámite que esta feature debería estar eliminando.
- [x] T031 [US3] Después de cada bloque, `npm run check:instructions` y `npm run check:adrs`: la
      mudanza mueve identificadores de un archivo a otro y los dos los verifican.

**Checkpoint**: el documento bajó de líneas por primera vez.

---

## Phase 6: Cierre y documentación

- [x] T032 `scripts/README.md` — **tres filas nuevas** en el inventario, una por archivo agregado a
      `scripts/`. Sin ellas `tests/docs/readmes.test.ts` falla; es ADR-032 aplicándose a esta
      feature, que es exactamente de lo que la feature trata.
- [x] T033 `docs/adr/032-metodo-portable-y-perfil-por-proyecto.md` — la enmienda: el patrón de
      política declarada más prueba que la verifica se extiende de los inventarios de directorio a
      las instrucciones de los agentes; por qué el gate vive en `contract:check` y no en `tools` (la
      medición de los disparadores); y la tercera clase `mixed` con su motivo obligatorio.
- [x] T034 `specs/024-instrucciones-verificadas/quickstart.md` — correr el quickstart entero y dejar
      su tabla de estado fechada, con el antes y el después de las líneas y qué quedó sin mudar.
- [x] T035 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `test:contract`, `release-check`.
- [x] T036 **La feature se aplica a sí misma, y es el último criterio**: `CLAUDE.md`, ya editado,
      pasa el gate que él mismo enuncia, y la sección que escribe el criterio está clasificada por
      la política. Si no lo cumple, no está terminada.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: T002 es una **condición de arranque**. Sin los dos hallazgos en pie, la historia 1
  no se puede demostrar.
- **F2 (política y biblioteca)**: bloquea US1 y US2.
- **US1 (F3)**: T006 → T007 → T010 en orden. **T010 antes de T013**: el gate se corre contra el
  documento sin corregir o no prueba nada. T008 y T009 son independientes del resto de US1.
- **US2 (F4)**: después de F2. No depende de US1 salvo por compartir el script.
- **US3 (F5)**: después de US1, porque el gate verifica cada mudanza. Los bloques son independientes
  entre sí: se pueden hacer en cualquier orden y de a uno, salvo T030 que va último.
- **F6**: al final. T033 necesita el diseño implementado; T036 necesita todo lo anterior.

### Paralelismo real

- T021 a T029: nueve bloques, cada uno con su ADR destino. Independientes.
- T019 contra el resto de US2.
- No hay paralelismo dentro de US1: el gate es un archivo.

---

## Implementation Strategy

### MVP: US1 sola

F1 → F2 → F3 y parar. Con eso una referencia vieja ya no sobrevive un commit, que es el agujero
demostrado. US2 frena el crecimiento y US3 cobra el beneficio, pero ninguna de las dos es urgente del
mismo modo.

### Commits

Uno por fase, más **uno por bloque mudado en dos tiempos** (agregar al ADR, después borrar). El
detalle circular de T014 va en su propio mensaje: es la primera vez que la regla se aplica a quien la
escribió.

---

## Notes

- **T010 es la tarea que decide si la feature sirve.** Un gate escrito después del arreglo no prueba
  nada. Si en T010 el gate no encuentra los dos hallazgos, está mal escrito; si encuentra veinte,
  está midiendo lo que no debe.
- **Cero falsos positivos no es una aspiración, es el criterio.** Un gate que reporta setenta y cinco
  cosas se apaga a la semana, y entonces el documento vuelve a depender de la disciplina — que es de
  lo que la feature nos quiere sacar.
- **La mudanza se juzga por si el puntero alcanza, no por cuántas líneas ahorra.** Un agente que no
  puede encontrar una decisión en un paso es peor que un documento largo. Un bloque que no se puede
  reemplazar por un puntero se queda, con su motivo.
- **Ningún número de líneas es la meta.** La spec lo dejó fuera de alcance: perseguir un número
  premia borrar cosas útiles. Que baje una vez es la señal de que el criterio se aplicó, no el
  objetivo.
- El gate corre sobre `CLAUDE.md`. Las instrucciones de `.claude/skills/` quedan fuera por la spec y
  ya tienen su propio aislamiento probado.
