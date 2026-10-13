# Implementation Plan: Las decisiones que el puerto dejó abiertas

**Branch**: `045-las-decisiones-del-puerto` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-las-decisiones-del-puerto/spec.md`

## Summary

Tres cambios chicos sobre lo que construyó la 044, decididos con el dueño (ADR-047, enmienda del 2026-10-13):

- **La misma orden, aunque el instante sea otro.** La orden y la devolución recuerdan si su instante lo puso la
  observación de OPE, y uno observado no cuenta al compararlas (R-01).
- **La devolución que adelanta a su orden se reintenta.** Por la cola de avisos, en los dos modos, pasando por la
  compuerta del modo por el que entró (R-02).
- **Una corrida que falla se reintenta a `noticeRetry.afterMs`**, calculado de lo que ya está guardado (R-03).

El cuarto punto, el temporizador, se confirma sin cambio (R-04).

**Lo que la investigación cambió** ([`research.md`](research.md)):

- **El lector de avisos también perdía la devolución huérfana**: la spec suponía que `subscribe` ya la reintentaba,
  y no; la regla vale para los dos modos (R-02). La spec se corrige en sus supuestos.
- **El aviso recuerda por qué modo entró** (`via`), para que la devolución de `pull` reintentada no pase por la
  compuerta de `subscribe` (R-02).

**Lo que toca `src/`**: en `outcomes`, la orden y la devolución (dominio) y los dos casos de uso que las reciben; en
`platform`, el planificador, el lector de avisos y el aviso. Sin migración, sin contrato, sin configuración nueva.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas (ADR-011, ADR-017).

**Primary Dependencies**: las de hoy. Ninguna nueva.

**Storage**: SQLite, sin migración: los campos nuevos viajan en el documento de la orden y del aviso, y un documento
anterior se lee con su ausencia (data-model).

**Testing**: unidad (comparación de la orden y la devolución; planificador y lector con reloj y fuente guionada),
integración (la orden releída, la devolución que adelanta, el catálogo caído, aislamiento), durabilidad (la marca,
la devolución encolada y el reintento a través de un reinicio).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es del dominio de `outcomes` y del adaptador `platform`.

**Performance Goals**: la decisión no cambia (SC-005). Un reintento no corre en cada tick (FR-009).

**Constraints**: el contrato no cambia (`1.16.0`); ningún valor de configuración nuevo; `push` sin cambios (FR-004).

**Scale/Scope**: dos campos opcionales en dos entidades, uno en el aviso, una regla de espera en el planificador.

## Constitution Check

**Constitución v1.5.1.** Los once principios, evaluados; los que no aplican se marcan como tales y se dice por qué.

| Principio                                        | Aplica            | Cómo se cumple / por qué no aplica                                                                                                                                                                   |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                | Ninguna autoridad cambia: la orden sigue siendo de `outcomes` y el modo, del adaptador.                                                                                                              |
| **II. Fail-closed: `NO_OP` por defecto**         | No                | Nada de la decisión cambia; un catálogo que se reintenta antes sólo acorta el tiempo en que la decisión se calla por foto vieja.                                                                     |
| **III. La medición precede y no se contamina**   | **Sí**            | Es lo que la feature arregla: una devolución que se perdía cambiaba la medición (una venta devuelta contada como buena), y un conflicto falso contaba una orden de menos en la corrida.              |
| **IV. Dos caminos, dos garantías**               | **Sí**            | Todo pasa en el planificador y en el lector de avisos, fuera del camino de decisión; la prueba de la 044 con una fuente que no responde lo sigue afirmando (SC-005).                                 |
| **V. Aislamiento por merchant**                  | **Sí**            | La devolución encolada lleva el merchant de la corrida y sólo se vincula a una orden de ese merchant (FR-012); `isolation.test.ts` lo afirma.                                                        |
| **VI. Identidad e idempotencia explícitas**      | **Sí**            | Es la otra mitad de la feature: qué es «la misma orden» se dice explícitamente, en el dominio; `orderId` sigue siendo la identidad y el instante deja de serlo sólo cuando no vino de la plataforma. |
| **VII. OPE observa comportamiento, no personas** | Sí                | Los campos nuevos son una marca y un modo; ningún dato personal.                                                                                                                                     |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente) | Ninguna llamada nueva.                                                                                                                                                                               |
| **IX. Nada entra al reporte sin trazabilidad**   | Sí, indirecto     | La devolución reintentada conserva el rastro del aviso: en el log y en el estado del flujo al agotar.                                                                                                |
| **X. Puertos en los dos bordes**                 | Sí                | El núcleo sigue sin saber el modo: la marca de observado llega por el pedido del caso de uso, y el modo de la devolución reintentada lo decide la compuerta.                                         |
| **XI. Ninguna política vive en el código**       | **Sí**            | La espera y los intentos son `noticeRetry` y la cadencia, `syncCadence`, configuración del merchant; el código conserva la regla de cuál de los dos manda.                                           |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** No: el contrato no cambia; el origen del instante no se expone.
- **¿Toca persistencia o API?** Persistencia, por el documento de la orden y del aviso, sin migración; pruebas de
  aislamiento (FR-012) y de durabilidad (FR-010).
- **¿Toca el plano de decisión?** No.
- **¿Toca el ledger o la cadena de evidencia?** La alimenta igual; lo que cambia es cuándo dos lecturas son la
  misma orden, que es la regla de idempotencia del libro.
- **¿Campo nuevo de evento u orden?** Sí, uno interno de la orden y otro de la devolución, que no entran por el
  contrato ni salen en una respuesta.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** No hay regla nueva del contrato: es una regla de idempotencia
  del dominio.
- **¿Sustantivo nuevo en el contrato?** No.
- **¿Toca `src/`?** Sí, `outcomes` y `platform`, sin dependencias nuevas entre módulos.

**Resultado: pasa.**

## Project Structure

### Documentation (this feature)

```text
specs/045-las-decisiones-del-puerto/
├── spec.md
├── plan.md          # este archivo
├── research.md      # R-01..R-05
├── data-model.md    # los campos nuevos y la regla de la espera
├── quickstart.md    # cómo se verifica
├── checklists/
└── tasks.md         # /speckit-tasks
```

No hay `contracts/`: la feature no toca la superficie HTTP.

### Source Code (repository root)

```text
src/domain/outcomes/order.ts                         # confirmedAtObserved, returnedAtObserved, sameContentAs
src/application/outcomes/use-cases/notify-order.use-case.ts
src/application/outcomes/use-cases/notify-return.use-case.ts
src/domain/platform/notice.ts                        # via
src/interface-adapters/platform/scheduler/scheduler.ts      # la marca, la huérfana encolada, la espera
src/interface-adapters/platform/scheduler/notice-reader.ts  # la marca, order-unknown es reintento, la compuerta por modo
src/composition/modules/platform.ts                  # el lector recibe las dos compuertas de la devolución
```

**Structure Decision**: la del repositorio, por anillos y módulos (ADR-013). Ningún módulo nuevo ni dependencia
nueva: `platform` ya depende de `outcomes`.

## Tramos

1. **La misma orden** (US1): dominio, casos de uso, la marca en el planificador y el lector. Commit.
2. **La devolución huérfana** (US2): el aviso con `via`, el lector que reintenta `order-unknown`, el planificador
   que encola, la composición. Commit.
3. **El reintento de la corrida** (US3): la regla de la espera. Commit.
4. **El cierre**: quickstart a mano, docs (ADR-047 dice construido), la cadena entera. Commit, push y PR.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
