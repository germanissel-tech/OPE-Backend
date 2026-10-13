---
description: "Task list for feature 045 — las decisiones que el puerto dejó abiertas"
---

# Tasks: Las decisiones que el puerto dejó abiertas

**Input**: `specs/045-las-decisiones-del-puerto/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.1, sin enmiendas); las decisiones del dueño del
2026-10-13 (ADR-047, enmienda).

**Tests**: sí, y preceden a la implementación en cada fase.

**Organization**: por **tramo** del plan, cada uno un commit que se puede correr. Historias: US1 la misma orden,
US2 la devolución huérfana, US3 el reintento de la corrida. No hay fase de preparación ni de base: la feature no
agrega módulos, configuración ni contrato.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 a US3
- Cada tarea nombra su archivo

---

## Phase 1: La misma orden (tramo 1) — US1 🎯

**Goal**: una orden o una devolución sin instante de la plataforma, leída dos veces, es una sola y la segunda cuenta
como repetida.

**Independent Test**: con la fuente de prueba, una orden sin instante avisada dos veces y leída en dos corridas:
queda una, la segunda cuenta y no hay rechazo en el log; con otro total, conflicto.

- [x] T001 [P] [US1] `tests/unit/domain/outcomes/order.test.ts`, **antes del código**: `sameContentAs` de la orden
      con los dos instantes de la plataforma iguales (misma), distintos (conflicto), uno observado y otro no (misma),
      los dos observados (misma), y un total o unos ítems distintos con el instante observado (conflicto); lo mismo
      para la devolución con sus ítems; un registro sin la marca se lee como de la plataforma
- [x] T002 [US1] `src/domain/outcomes/order.ts`: `OrderFacts.confirmedAtObserved?: true` y
      `ReturnRecord.returnedAtObserved?: true`, «presente (`true`) sólo si OPE puso el instante al leerla»; las
      claves de comparación sin el instante, y el instante comparado aparte sólo si ninguna de las dos lecturas lo
      tiene observado (R-01)
- [x] T003 [US1] `src/application/outcomes/use-cases/notify-order.use-case.ts` y `notify-return.use-case.ts`: el
      pedido gana `confirmedAtObserved?: true | undefined` / `returnedAtObserved?: true | undefined` y los pasa a la
      fábrica; `tests/unit/application/outcomes/` afirma que llegan al registro
- [x] T004 [US1] `src/interface-adapters/platform/scheduler/scheduler.ts` y `notice-reader.ts`: donde se completa el
      instante (`?? now`) se marca observado, y en ningún otro lugar; `tests/unit/interface-adapters/platform/`
      afirma la marca con instante ausente y su ausencia con instante dado
- [x] T005 [US1] `tests/integration/platform-notices.test.ts` y `platform-pull.test.ts`: una orden sin instante
      leída dos veces queda una, `platform-sync` cuenta las dos y el log no dice rechazo; con otro total, conflicto;
      el `push` repetido con otro instante sigue siendo conflicto (FR-004)
- [x] T006 [P] [US1] `tests/durability/outcomes.test.ts`: la marca sobrevive en el documento de la orden y de la
      devolución a través de un reinicio, y un documento sin ella se lee como de la plataforma
- [x] T007 Romper a propósito una vez: comparar el instante aunque uno sea observado. `npm test`,
      `npm run test:durability`, `npm run quality`. Commit:
      `feat(045): una orden leída dos veces es una sola, aunque OPE haya puesto el instante`

**Checkpoint**: una relectura sin instante ya no aparece como rechazo.

---

## Phase 2: La devolución huérfana (tramo 2) — US2

**Goal**: una devolución que adelanta a su orden no se pierde, por `pull` ni por `subscribe`.

**Independent Test**: devoluciones en `pull`, la devolución se lee antes que la orden; cuando la orden entra, al
vencer el reintento la devolución queda vinculada.

- [x] T008 [P] [US2] `tests/unit/interface-adapters/platform/notices.test.ts`, **antes del código**: un aviso de
      devolución con `order-unknown` se reintenta (no se da por terminado); con `via: "pull"` se deposita por la
      compuerta de `pull` y sin `via`, por la de `subscribe`; agotado, rastro
- [x] T009 [P] [US2] `tests/unit/interface-adapters/platform/scheduler.test.ts`, **antes del código**: una
      devolución de `pull` con `order-unknown` se encola con `via: "pull"`, `attempts: 1` y `nextAt` en la primera
      espera, el cursor avanza y la corrida cuenta el resto; otro rechazo se loguea, como hoy
- [x] T010 [US2] `src/domain/platform/notice.ts`: `via?: "pull" | undefined` («ausente = un aviso de `subscribe`»)
- [x] T011 [US2] `src/interface-adapters/platform/scheduler/notice-reader.ts`: `order-unknown` de una devolución es
      un reintento; `notifyReturn` por modo (`{ pull, subscribe }`) y se elige por `via`
- [x] T012 [US2] `src/interface-adapters/platform/scheduler/scheduler.ts`: la devolución huérfana se encola en la
      cola de avisos (`NoticeQueue` en sus dependencias) y la corrida sigue; `src/composition/modules/platform.ts`
      pasa la cola y las dos compuertas de la devolución
- [x] T013 [US2] `tests/integration/platform-pull.test.ts`: la devolución que adelanta entra cuando su orden llega;
      `pendingNotices` de devoluciones la muestra mientras espera; un cambio a `push` en el medio la descarta con
      rastro
- [x] T014 [P] [US2] `tests/integration/isolation.test.ts`: la devolución huérfana de A nunca se vincula a una orden
      de B con el mismo `orderId` (FR-012)
- [x] T015 [P] [US2] `tests/durability/platform.test.ts`: una devolución huérfana encolada sobrevive un reinicio y
      entra cuando su orden llega
- [x] T016 Romper a propósito una vez: descartar la devolución huérfana en vez de encolarla. `npm test`,
      `npm run test:durability`, `npm run quality`. Commit:
      `feat(045): la devolución que adelanta a su orden se reintenta`

**Checkpoint**: ninguna devolución se pierde por llegar antes que su orden.

---

## Phase 3: El reintento de la corrida (tramo 3) — US3

**Goal**: una corrida de `pull` que falla se reintenta a `noticeRetry.afterMs`, no a su cadencia.

**Independent Test**: un catálogo cuya fuente falla se reintenta a la espera configurada; cuando vuelve, la
siguiente espera un día.

- [ ] T017 [US3] `tests/unit/interface-adapters/platform/scheduler.test.ts`, **antes del código**: fallida espera
      `min(cadencia, noticeRetry.afterMs)`; bien o nunca corrida, la cadencia; sin tope y nunca en cada tick
- [ ] T018 [US3] `src/interface-adapters/platform/scheduler/scheduler.ts`: la regla de la espera, como función con
      nombre (R-03)
- [ ] T019 [US3] `tests/integration/platform-pull.test.ts`: un catálogo caído se reintenta al minuto y vuelve a su
      cadencia cuando sale bien
- [ ] T020 [P] [US3] `tests/durability/platform.test.ts`: después de un reinicio, una corrida que había fallado se
      reintenta a la espera, no a la cadencia
- [ ] T021 Romper a propósito una vez: reintentar una corrida fallida a su cadencia. `npm test`,
      `npm run test:durability`, `npm run quality`. Commit:
      `feat(045): una corrida que falla se reintenta a la espera de los avisos`

**Checkpoint**: un catálogo caído no espera un día.

---

## Phase 4: El cierre

- [ ] T022 El `quickstart.md` a mano contra `npm run dev`; «Lo corrido» fechado
- [ ] T023 [P] ADR-047: la enmienda dice que los tres puntos están construidos; `spec.md` **Status** construida;
      `tasks.md` con lo hecho y los desvíos
- [ ] T024 La cadena entera: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm run test:all`,
      `npm run contract:check`, `npm run release-check`; la mutación, en CI. Commit:
      `docs(045): cierre — las decisiones del puerto, construidas`. Push y PR

---

## Dependencies & Execution Order

```text
Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4
```

- La fase 2 usa la marca de la 1: la devolución reintentada se deposita con su instante observado.
- Las tres fases tocan `scheduler.ts`; por eso van en orden y no en paralelo.
- Las pruebas marcadas «antes del código» fallan primero.

## Parallel Example

```text
Fase 1: T001 y T006 juntas; después T002 → T003 → T004 → T005.
Fase 2: T008 y T009 juntas; después T010 → T011 → T012; T014 y T015 juntas.
```

## Implementation Strategy

MVP = fase 1: es la única que hoy produce un efecto visible y engañoso. Las fases 2 y 3 cierran pérdidas y esperas
de casos de borde; la 4 cierra la feature.
