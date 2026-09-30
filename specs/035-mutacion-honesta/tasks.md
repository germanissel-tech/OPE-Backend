---
description: "Task list for feature 035 — el gate de mutación no informa números de otra corrida"
---

# Tasks: El gate de mutación no informa números de otra corrida

**Input**: `specs/035-mutacion-honesta/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Tests**: sí, y **primero**. El repositorio ya prueba este script por funciones exportadas
(`tests/governance/mutation-diff.test.ts`), así que la regla nueva se fija ahí antes de existir.

**Organización**: una fase por historia. La fase 1 es la regla, que es lo que las tres comparten.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: La regla (bloquea las tres historias)

**Goal**: una función pura que, dados el código de salida de la corrida, el instante en que arrancó y la
fecha del reporte, responda **por qué no hay veredicto** o nada.

**Independent Test**: la prueba de gobernanza la llama con valores y no lanza ningún proceso.

- [x] T001 `tests/governance/mutation-diff.test.ts` — **antes de la regla**, los cuatro casos de la tabla de
      `data-model.md`: código distinto de 0 (con reporte en disco, para que se vea que **no lo mira**),
      código 0 sin reporte, código 0 con reporte **anterior** al arranque, y código 0 con reporte de esta
      corrida. Más el borde de **FR-005**: `mtime` **igual** al arranque cuenta como de esta corrida.
- [x] T002 `scripts/mutation-diff.mjs` — la función exportada, con su JSDoc (`checkJs` lo exige en toda
      función exportada) y el orden de preguntas de la tabla: con código distinto de 0 **no se consulta el
      archivo** (FR-003). El mensaje de «no escribió reporte» es el que ya existe hoy, movido acá.
- [x] T003 Correr `npx vitest run --project fast tests/governance/mutation-diff.test.ts`: los casos nuevos
      pasan y **ninguno de los existentes cambia de expectativa** (SC-003).

**Checkpoint**: la regla está fijada y no hay cableado todavía; el gate se comporta exactamente como antes.

---

## Phase 2: User Story 1 — Una corrida que no terminó no informa cifras (P1)

**Goal**: con un código de salida distinto de 0, el gate dice que la corrida no terminó y no informa
ninguna cifra.

**Independent Test**: provocar una corrida caída con un reporte anterior en disco y leer la última línea.

- [x] T004 [US1] `scripts/mutation-diff.mjs` — en el camino bloqueante: tomar el instante **antes** de
      lanzar Stryker, preguntar la regla con el código de salida, y si hay motivo emitir
      `status: "fail"` con `findings: []` y el motivo en `error`, **sin leer el reporte**. El veredicto no
      cambia: lo que hoy falla sigue fallando (FR-002).
- [x] T005 [US1] Provocar una corrida caída **de verdad** y leer la salida: un tiempo de espera imposible
      para la corrida inicial, con un reporte de una corrida anterior en disco. Tiene que verse el motivo
      como **última línea** y cero líneas de supervivientes (SC-001, SC-002). Es el caso exacto que la
      feature 034 vio dos veces.
- [x] T006 [US1] El camino feliz, comparado: correr el gate con un cambio real en `src/` y comprobar que la
      salida es **idéntica** a la de hoy, en las dos formas —la de una persona y `--json`— (FR-007, SC-004).

**Checkpoint**: el defecto de D-31 está cerrado en su caso conocido, y es entregable solo.

---

## Phase 3: User Story 2 — Un reporte que no es de esta corrida se reconoce (P2)

**Goal**: el gate no informa números de un reporte anterior **aunque la corrida diga que terminó bien**.

**Independent Test**: la regla ya lo fija (T001); lo que esta fase agrega es que el camino bloqueante le
pase la fecha real del archivo.

- [x] T007 [US2] `scripts/mutation-diff.mjs` — mirar la fecha de modificación del reporte y pasársela a la
      regla. Con la fecha ausente se conserva el mensaje de hoy; con una fecha anterior al arranque, el
      gate falla diciendo que el reporte es de otra corrida (FR-004).
      **Quedó hecha con T004 y no como paso aparte**, porque la regla recibe el código y la fecha en la
      misma llamada: separarlas habría significado pasar un valor falso en la fase 2 para respetar la
      división de tareas. El helper `runFor` se queda con las dos mitades del tiempo —el instante antes de
      lanzar, la fecha después— que es lo que hace imposible escribir el orden al revés.
- [x] T008 [US2] Verificar con un archivo de verdad: **tocar** la fecha del reporte a un instante anterior y
      comprobar que el camino que la consulta la ve como vieja. Lo que **no** se puede forzar sin correr
      Stryker es un código 0 con reporte viejo; ese caso lo fija la prueba de T001, y acá se dice para que
      nadie lo busque en la corrida real.

**Checkpoint**: la clase entera del defecto está cerrada, no sólo el caso que apareció.

---

## Phase 4: User Story 3 — La barrida informativa tampoco miente (P3)

**Goal**: el modo `--all` recibe el mismo trato y deja de salir con éxito cuando la corrida no terminó.

**Independent Test**: provocar una corrida caída en modo informativo y ver que el resultado no es un éxito.

- [x] T009 [US3] `scripts/mutation-diff.mjs` — en el modo informativo: **capturar** el código de salida, que
      hoy se descarta, y pasar por la misma regla. Sus supervivientes siguen siendo informativos; la
      ausencia de corrida no lo es (FR-006).
- [x] T010 [US3] Comprobar que `--check-report` **no** cambió: `npm run check:mutation-report` pasa. Su
      trabajo es mirar el último reporte, así que la frescura no le aplica (research R-01) — y es la parte
      del diseño más fácil de romper sin darse cuenta, porque su fallo aparecería recién en
      `release-check`.

**Checkpoint**: las tres historias funcionan y ningún modo informa cifras que no produjo.

---

## Phase 5: Lo que queda dicho

- [ ] T011 `docs/adr/016-gates-de-calidad.md` — una **enmienda corta**: una corrida que no termina no tiene
      veredicto, y el gate lo dice en vez de informar el reporte anterior. Va en ADR-016 porque es la
      política del gate de mutación y es donde alguien la busca; no amerita un ADR nuevo, porque no decide
      nada transversal que no estuviera ya decidido ahí.
- [ ] T012 [P] `.claude/rules/gates-de-calidad.md` — la línea que impide volver a equivocarse: **si la
      corrida no termina, no hay cifras**, y el reporte en disco es de otra corrida. La regla llega cuando
      alguien trabaja sobre los gates, que es exactamente quien necesita saberlo.
- [ ] T013 [P] `docs/deudas.md` — **D-31 cerrada**, con el commit, y la fila a `implementada`.
- [ ] T014 Correr el **quickstart** de punta a punta, los cinco pasos, y anotar lo que aparezca. En las
      cinco features anteriores encontró algo que ningún gate veía.
- [ ] T015 La cadena de cierre: `format:check`, `quality`, `typecheck`, `test:all` y `release-check`
      (`contract:check` incluido ahí). La prueba de este cambio corre en **`npm test`**, el proyecto `fast`,
      porque es donde vive `tests/governance/mutation-diff.test.ts` — el plan dijo `tools` al principio y era
      falso.
      **Y una cosa que hay que decir en vez de fingir**: `test:mutation` sobre el diff de esta feature
      **se saltea**, porque no hay nada de `src/` que mutilar — el gate no puede juzgar su propio cambio.
      Lo que lo juzga es el proyecto `fast` y el quickstart, y el hecho de que el gate siga funcionando
      sobre el diff de la próxima feature.

---

## Dependencies & Execution Order

### Entre fases

- **La fase 1 bloquea todo**: las tres historias son cableado de la misma regla.
- **US1 (fase 2) es la feature mínima entregable**: cierra el caso de D-31 que se vio dos veces.
- **US2 (fase 3)** es una línea más en el mismo camino y cierra la clase; depende de la fase 1, no de US1.
- **US3 (fase 4)** es independiente de las dos anteriores: otro modo, la misma regla.
- **La fase 5 va al final**, porque una enmienda que describe lo que todavía no se corrió es una promesa.

### Dentro de cada fase

**Las pruebas primero y tienen que fallar**: T001→T002. Que T001 falle con «la función no existe» es parte
de la verificación; una prueba que pasa antes de que la regla exista no está probando la regla.

Marcadas `[P]`: T012 y T013. Tocan archivos distintos y ninguna espera a la otra.

### Lo que este orden evita

- **Cablear antes de fijar la regla**: sería escribir la comparación dos veces, en dos modos, y descubrir en
  el segundo que el borde de FR-005 estaba mal en el primero.
- **Tocar `readReport()`**: la fase 0 ya mostró que ahí rompería `--check-report` (R-01). Ninguna tarea lo
  nombra, y T010 es lo que lo verifica.
- **Cambiar el texto del camino feliz** de paso: T006 lo compara antes de que la feature siga.
