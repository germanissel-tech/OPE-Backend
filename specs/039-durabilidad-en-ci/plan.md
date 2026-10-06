# Implementation Plan: La durabilidad se verifica en CI

**Branch**: `039-durabilidad-en-ci` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/039-durabilidad-en-ci/spec.md`

## Summary

Lo que decide si un cambio entra pasa a ejecutar las pruebas de durabilidad de **comportamiento**, siempre y
en un lugar que se nombra solo; las que **miden** quedan declaradas como mediciones, ejecutables por su
propio comando, y una verificación de gobernanza impide que un archivo de durabilidad quede sin correr en
ningún lado.

El trabajo es de **herramientas y configuración**, no de `src/`: un job de CI, dos proyectos de Vitest sobre
el mismo directorio, una constante nombrada que reemplaza una lista escrita a mano, un script de verificación
con su prueba, y lo decidido escrito donde se busca. Nada del backend cambia — y por eso el gate de mutación
de esta feature no va a tener líneas de `src/` que juzgar.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para las pruebas; JavaScript con `checkJs` para los
scripts (ADR-011, ADR-017). YAML para el workflow.

**Primary Dependencies**: Vitest 5 (proyectos), GitHub Actions. Ninguna dependencia nueva.

**Storage**: N/A. Lo que la feature toca es dónde corren las pruebas de un almacén, no el almacén.

**Testing**: la feature **es** sobre pruebas. Lo propio de ella se verifica con `tests/governance/` (un
script `check:*` con su prueba sobre fixtures, como los trece que ya existen) y con
`tests/hooks/ci.test.ts`, que es la prueba que el repositorio ya usa para afirmar cosas del
workflow desde adentro de Vitest.

**Target Platform**: `ubuntu-latest` en CI; Windows en la máquina de desarrollo.

**Project Type**: backend de un servicio; esta feature es de su cadena de verificación.

**Performance Goals**: el reloj de pared de CI **no empeora** (SC-004): el job nuevo corre en paralelo y el
run lo sigue dominando la mutación (~20 min contra ~4 del nuevo).

**Constraints**: un archivo de durabilidad a la vez, cada uno con su almacén (FR-009); ninguna política en el
código (constitución XI); el gate de mutación sigue siendo el juez de la mutación y CI el juez (ADR-016).

**Scale/Scope**: 23 archivos de durabilidad hoy (20 de comportamiento, 3 de medición); 6 mediciones contando
las del proyecto `fast`; un job nuevo; un script nuevo; cuatro documentos a actualizar.

## Constitution Check

**Constitución v1.4.5.** Los once principios, evaluados; los que no aplican se marcan como tales y se dice
por qué, porque «no aplica» sin motivo es lo que esconde un principio que sí aplicaba.

| Principio                                        | Aplica                  | Cómo se cumple / por qué no aplica                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                      | No hay autoridad nueva ni cambia ninguna: la feature no toca `src/`.                                                                                                                                                                                                                           |
| **II. Fail-closed: `NO_OP` por defecto**         | No                      | No hay decisión ni salida al SDK. Lo análogo sí se respeta: ante la duda la verificación **falla** (un archivo que no está en ninguna categoría rompe el build), que es fail-closed aplicado al proceso.                                                                                       |
| **III. La medición precede y no se contamina**   | **Sí, y es el corazón** | La feature separa **lo que mide** de **lo que decide**, que es este principio aplicado a la cadena de verificación: un techo medido en una máquina no puede dictar si un cambio entra, y una medición que nadie corre no mide nada. R-02 tiene la tabla.                                       |
| **IV. Dos caminos, dos garantías**               | No                      | No hay camino de decisión ni de medición de producto acá.                                                                                                                                                                                                                                      |
| **V. Aislamiento por merchant**                  | No                      | No hay datos de merchant. Lo que la feature **protege** es, entre otras, la prueba de aislamiento de cada gateway durable, que hoy sólo corre de rebote.                                                                                                                                       |
| **VI. Identidad e idempotencia explícitas**      | No                      | No hay identidad ni operación repetible nueva.                                                                                                                                                                                                                                                 |
| **VII. OPE observa comportamiento, no personas** | No                      | No hay datos de personas. El job nuevo no publica artefactos con contenido de pruebas.                                                                                                                                                                                                         |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente)       | No se introduce ninguna llamada a un modelo, ni en runtime ni en la verificación.                                                                                                                                                                                                              |
| **IX. Nada entra al reporte sin trazabilidad**   | Sí                      | Lo que la feature agrega es justamente trazabilidad del proceso: un rojo que dice **qué** falló, y una declaración verificable de qué corre dónde.                                                                                                                                             |
| **X. Puertos en los dos bordes**                 | No                      | No hay borde de integración nuevo.                                                                                                                                                                                                                                                             |
| **XI. Ninguna política vive en el código**       | **Sí**                  | La lista de mediciones y la pertenencia de cada archivo a una categoría son **declaraciones** en la configuración de pruebas, no constantes sembradas en el código; y ningún valor de comportamiento del producto se agrega. El techo de cada medición se queda donde está (fuera de alcance). |

**Gates explícitos del Constitution Check** (constitución, Flujo de trabajo, punto 2):

- **¿Toca una superficie HTTP?** No. No hay cambios en `contracts/`, y por eso esta feature **no** dispara el
  orden de seis pasos de `.claude/rules/contrato.md`. `check:api-map` y `contract:diff` tienen que seguir
  verdes sin cambios.
- **¿Toca persistencia o API?** No cambia ninguna, pero **ejecuta** lo que las verifica. No hacen falta tareas
  de prueba de aislamiento nuevas: las que existen son parte de lo que el job nuevo va a correr.
- **¿Toca el plano de decisión?** No. Ni I/O de red ni escritura bloqueante: no se toca `src/`.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** No hay esquema involucrado.
- **¿Sustantivo nuevo en el contrato?** No. «Medición» y «comportamiento» son vocabulario de la cadena de
  verificación, no del dominio, así que no van a `docs/dominio/` (ADR-008 es sobre el contrato).
- **¿Toca `src/`?** **No**, y es lo que mantiene la feature chica. `npm run arch` tiene que seguir verde sin
  cambios.

**Resultado: pasa.** Ninguna complejidad que justificar: no hay módulo nuevo, no hay abstracción nueva, y lo
que se agrega —un job, un proyecto de pruebas, un `check:*`— son las tres formas que el repositorio ya usa
para lo mismo.

## Project Structure

### Documentation (this feature)

```text
specs/039-durabilidad-en-ci/
├── spec.md              # Fase previa
├── plan.md              # Este archivo
├── research.md          # Fase 0: cinco hallazgos
├── data-model.md        # Fase 1: las dos categorías y la declaración
├── quickstart.md        # Fase 1: cómo se verifica de punta a punta
└── tasks.md             # Fase 2 (/speckit-tasks)
```

**Sin `contracts/`**, y es deliberado: la feature no toca ninguna superficie HTTP. Crear el directorio vacío
diría lo contrario.

### Source Code (repository root)

Lo que la feature toca, y nada más:

```text
.github/workflows/ci.yml          # el job nuevo, en paralelo a checks y mutation
vitest.config.ts                  # MEASURED_SUITES; el proyecto durability las excluye; proyecto measures
vitest.mutation.config.ts          # importa la lista en vez de repetirla a mano
package.json                      # test:durability (comportamiento), test:measures (las mediciones)
scripts/check-suite-coverage.mjs   # toda prueba de durabilidad en exactamente una categoría
tests/governance/suite-coverage.test.ts   # su prueba, sobre fixtures
tests/hooks/ci.test.ts             # el workflow corre la durabilidad en su propio job
CLAUDE.md                          # la tabla de comandos y el ritmo de pruebas
.claude/rules/gates-de-calidad.md  # qué decide y qué mide
tests/README.md                    # el inventario de los proyectos
docs/deudas.md                     # D-35: main no tiene protección de rama
```

`src/` no aparece en esa lista, y eso es el alcance de la feature.

## Phase 1 — Diseño

### Las dos categorías, y dónde vive la declaración

`vitest.config.ts` ya exporta `TOOL_SUITES` y `DURABILITY_SUITES` y es lo que importa
`vitest.mutation.config.ts`. Se le agrega una tercera constante exportada —la **declaración de
mediciones**— y con eso:

- El proyecto `durability` **excluye** las mediciones: lo que corre es comportamiento, y es lo que el job
  nuevo ejecuta (FR-001).
- Un proyecto nuevo **incluye** sólo las mediciones de durabilidad, con la misma configuración del proyecto
  `durability` (un archivo a la vez, su propio temporal): FR-009 se cumple por construcción porque los dos
  proyectos salen del mismo objeto, no de dos copias.
- `vitest.mutation.config.ts` **importa** la lista en lugar de repetirla, que es lo que hoy permite que un
  archivo quede sin correr sin que nadie se entere.
- El proyecto `fast` no cambia: sus tres mediciones siguen corriendo ahí (R-02, SC-005).

### El job de CI

Un job propio, en paralelo a `checks` y a `mutation`, con la misma condición de disparo que los otros dos
(no en el schedule; no en una PR del mismo repositorio, porque el push ya la verificó) y el mismo arranque
(checkout, Node de `.nvmrc`, `npm ci`). Sin `fetch-depth: 0` y sin traer `main`: no compara contra nada.
`timeout-minutes` del orden de los otros, con la medición de esta máquina como referencia y margen para un
runner más lento.

Lo que **no** lleva: no publica artefactos (no hay reporte que leer), no usa caché de mutación, no corre
`build` ni el contrato — esas son del job que ya existe.

### La verificación de gobernanza

Un script `check:*` con su prueba sobre fixtures, como los trece que ya existen. Lee los archivos de
`tests/durability/` del disco y las dos categorías de la configuración, y falla:

1. nombrando el archivo que no está en ninguna de las dos;
2. nombrando la medición declarada que ya no existe en el disco.

Los dos sentidos, que es la forma que el repositorio usa para las instrucciones y los inventarios de los
README. Entra a la cadena `quality`, que es donde viven los `check:*` que fallan el build.

### Lo que queda escrito

CLAUDE.md (la tabla de comandos y el ritmo de dos velocidades), `.claude/rules/gates-de-calidad.md` (qué
decide y qué mide, que es la regla y pertenece ahí), el inventario de `tests/README.md` (el proyecto nuevo
gana su fila) y `docs/deudas.md` con **D-35**.

### D-35, encontrada por R-04

`main` no tiene protección de rama: nada **impide** mergear con CI en rojo. La feature no la puede cerrar —es
una configuración del repositorio y una decisión sobre quién mergea y qué jobs son obligatorios, incluido si
se exige el de mutación que tarda 20 min— así que queda anotada con su nombre en vez de quedar implícita en
FR-003, que el workflow no puede cumplir solo.

## Complexity Tracking

Nada que justificar. Las tres piezas nuevas —un job, un proyecto de pruebas, un `check:*` con su prueba— son
las formas que el repositorio ya usa para exactamente esto, y la feature **borra** una lista escrita a mano
en vez de agregar una.
