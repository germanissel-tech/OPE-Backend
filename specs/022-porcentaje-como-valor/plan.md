# Implementation Plan: El porcentaje es un valor con reglas

**Branch**: `022-porcentaje-como-valor` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-porcentaje-como-valor/spec.md`

## Summary

`Percent` pasa a ser una clase del `shared-kernel` del dominio —entero 0..100, con `of` que devuelve
`Result`, `rate()` hacia adentro y `fromRate()` con su redondeo hacia afuera— y los seis conceptos
que son porcentajes se tipan como tal **desde que entran**, no desde que el dominio los convierte.
Ésa es la decisión que hace que la feature cumpla su propósito y no sea sólo deduplicación
(research R-01): si el porcentaje sigue siendo `number` hasta la fábrica, olvidarse de dividir
seguiría compilando.

Con eso desaparecen las tres lecturas distintas de "esto es un porcentaje" y los cuatro nombres del
factor. La granularidad del reparto se queda, renombrada, porque vale 100 por coincidencia.

**Corrección que el plan hereda de la investigación**: hoy **no hay defecto vivo**. Los cuatro
caminos dividen y ninguna entrada produce hoy una tasa equivocada. Lo que se ataca es un modo de
falla latente —serio, porque `isRate` acepta 1— más duplicación real y medida. Está escrito así en
R-00 para que nadie lea la spec de más.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para `build` y `typecheck`; API 6.0 para
el tooling (ADR-017). `strict`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, sin `any`.

**Primary Dependencies**: ninguna nueva.

**Storage**: no aplica. La feature no toca persistencia ni puertos.

**Testing**: Vitest (`fast`, `tools`), fixture de tipos en `tests/typecheck/fixtures/`, Stryker.

**Target Platform**: Node 22.

**Project Type**: servicio backend en anillos (ADR-013).

**Performance Goals**: sin cambio. Una construcción de objeto más por porcentaje leído, y los
porcentajes se leen al arrancar y al publicar configuración — nunca en el camino crítico de
decisión, que trabaja con tasas ya resueltas.

**Constraints**: cero diff del contrato (FR-010); cero cambios de comportamiento observable
(FR-011); `Lint exceptions: 0`; el reparto en cubetas y el fingerprint de regresión de la 007
intactos.

**Scale/Scope**: 10 archivos nombran un `*Percent`; ~10 sitios de conversión en tres anillos; 6
conceptos de porcentaje; 1 clase nueva en el kernel del dominio.

## Constitution Check

_Constitución v1.4.2. Se evalúan los once principios._

| Principio                                        | Evaluación                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | **Refuerza.** Un concepto que hoy está repartido entre tres módulos con tres severidades pasa a tener un dueño.                                                                                                                  |
| **II. Fail-closed**                              | **Refuerza.** Hoy la protección contra un porcentaje mal convertido es que `isRate` lo atrape _después_; con el valor tipado, no llega.                                                                                          |
| **III. La medición precede y no se contamina**   | **Vigilado.** El reparto de tratamiento y el holdout son porcentajes, así que la feature toca el borde de la asignación. **El algoritmo no se toca**: el fingerprint de regresión de la 007 es el juez.                          |
| **IV. Dos caminos, dos garantías**               | **Sin efecto.** Los porcentajes se leen al arrancar y al publicar configuración; el camino crítico trabaja con tasas ya resueltas.                                                                                               |
| **V. Aislamiento por merchant**                  | **Sin efecto.**                                                                                                                                                                                                                  |
| **VI. Identidad e idempotencia explícitas**      | **Roza.** US3 toca la forma de un identificador; la decisión es registrar por qué hay dos formas, no cambiar ninguna.                                                                                                            |
| **VII. OPE observa comportamiento, no personas** | **Sin efecto.**                                                                                                                                                                                                                  |
| **VIII. Cero modelos de lenguaje en runtime**    | **Sin efecto.**                                                                                                                                                                                                                  |
| **IX. Nada entra al reporte sin trazabilidad**   | **Sin efecto.** La terna de configuración que cada decisión estampa no cambia.                                                                                                                                                   |
| **X. Puertos en los dos bordes**                 | **Sin efecto.** No agrega ni quita puertos.                                                                                                                                                                                      |
| **XI. Ninguna política vive en el código**       | **Sin efecto y verificado.** El factor 100 no es una política: es la definición de la unidad, no un valor que gobierne una decisión. `check:behaviour-constants` no lo alcanza y esta feature no le agrega nada (research R-07). |

**Gate de superficie HTTP**: sin cambio de contrato. No aplica versión mayor ni prefijo.

**Gate del flujo**: spec ✅ → plan (este documento) → tareas → implementación.

**Resultado del gate**: **pasa**, antes de la fase 0 y re-evaluado después de la fase 1.

## Project Structure

### Documentation (this feature)

```text
specs/022-porcentaje-como-valor/
├── spec.md                      # Qué y por qué (ya escrita)
├── plan.md                      # Este archivo
├── research.md                  # Fase 0: R-00 … R-10
├── data-model.md                # Fase 1: el valor y sus invariantes
├── quickstart.md                # Fase 1: cómo se verifica
├── contracts/
│   └── percent.md               # Fase 1: la API del valor y dónde se cruza cada borde
├── checklists/requirements.md   # Calidad de la spec (ya escrita)
└── tasks.md                     # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/domain/shared-kernel/
├── percent.ts                   # NUEVO: la clase, con of / rate / fromRate
├── rate.ts                      # isRate / isCount se quedan como están
├── errors.ts                    # + el error de un porcentaje inválido
└── index.ts                     # exporta Percent

src/domain/
├── configuration/policy-inputs.ts     # se va isPercent, PERCENT y PERCENT_PROBLEM
├── configuration/treatment-values.ts  # se va la copia en línea del juicio
├── commercial/commercial-policy.ts    # se va PERCENT_PER_UNIT
└── experiment/experiment.ts           # PERCENT_BUCKETS se separa y se renombra

src/application/configuration/input/   # los registros de entrada declaran Percent
src/composition/experiments-config.ts  # construye Percent; se va su PERCENT
src/interface-adapters/experiment/     # controller y presenter cruzan el borde con Percent

tests/
├── typecheck/fixtures/                # + el fixture de US1
└── unit/domain/shared-kernel/         # + los bordes de la clase (0, 1, 100, 101, −1, 0.5)
```

## Complexity Tracking

Ninguna violación del Constitution Check. Dos cosas que agregan superficie y se aceptan con motivo:

| Qué agrega                                                     | Por qué se acepta                                                                                                                               | Alternativa descartada                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Una clase donde había un `number`                              | Es la única forma de que el compilador distinga las dos representaciones. Un `Branded<number>` se desarma en la primera cuenta (research R-02). | Unificar sólo la constante y el predicado: deduplica y no protege nada. |
| Los registros de entrada declaran `Percent` en vez de `number` | Sin eso la clase no sirve: olvidarse de convertir seguiría compilando (research R-01).                                                          | Construir el `Percent` en la fábrica del dominio: **no cumple FR-002**. |

## Phase 0 — Research

Completa en [research.md](./research.md). Lo que más cambió el plan:

- **R-00 corrige la premisa**: no hay defecto vivo. Los cuatro caminos dividen, y el agujero que
  parecía haber en los cortes no existe porque el bucle exige `cut > previous` desde 0.
- **R-01 es la decisión que define la feature**: el porcentaje es `Percent` **desde el lector**, no
  desde la fábrica. Con la otra opción la clase no compra nada.
- **R-03 encontró evidencia más fuerte que el factor repetido**: la misma regla está escrita tres
  veces con **tres severidades distintas**, y el mensaje de error duplicado palabra por palabra.

## Phase 1 — Design & Contracts

- **[data-model.md](./data-model.md)** — el valor, sus invariantes, y qué se queda en `number`.
- **[contracts/percent.md](./contracts/percent.md)** — la API y dónde cruza cada borde.
- **[quickstart.md](./quickstart.md)** — la verificación, comando por comando.

**Constitution Check, re-evaluado**: **pasa**. El diseño no mueve reglas de anillo, no agrega
puertos, no introduce constantes de comportamiento y no toca el camino crítico.

## Orden sugerido de implementación

1. **La clase y sus pruebas de borde** (0, 1, 100, 101, −1, 0.5), incluida la que da nombre a la
   feature: un porcentaje de 1 nunca produce la tasa 1. Verificable sola.
2. **El fixture de tipos** (US1), que ya puede escribirse.
3. **Los consumidores del dominio**: `policy-inputs`, `treatment-values`, `commercial-policy`. Acá
   desaparecen las tres severidades y dos de los cuatro nombres.
4. **`PERCENT_BUCKETS` se separa y se renombra** en `experiment.ts`, con su motivo. Es el paso más
   delicado: el fingerprint de la 007 es el juez.
5. **Los bordes**: los lectores de entrada, el controller, el presenter y la semilla.
6. **US2** (el vocabulario de estados) y **US3** (el motivo escrito de las dos formas del
   identificador), independientes de todo lo anterior.
7. **Documentación**: ADR (nuevo o enmienda de ADR-024 — lo decide quien implemente) y `CLAUDE.md`,
   donde la convención de tasas pasa de ser una regla escrita a una que el compilador sostiene.
