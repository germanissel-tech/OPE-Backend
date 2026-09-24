---
description: "Task list template for feature implementation"
---

# Tasks: Las cuatro deudas de las instrucciones se registran y se cierran

**Input**: Design documents from `/specs/026-deudas-de-las-instrucciones/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md)

**Tests**: las que ya existen. Esta feature no toca `src/`, así que **ninguna prueba del producto
debería moverse**; si alguna se mueve, hay algo mal entendido y se para.

**Organization**: por historia. El registro va **primero**: si la feature se interrumpiera ahí, lo
que quedaría es lo más valioso — la deuda anotada donde se la busca.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3, US4
- Toda tarea nombra su archivo

---

## Phase 1: Setup — congelar los números

- [x] T001 Anotar las cifras contra las que se mide todo: `wc -l CLAUDE.md` (195),
      `.claude/rules/gates-de-calidad.md` (58), `.claude/rules/anillos-y-modulos.md` (90), y las tres
      secciones declaradas `mixed` en `scripts/instructions-policy.json`. Si alguna cambió, rehacer
      el reparto del plan con el número nuevo antes de tocar nada.

---

## Phase 2: User Story 1 - El registro vuelve a ser verdad (Priority: P1) 🎯 Va primero

**Goal**: la deuda se anota donde el repositorio la busca, y las cuatro quedan registradas **antes**
de cerrarse.

**Independent Test**: buscar las cuatro en el registro y comprobar que cada una tiene identificador,
origen, estado y fecha.

- [x] T002 [US1] `docs/deudas.md` — el registro vivo: las seis filas de la 019 tal cual, más D-07 a
      D-10 en estado `abierta`, con su origen (feature 025) y su fecha. Encabezado que diga qué es y
      cómo se agrega una fila, para que la próxima deuda no vuelva a escribirse en otro lado.
- [x] T003 [US1] `docs/README.md` — su fila en el inventario (ADR-032). **Sin ella
      `tests/docs/readmes.test.ts` falla**; y el archivo tiene que estar `git add`eado antes de
      correr la prueba, porque lee lo que git rastrea. Las dos cosas ya me mordieron dos veces.
- [x] T004 [US1] `specs/019-deudas-tecnicas/spec.md` — su tabla **se queda como historia de esa
      feature**, con una línea que apunte al registro vivo. No se borra: es el registro de lo que esa
      feature decidió.
- [x] T005 [US1] Verificar: `npx vitest run --project tools tests/docs/readmes.test.ts` en verde, y
      `npm run check:markers` y `npm run check:identifiers`, que leen `docs/` y ahora ven el
      registro.

**Checkpoint**: la deuda está anotada. Todo lo que sigue puede cerrarse o no, y el registro lo dice.

---

## Phase 3: User Story 2 - `Convenciones` dice una sola cosa (Priority: P1)

**Goal**: D-07 cerrada; el núcleo recupera margen.

**Independent Test**: contar el núcleo y comprobar que la sección deja de estar declarada `mixed`.

**En dos tiempos**, y el orden no es negociable: primero se agrega al destino, se verifica que está
completo, y **recién entonces** se borra del origen. En commits separados.

- [x] T006 [US2] `docs/adr/031-merchants-operados-y-tres-niveles.md` — recibe lo descriptivo de la
      viñeta: qué contiene cada uno de los tres niveles, quién los resuelve y por qué puerto llega
      cada valor a su consumidor. Es la decisión que ese ADR ya tomó; le faltaba la forma que tomó al
      construirse.
- [x] T007 [US2] `CLAUDE.md` — la viñeta queda en su **regla**: un valor de comportamiento nuevo es
      una entrada en un nivel, nunca una constante, y un gate lo vigila. Las otras siete viñetas no
      se tocan.
- [x] T008 [US2] `CLAUDE.md` — **la duplicación que apareció al leer**: «Sin `any`» está en la
      viñeta de tipado y otra vez en la de convenciones. Se queda en tipado, que es su lugar. Es
      arreglo de paso, no deuda: si costara trabajo aparte, sería una fila.
- [x] T009 [US2] `scripts/instructions-policy.json` — `Convenciones` pasa de `mixed` a `normative` y
      pierde su `reason`.
- [x] T010 [US2] Verificar: `wc -l CLAUDE.md` **bajó de 195**, `npm run check:instructions` en verde,
      y lo que se movió no quedó **también** en el origen.

---

## Phase 4: User Story 3 - Las dos reglas acotadas dicen una sola cosa (Priority: P2)

**Goal**: D-08 y D-09 cerradas. Son independientes entre sí.

- [x] T011 [P] [US3] `docs/adr/016-*.md` (o la configuración que los declara) — recibe lo descriptivo
      de `Gates de calidad`: los umbrales del lint, los de duplicación y código muerto, y los de
      forma de los anillos. **Antes de borrarlos.** Si el destino correcto resulta ser la propia
      configuración —que ya lleva la justificación de cada umbral—, entonces lo que hay que agregar
      es el puntero, no el número.
- [x] T012 [US3] `.claude/rules/gates-de-calidad.md` — se van los tres bloques descriptivos; quedan
      la regla de mutación, las excepciones en línea y el ritmo de las pruebas en dos velocidades.
- [x] T013 [P] [US3] `docs/adr/033-grafo-de-composicion-tipado.md` y
      `docs/adr/013-*.md` — reciben el detalle de la composición y lo de fuera de `src/`, antes de
      borrarse.
- [x] T014 [US3] `.claude/rules/anillos-y-modulos.md` — se van la lista de módulos —cuya fuente
      verificada es `CONTEXT_MAP`— y el detalle de la composición; quedan la tabla de anillos, la
      regla del borde y la regla de la composición.
- [x] T015 [US3] `scripts/instructions-policy.json` — las dos pasan de `mixed` a `normative` y
      pierden su `reason`.
- [x] T016 [US3] Verificar por regla, **no por total**: lo que se movió está completo en su destino y
      no quedó duplicado. Un total que cierra puede esconder un bloque entero.

---

## Phase 5: User Story 4 - El procedimiento se ejecuta, no se lee (Priority: P3)

**Goal**: D-10 cerrada.

- [x] T017 [US4] **Confirmar el destino antes de mover** (la pregunta de la spec): ¿alguien lo
      **ejecuta** paso a paso o lo **consulta**? El texto dice «ante un superviviente, **en este
      orden**» y enumera cuatro pasos, así que es lo primero — pero se confirma leyéndolo, no
      citando el plan. **Si resulta que se consulta, el destino es otro y la tarea cambia.**
- [x] T018 [US4] `.claude/skills/<nombre>/SKILL.md` — la skill, con su frontmatter (`name`,
      `description`) como las doce que ya viven ahí. La `description` decide cuándo se la invoca, así
      que dice el síntoma —un mutante que sobrevive— y no sólo el tema.
- [x] T019 [US4] Los cuatro pasos, en orden, con lo que cada uno decide: describir el daño
      observable, clasificar el mutante antes de tocar nada, la prueba o la reestructuración según la
      clase, y confirmar con una corrida acotada. **Lo que es propio de este repositorio** —los
      nombres de los comandos, el archivo incremental— va como dato de la skill o queda en la regla:
      la skill **no importa nada del repositorio por ruta**.
- [x] T020 [US4] `.claude/rules/gates-de-calidad.md` — queda que el procedimiento existe y cómo se
      lo invoca.
- [x] T021 [US4] Verificar: `npx vitest run --project tools tests/audit/skills-isolation.test.ts` en
      verde.

---

## Phase 6: Cierre

- [ ] T022 **La verificación que ningún comando decide**: por cada separación, leer **lo que quedó**
      y preguntarse si un agente puede obedecerlo sin lo que se fue. Si no puede, **el bloque
      vuelve** y su deuda queda registrada con el motivo. Va antes del cierre de las filas, porque
      puede cambiar cuáles se cierran.
- [ ] T023 `docs/deudas.md` — las filas que se hayan cerrado pasan a `implementada` con su
      referencia; las que no, se quedan `abierta` con el motivo. **Cerrar una por decreto es peor que
      dejarla anotada.**
- [ ] T024 `specs/026-deudas-de-las-instrucciones/quickstart.md` — correr el quickstart entero y
      dejar su tabla de estado fechada, con el antes y el después y lo que no se pudo cerrar.
- [ ] T025 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `release-check`. **Las pruebas del producto no se mueven**: si alguna cambia,
      se para y se revisa qué se entendió mal.
- [ ] T026 **La feature se aplica a sí misma**: si al terminar quedó una deuda sin registrar —incluida
      cualquiera que haya aparecido al separar— no está hecha.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: T001 congela los números.
- **US1 (F2)**: va **primero** y bloquea el cierre de todo lo demás: sin registro no hay dónde
  anotar el cierre. T002 → T003 → T005 en orden; T004 es independiente.
- **US2 (F3)**: después de US1. T006 **antes** de T007, que es la regla de toda la feature.
- **US3 (F4)**: después de US1. Las dos reglas son independientes entre sí; dentro de cada una, el
  destino antes que el origen.
- **US4 (F5)**: última. T017 **antes** de T018: el destino se confirma antes de mover.
- **F6**: al final. T022 antes de T023, porque puede cambiar qué filas se cierran.

### Paralelismo real

- T011 y T013: dos ADR distintos.
- US3 completa contra US2 completa, si hubiera dos personas: no comparten archivo salvo la política.
- No hay paralelismo dentro de una separación: el destino va antes que el origen, siempre.

---

## Implementation Strategy

### El MVP es el registro

US1 sola ya vale: la deuda queda anotada donde se la busca, que es lo que faltaba. Las cuatro
historias que siguen cierran deudas, y cada una es entregable por separado.

### Commits

Uno por historia, más **uno por separación en dos tiempos** (agregar al destino, después vaciar el
origen). El de la duplicación de «Sin `any`» va en el de D-07, nombrado, porque es un arreglo de
paso y conviene que se vea.

---

## Notes

- **T022 es la que protege el resultado.** El gate mide que las secciones estén clasificadas, no que
  lo que quedó **alcance**. Eso lo dice quien lo lee, y por eso está escrito como tarea.
- **La revisión de que nada se perdió es por bloque, no por total.**
- **Ninguna prueba del producto debería moverse.** Es el canario de esta feature: si una se mueve,
  se entendió mal qué es documentación y qué es código.
- **Una deuda nueva que aparezca al separar se registra como fila**, no se arrastra: mezclarla haría
  ilegible qué cerró qué.
- `docs/deudas.md` entra al alcance de `check:markers`, `check:adrs` y `check:identifiers`, que ya
  leen `docs/`. Todo lo que cite tiene que existir, y un marcador abierto ahí va a aparecer en el
  recuento — que es exactamente lo que se quiere de un registro de deuda.
