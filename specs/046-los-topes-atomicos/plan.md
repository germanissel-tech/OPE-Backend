# Implementation Plan: Los topes de intervención, atómicos

**Branch**: `046-los-topes-atomicos` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/046-los-topes-atomicos/spec.md`

## Summary

Las decisiones de un mismo visitante se atienden de a una dentro del proceso, y las de visitantes distintos no se
esperan. Es un decorador del puerto de decisión, delante de `DecisionService`, que encadena las decisiones de cada
visitante en una cola de promesas por llave y la borra cuando se vacía (R-02, R-03). Así se cierran a la vez el tope
de intervenciones por sesión y el diario por visitante, y la carrera de D-30 se reproduce en una prueba antes de
arreglarla (R-04).

**Lo que toca `src/`**: un archivo nuevo en `application/decision/` y el enlace de `DecisionPlanePort` en
`composition/modules/decision.ts`. Ni el servicio de decisión ni el dominio cambian.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas (ADR-011, ADR-017).

**Primary Dependencies**: las de hoy. Ninguna nueva.

**Storage**: ninguno nuevo; el turno vive en la memoria del proceso (data-model).

**Testing**: unidad (el turno, con un plano guionado que espera una señal), integración (las dos carreras con el
servidor entero, que fallan antes del arreglo), aislamiento, y la medición de latencia de la ingesta.

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es del camino de decisión.

**Performance Goals**: la latencia de la ingesta no cambia para visitantes distintos (SC-002):
`tests/integration/ingest-latency.test.ts` con su techo.

**Constraints**: ninguna escritura nueva en el almacén durante la decisión (FR-008); un solo proceso (constitución
IV, D-21).

**Scale/Scope**: un decorador y un enlace.

## Constitution Check

**Constitución v1.5.1.** Los once principios, evaluados; los que no aplican se marcan como tales y se dice por qué.

| Principio                                        | Aplica            | Cómo se cumple / por qué no aplica                                                                                                                                                                                                   |
| ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I. Separación de autoridades**                 | No                | La decisión sigue siendo del servicio; el decorador sólo ordena cuándo se le pregunta.                                                                                                                                               |
| **II. Fail-closed: `NO_OP` por defecto**         | **Sí**            | Es lo que la feature arregla: el lote que llega segundo ve el conteo ya actualizado y responde `NO_OP` por tope, en lugar de intervenir de más.                                                                                      |
| **III. La medición precede y no se contamina**   | **Sí**            | Una sesión intervenida más de lo que la política dice es una sesión tratada distinto de lo que el experimento declara; la feature lo cierra.                                                                                         |
| **IV. Dos caminos, dos garantías**               | **Sí**            | La exclusión vive en el proceso, sin escritura nueva ni I/O en el camino de decisión; visitantes distintos no se esperan, y la medición de latencia de la ingesta lo sigue juzgando. Un solo proceso, como el MVP; con dos, es D-21. |
| **V. Aislamiento por merchant**                  | **Sí**            | La llave del turno lleva el merchant: el mismo `visitorId` en dos merchants son dos turnos, y `isolation.test.ts` lo afirma.                                                                                                         |
| **VI. Identidad e idempotencia explícitas**      | No                | Ninguna identidad cambia; la deduplicación por `eventId` sigue donde está.                                                                                                                                                           |
| **VII. OPE observa comportamiento, no personas** | Sí                | El turno guarda la llave del visitante sólo mientras tiene lotes en curso, y nada más.                                                                                                                                               |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente) | Ninguna llamada nueva.                                                                                                                                                                                                               |
| **IX. Nada entra al reporte sin trazabilidad**   | No                | El libro de decisiones registra lo mismo; ahora, en el orden en que se atendieron.                                                                                                                                                   |
| **X. Puertos en los dos bordes**                 | No                | No toca los bordes de plataforma ni del SDK.                                                                                                                                                                                         |
| **XI. Ninguna política vive en el código**       | Sí                | Los dos topes siguen siendo de la política comercial; el código agrega un algoritmo de orden, no un valor.                                                                                                                           |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** No.
- **¿Toca persistencia o API?** No: nada nuevo en el almacén ni en el contrato. Aun así, la prueba de aislamiento de
  la llave va en `isolation.test.ts`.
- **¿Toca el plano de decisión?** Sí: ordena las decisiones de un mismo visitante. No agrega I/O de red ni escritura;
  toda salida sigue pudiendo ser `NO_OP` con motivo.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** No hay regla nueva: los topes existen.
- **¿Sustantivo nuevo en el contrato?** No.
- **¿Toca `src/`?** Sí: `application/decision/` y su enlace. Ninguna dependencia nueva entre módulos.

**Resultado: pasa.**

## Project Structure

### Documentation (this feature)

```text
specs/046-los-topes-atomicos/
├── spec.md
├── plan.md          # este archivo
├── research.md      # R-01..R-05
├── data-model.md    # el turno del visitante
├── quickstart.md    # cómo se verifica
├── checklists/
└── tasks.md         # /speckit-tasks
```

No hay `contracts/`: la feature no toca la superficie HTTP.

### Source Code (repository root)

```text
src/application/decision/services/visitor-turns.ts   # el decorador del puerto de decisión
src/application/decision/index.ts                    # lo exporta
src/composition/modules/decision.ts                  # DecisionPlanePort = el decorador sobre DecisionService
```

**Structure Decision**: la del repositorio, por anillos y módulos (ADR-013). Ningún módulo ni dependencia nuevos.

## Tramos

1. **La carrera, reproducida** (US1, US2): las pruebas de integración que fallan con el código de hoy. Sin commit
   aparte: se commitean con el arreglo, pero su fallo queda registrado en `tasks.md`.
2. **El turno** (US1 a US3): el decorador, su prueba de unidad, el enlace, el aislamiento. Commit.
3. **El cierre**: la deuda D-30 cerrada en el registro, el quickstart a mano, la cadena entera. Commit, push y PR.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
