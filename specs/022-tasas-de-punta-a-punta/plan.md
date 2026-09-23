# Implementation Plan: El backend habla en tasas, adentro y afuera

**Branch**: `022-tasas-de-punta-a-punta` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-tasas-de-punta-a-punta/spec.md`

## Summary

El contrato deja de declarar porcentajes enteros: los ocho campos que hoy van de 0 a 100 pasan a ser
tasas de 0 a 1 y toman los nombres que el sistema ya usa adentro (`treatmentShare`, `holdoutShare`,
`maxIncentiveShare`, `incentiveLadderShare`, `marginShare`). Con una sola unidad, **la conversión
desaparece**: se borran las cuatro constantes del factor, las tres lecturas distintas de "esto es un
porcentaje válido" y todas las multiplicaciones y divisiones que cambiaban de unidad.

**Es una feature que quita más de lo que pone.** No hay clase nueva, ni puerto, ni gate: queda
`isRate` —que ya existe y ya usan cuatro módulos— como único juez, y la granularidad del reparto,
que compartía valor con el factor sin tener nada que ver, se queda con nombre propio.

Cambia el contrato de forma incompatible, y es la ventana para hacerlo: ningún merchant lo consume
y la marca de construcción lo permite sin salto de versión mayor (ADR-003).

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`); API 6.0 para el tooling (ADR-017).
`strict`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, sin `any`.

**Primary Dependencies**: ninguna nueva.

**Storage**: no aplica.

**Testing**: Vitest (`fast`, `tools`), Schemathesis contra el servidor levantado, Stryker.

**Target Platform**: Node 22.

**Project Type**: servicio backend en anillos (ADR-013) con contrato como fuente de verdad.

**Performance Goals**: sin cambio; se quitan operaciones, no se agregan.

**Constraints**: el algoritmo de asignación intacto —la prueba de regresión de la feature 007 es el
juez—; `Lint exceptions: 0`; el diff del contrato limitado **exactamente** a los ocho campos.

**Scale/Scope**: 7 esquemas del contrato, 8 campos, ~10 sitios de conversión en tres anillos, los
archivos de configuración versionados, los fixtures y el cliente tipado.

## Constitution Check

_Constitución v1.4.2. Se evalúan los once principios._

| Principio                                        | Evaluación                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | **Refuerza.** Un concepto repartido entre tres módulos con tres severidades deja de existir.                                                                                                                                                                                  |
| **II. Fail-closed**                              | **Refuerza.** Hoy la protección contra un valor mal convertido es que otro juez lo atrape _después_; sin conversión no hay nada que atrapar tarde.                                                                                                                            |
| **III. La medición precede y no se contamina**   | **El principio que esta feature más roza.** El reparto de tratamiento y el holdout cambian de unidad en el contrato y adentro. **El algoritmo no se toca**, y la prueba de regresión de la 007 —mismos visitantes, mismos brazos— es condición de cierre. Si cambia, se para. |
| **IV. Dos caminos, dos garantías**               | **Sin efecto.** No hay I/O nueva ni trabajo agregado en el camino crítico; se quitan operaciones aritméticas.                                                                                                                                                                 |
| **V. Aislamiento por merchant**                  | **Sin efecto.** No se toca de dónde sale el merchant ni dónde aparece.                                                                                                                                                                                                        |
| **VI. Identidad e idempotencia explícitas**      | **Roza.** US4 toca la forma de un identificador; la decisión es registrar por qué hay dos formas, no cambiar ninguna.                                                                                                                                                         |
| **VII. OPE observa comportamiento, no personas** | **Sin efecto.**                                                                                                                                                                                                                                                               |
| **VIII. Cero modelos de lenguaje en runtime**    | **Sin efecto.**                                                                                                                                                                                                                                                               |
| **IX. Nada entra al reporte sin trazabilidad**   | **Sin efecto.** La terna de configuración que cada decisión estampa no cambia de forma.                                                                                                                                                                                       |
| **X. Puertos en los dos bordes**                 | **Sin efecto.**                                                                                                                                                                                                                                                               |
| **XI. Ninguna política vive en el código**       | **Sin efecto.** Ningún valor que gobierna comportamiento se mueve al código: los mismos valores siguen en los mismos archivos, expresados en otra unidad.                                                                                                                     |

### Gate de superficie HTTP — **éste es el que aplica**

El cambio **es incompatible**: renombra y retipa ocho campos en siete esquemas. La constitución (V,
v1.2.0) exige versión mayor y prefijo nuevo, **salvo** la excepción declarada de ADR-003: mientras
`info.x-stability: building` esté puesta —ningún merchant consume el contrato— entra con bump
**MINOR** y el prefijo se conserva; `contract:diff` lo reporta y lo acepta, y `release-check` avisa.

**Decisión**: `info.version` de `1.4.0` a **`1.5.0`**, prefijo `/v1/` intacto. Verificado que la
marca está puesta hoy.

**Condición que el gate impone**: el diff tiene que limitarse a los ocho campos. Cualquier otro
cambio incompatible que aparezca es alcance que se escapó.

### Gate del flujo

spec ✅ → plan (este documento) → tareas → implementación. La spec se reescribió dos veces antes de
llegar acá; el recorrido está en `research.md` R-02.

**Resultado del gate**: **pasa**, con la excepción de ADR-003 invocada explícitamente y su
condición escrita.

## Project Structure

### Documentation (this feature)

```text
specs/022-tasas-de-punta-a-punta/
├── spec.md                      # Qué y por qué (reescrita)
├── plan.md                      # Este archivo
├── research.md                  # Fase 0: R-00 … R-11, con el recorrido descartado
├── data-model.md                # Fase 1: la unidad y qué deja de existir
├── quickstart.md                # Fase 1: cómo se verifica
├── contracts/
│   └── rates.md                 # Fase 1: campo por campo, antes y después
├── checklists/requirements.md   # Calidad de la spec (reescrita)
└── tasks.md                     # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
contracts/
├── openapi.yaml                          # info.version → 1.5.0
└── components/schemas/                   # 7 esquemas, 8 campos: renombrados y retipados

config/
├── treatment-defaults.json               # los valores, en la unidad nueva
└── dev-merchants.json                    # idem

src/domain/
├── configuration/policy-inputs.ts        # se van isPercent, PERCENT, PERCENT_PROBLEM y FIELD_BY_SHARE
├── configuration/treatment-values.ts     # se va la copia en línea del juicio
├── commercial/commercial-policy.ts       # se va PERCENT_PER_UNIT y la conversión de salida
└── experiment/experiment.ts              # PERCENT_BUCKETS se renombra; bucketsOf se replantea en tasas

src/application/configuration/input/      # los lectores juzgan una tasa, no un porcentaje
src/composition/experiments-config.ts     # se va su PERCENT; el vocabulario de estados se importa
src/interface-adapters/experiment/        # controller y presenter dejan de convertir
client/index.ts                           # el cliente tipado refleja la unidad nueva

tests/                                    # las aserciones cambian de unidad, no de significado
```

## Complexity Tracking

Ninguna violación del Constitution Check que justificar; la excepción de ADR-003 está invocada y
escrita arriba. Dos cosas que conviene anotar:

| Qué                                                  | Por qué se acepta                                                                                                            | Alternativa descartada                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Un cambio incompatible del contrato                  | Es la ventana: ningún merchant consume y la marca de construcción lo permite. Después sería con merchants adentro.           | Mantener los dos formatos y convertir: es exactamente lo que la feature elimina.         |
| El contrato se vuelve **más permisivo** en precisión | Restringir a múltiplos de un centésimo es frágil con punto flotante (research R-05). Se documenta a qué resuelve el sistema. | `multipleOf: 0.01`: una regla que a veces rechaza un valor legítimo es peor que ninguna. |

## Phase 0 — Research

Completa en [research.md](./research.md). Lo que más pesó:

- **R-01 fue la evidencia decisiva**: la misma regla escrita tres veces con **tres severidades
  distintas**, y el mensaje de error duplicado palabra por palabra entre dos módulos del dominio.
- **R-02 conserva las dos formulaciones descartadas**, que son lo que explica esta: encapsular la
  conversión y luego acorralarla mejoraban algo que no debía existir.
- **R-07 marca el riesgo real de la implementación**: la comparación del reparto contra el holdout
  pasa hoy por enteros y hay que reescribirla en tasas dando el mismo veredicto.

## Phase 1 — Design & Contracts

- **[data-model.md](./data-model.md)** — la unidad, lo que deja de existir y lo que se queda.
- **[contracts/rates.md](./contracts/rates.md)** — campo por campo, antes y después.
- **[quickstart.md](./quickstart.md)** — la verificación, comando por comando.

**Constitution Check, re-evaluado**: **pasa**. El diseño no mueve reglas de anillo, no agrega
puertos ni constantes de comportamiento, y el único principio que roza —la medición— queda cubierto
por una prueba de regresión que ya existe.

## Orden sugerido de implementación

1. **El contrato**: los ocho campos en los siete esquemas, el bump a `1.5.0`, los ejemplos y las
   descripciones —incluida la de FR-008, que dice a qué granularidad resuelve el sistema—. Después,
   `contract:check` y los tipos regenerados. Nada más compila hasta que esto esté.
2. **El dominio**: se borran las cuatro constantes, `isPercent`, el mensaje duplicado y el mapa de
   nombres. `isRate` queda solo.
3. **La granularidad del reparto**, renombrada, y la comparación contra el holdout reescrita en
   tasas. **Es el paso delicado**: la prueba de regresión de la 007 se corre acá, no al final.
4. **Los bordes**: lectores, controller, presenter, semilla y cliente tipado.
5. **Los datos versionados**: configuración por defecto, merchants de desarrollo y fixtures.
6. **US3** (el vocabulario de estados) y **US4** (el motivo escrito), independientes.
7. **Documentación**: ADR (nuevo o enmienda de ADR-024 — lo decide quien implemente), `CLAUDE.md`
   —donde la convención "porcentajes sólo en el borde" deja de existir porque no hay porcentajes— y
   el README de `contracts/` si hace falta.
