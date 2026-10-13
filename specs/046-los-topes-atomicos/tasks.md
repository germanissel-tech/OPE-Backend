---
description: "Task list for feature 046 — los topes de intervención, atómicos"
---

# Tasks: Los topes de intervención, atómicos

**Input**: `specs/046-los-topes-atomicos/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Prerequisites**: plan.md con el Constitution Check pasado (v1.5.1, sin enmiendas); la revisión de D-30 con el
dueño del 2026-10-13 (se arregla ahora; por visitante).

**Tests**: sí, y preceden a la implementación. Las de la carrera tienen que **fallar con el código de hoy**: es la
reproducción que reemplaza a la medición de D-30.

**Organization**: por **tramo** del plan. Historias: US1 el tope de la sesión, US2 el tope diario del visitante,
US3 visitantes distintos no se esperan.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 a US3
- Cada tarea nombra su archivo

---

## Phase 1: La carrera, reproducida (tramo 1) — US1, US2 🎯

**Goal**: saber que la carrera de D-30 es alcanzable en este código, con una prueba que falla hoy.

- [ ] T001 [US1] `tests/integration/commercial-policy.test.ts`, un `describe` nuevo: dos lotes de la misma sesión,
      los dos con señales que justifican intervenir, mandados a la vez con `interventionsPerSession: 1` → una
      intervención y un `NO_OP` `session-budget-exhausted`; el libro registra una y una
- [ ] T002 [US2] El mismo `describe`: dos lotes de dos sesiones del mismo visitante a la vez con
      `interventionsPerVisitorPerDay: 1` → una intervención y un `NO_OP` `visitor-fatigue`
- [ ] T003 Correr T001 y T002 contra el código de hoy y anotar acá el resultado: si fallan (dos intervenciones),
      la carrera está reproducida. Si pasan —el servidor entero no la deja ver—, reescribirlas sobre el servicio de
      decisión real con un almacén de estado que demora el `recall` (research R-04), y anotarlo

**Checkpoint**: la carrera está reproducida y documentada.

---

## Phase 2: El turno del visitante (tramo 2) — US1, US2, US3

**Goal**: las decisiones de un mismo visitante, de a una; las de visitantes distintos, en paralelo.

- [ ] T004 [P] [US3] `tests/unit/application/decision/visitor-turns.test.ts`, **antes del código**, con un plano
      guionado que espera una señal de la prueba: un segundo `decide` del mismo visitante no entra hasta que el
      primero termina; los que esperan entran en orden de llegada; uno de otro visitante, o del mismo `visitorId`
      en otro merchant, entra sin esperar; un `decide` que lanza o rechaza libera el turno y el siguiente se atiende;
      el resultado de cada uno es el del plano envuelto; al terminar todo, no queda ninguna llave
- [ ] T005 [US1] `src/application/decision/services/visitor-turns.ts`: el decorador de `DecisionPlane` con la cola
      de promesas por llave (merchant y visitante, en una clave que no se confunde entre merchants), que borra la
      llave cuando el último de la fila termina (R-02, R-03); exportado en `src/application/decision/index.ts`
- [ ] T006 [US1] `src/composition/modules/decision.ts`: `DecisionPlanePort` enlazado al decorador sobre
      `DecisionService`. T001 y T002 pasan
- [ ] T007 [P] [US3] `tests/integration/isolation.test.ts`: el mismo `visitorId` en dos merchants, lotes a la vez:
      ninguno espera al otro y cada uno decide con su propio conteo
- [ ] T008 Romper a propósito una vez cada una: no tomar el turno; soltarlo sólo si el lote sale bien; no borrar la
      llave. `npm test`, `npm run quality`, `npm run test:measures` (la latencia de la ingesta con su techo). Commit:
      `fix(046): las decisiones de un mismo visitante se atienden de a una`

**Checkpoint**: los dos topes se respetan con lotes simultáneos.

---

## Phase 3: El cierre

- [ ] T009 [P] `docs/deudas.md`: D-30 `implementada`, con su cierre; `spec.md` **Status** construida; `tasks.md` con
      lo hecho y los desvíos
- [ ] T010 El `quickstart.md` a mano contra `npm run dev`; «Lo corrido» fechado
- [ ] T011 La cadena entera: `npm run format:check`, `npm run quality`, `npm run typecheck`, `npm run test:all`,
      `npm run contract:check`, `npm run release-check`; la mutación, en CI. Commit:
      `docs(046): cierre — los topes de intervención, atómicos`. Push y PR

---

## Dependencies & Execution Order

```text
Fase 1 ──► Fase 2 ──► Fase 3
```

- T003 decide la forma de T001 y T002 antes de escribir el arreglo.
- T004 antes de T005; T005 antes de T006.

## Parallel Example

```text
Fase 2: T004 y T007 juntas; después T005 → T006.
```

## Implementation Strategy

MVP = fases 1 y 2: con el turno puesto, los dos topes se respetan. La fase 3 cierra la deuda y la feature.
