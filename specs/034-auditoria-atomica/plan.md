# Implementation Plan: Una acción administrativa y su entrada de auditoría se commitean juntas

**Branch**: `034-auditoria-atomica` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-auditoria-atomica/spec.md`

## Summary

Una acción de administración y su entrada de auditoría pasan a aplicarse como **una sola unidad de
trabajo** sobre el almacén durable: o las dos quedan, o ninguna. Con eso se cierra la ventana que
ADR-034 declara abierta y se salda lo que queda de **D-28**.

El camino: el almacén gana una unidad de trabajo asincrónica —que **conserva** su transacción síncrona
tal como está— y un turno que los gateways esperan antes de tocarlo; el decorador de auditoría cambia su
consulta previa por esa unidad; y la cola del registro de eventos, que no puede esperar a nadie, aprende
a preguntar si el almacén está ocupado y a reintentar. Ni los casos de uso ni el dominio cambian.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en modo `strict`, sobre Node 24 (ADR-017).

**Primary Dependencies**: ninguna nueva. Entra al repositorio `AsyncLocalStorage` de `node:async_hooks`,
que es biblioteca estándar y va en `infrastructure/` (ADR-013).

**Storage**: SQLite por `node:sqlite` (`DatabaseSync`, síncrono), en WAL. **Sin migración**: esta feature
no agrega ni cambia ninguna tabla.

**Testing**: Vitest. Lo que sólo se ve contra un almacén de verdad vive en el proyecto `durability`; el
comportamiento, en `fast`. Stryker para el gate de mutación, acotado al diff.

**Target Platform**: un proceso, servidor Linux o Windows; el despliegue local en memoria y el durable
sobre archivo.

**Project Type**: servicio HTTP con arquitectura por anillos (ADR-013).

**Performance Goals**: `01 §4.6` propone 150 ms para el camino crítico completo y lo marca como objetivo
de diseño. Lo que esta feature tiene que demostrar es más acotado: que una acción de administración
concurrente **no empeora de forma apreciable** el p95 de la ingesta (SC-002).

**Constraints**: sin I/O de red ni escrituras bloqueantes en el camino crítico de decisión (principio
IV); ninguna llegada del registro de eventos se pierde por un almacén ocupado (SC-003); el contrato no
cambia.

**Scale/Scope**: 13 gateways durables y 54 sitios que tocan el almacén; 10 operaciones auditadas; un
decorador; una cola.

## Constitution Check

_Constitución **v1.4.4**. Se evalúan los once principios; los que no aplican se marcan como tales._

| Principio                                           | Veredicto                                             | Por qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                    | ✅ cumple                                             | Ninguna autoridad cambia de dueño. La unidad de trabajo es un puerto del kernel y quien la abre es el decorador, que ya es del kernel; ningún caso de uso la conoce.                                                                                                                                                                                                                                                                                                                          |
| **II. Fail-closed**                                 | ✅ cumple, y la refuerza                              | Una acción que no se pudo auditar deja de existir en vez de quedar a medias. Y del lado de la decisión, un almacén **ocupado** no es un almacén que falla: FR-007 prohíbe degradar por esa causa, que sería fail-closed contra el motivo equivocado.                                                                                                                                                                                                                                          |
| **III. La medición precede y no se contamina**      | ✅ cumple                                             | No cambia qué se mide ni cuándo. La entrada de auditoría es lo mismo que hoy; lo que cambia es cuándo queda firme.                                                                                                                                                                                                                                                                                                                                                                            |
| **IV. Dos caminos, dos garantías**                  | ⚠️ **excepción declarada**                            | Una unidad abierta **hace esperar** a los gateways del camino de decisión. Es una espera por un lock local y acotada por la acción que la abrió, no I/O de red — y es la cuarta vez que este camino se ata a algo durable (ADR-038, ADR-040, ADR-041). Se declara con su medición: SC-002 es la condición de aceptación. Lo que **no** se acepta es que la cola del registro espere: eso sería la contaminación que el principio prohíbe, y R-04 la resuelve preguntando en vez de esperando. |
| **V. Aislamiento por merchant**                     | ✅ cumple                                             | La unidad es del proceso, no de un merchant, y no cruza datos: lo que revierte es lo que la acción escribió. FR-009 lo exige y la suite de aislamiento lo verifica a través de una reversión.                                                                                                                                                                                                                                                                                                 |
| **VI. Identidad explícita, idempotencia explícita** | ✅ cumple                                             | No toca ninguna identidad. La idempotencia de cada tabla la sigue decidiendo su clave dentro de la transacción síncrona, que **no cambia**.                                                                                                                                                                                                                                                                                                                                                   |
| **VII. OPE observa comportamiento, no personas**    | ➖ no aplica                                          | No se agrega ni se mueve ningún dato. La entrada de auditoría nombra un operador de OPE, que ya es lo que nombra hoy.                                                                                                                                                                                                                                                                                                                                                                         |
| **VIII. Cero modelos de lenguaje en runtime**       | ➖ no aplica                                          | Ninguna inferencia, ningún modelo.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **IX. Nada entra al reporte sin trazabilidad**      | ✅ cumple, **y es el principio que la feature sirve** | Hoy la trazabilidad de una acción de administración depende de que el registro no se caiga en el medio. Después de esto, un efecto sin su entrada no puede existir.                                                                                                                                                                                                                                                                                                                           |
| **X. Puertos en los dos bordes**                    | ✅ cumple                                             | La unidad de trabajo es un puerto nuevo del kernel de aplicación con dos implementaciones (memoria y durable), enlazadas por tecnología como todo lo demás (ADR-033). Ningún caso de uso lo toca.                                                                                                                                                                                                                                                                                             |
| **XI. Ninguna política vive en el código**          | ✅ cumple                                             | No hay ningún valor de comportamiento nuevo. Si el reintento de la cola necesitara un intervalo, ya existe como configuración del despliegue (`eventLog.flushIntervalMs`) y se reusa; no se inventa una constante.                                                                                                                                                                                                                                                                            |

**Veredicto**: pasa con **una excepción declarada** (principio IV), que es la misma clase de excepción que
el hito ya registró tres veces y que esta feature mide antes de aceptar.

## Project Structure

### Documentation (this feature)

```text
specs/034-auditoria-atomica/
├── plan.md              # Este archivo
├── research.md          # Fase 0: cinco preguntas, dos correcciones al diseño derivado
├── data-model.md        # Fase 1: las formas nuevas, y por qué no hay migración
├── quickstart.md        # Fase 1: cómo se verifica
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

**No hay `contracts/` y es deliberado**: ninguna operación se agrega ni cambia, y las diez auditadas ya
declaran `503` (verificado en R-01). El orden de seis pasos de `.claude/rules/contrato.md` no se dispara.

### Source Code (repository root)

```text
src/
├── application/shared-kernel/
│   ├── ports/
│   │   ├── unit-of-work.ts            # NUEVO: la unidad de trabajo, puerto del kernel
│   │   └── audit-trail.ts             # `writable()` se va
│   └── decorators/audited-use-case.ts # la consulta previa se cambia por la unidad
├── interface-adapters/
│   ├── shared-kernel/
│   │   ├── durable-store.ts           # el turno de TODAS las escrituras, en una línea
│   │   ├── sql-store.ts               # el vocabulario gana la unidad, el turno y la pregunta
│   │   └── unit-of-work.ts            # NUEVO: las dos implementaciones del puerto
│   ├── */gateways/sqlite-*.ts         # el turno de cada lectura
│   └── ingestion/queue/event-log-queue.ts # el flush que pregunta y reintenta
├── infrastructure/sqlite/open-store.ts    # `AsyncLocalStorage`, la unidad y el guardia
└── composition/modules/shared-kernel.ts   # el enlace del puerto nuevo, por tecnología

tests/
├── unit/                              # la unidad de trabajo y el decorador, con dobles
├── integration/                       # lo que cambia al irse `writable()`
└── durability/                        # la atomicidad, la concurrencia y SC-002
```

**Structure Decision**: sin estructura nueva. Lo único que se agrega son dos archivos —un puerto y su
adaptador— en directorios que ya existen, y el resto son ediciones en su lugar.

## Complexity Tracking

| Violation                                                | Why Needed                                                                                                                                                                                                                               | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Principio IV: el camino de decisión espera un lock local | Es la única forma de unir dos escrituras del mismo almacén sin partir todos los casos de uso de administración (R-05 de la 033). Sin eso, la regla de ADR-034 sigue siendo cierta sólo en el caso barato                                 | Una segunda conexión para administración es **deadlock** (`DatabaseSync` bloquea el bucle esperando el lock); partir cada caso de uso en «decidir» y «escribir» cambia la forma de los diez más el decorador; y «en realidad nadie se interpone» es falso porque la cola de microtareas no es de una sola petición |
| `AsyncLocalStorage`, tecnología nueva en el repositorio  | Es lo que distingue «estoy dentro de mi propia unidad» de «estoy dentro de la de otro», y sin esa distinción el guardia de R-03 no puede existir: un gateway que olvide el turno escribiría dentro de la transacción de otro en silencio | Un flag global no distingue al dueño de la unidad de quien la encontró abierta, así que o bloquea al dueño (deadlock) o no protege a nadie                                                                                                                                                                         |

## Fase 0 — Investigación

Cinco preguntas en [research.md](./research.md). Dos cambian piezas del diseño que D-28 traía derivado, y
las dos salieron de mirar el código: **cómo se revierte sin un `catch` en `application/`** (el trabajo
recibe cómo abortar y la unidad responde un `Result`) y **que «una línea por gateway» son dos casos**
(las escrituras ya están centralizadas en un solo lugar; las lecturas no).

## Fase 1 — Diseño

[data-model.md](./data-model.md) y [quickstart.md](./quickstart.md).

Lo que el diseño confirma y conviene decir: **esta feature no toca el dominio ni los casos de uso**, no
agrega ninguna tabla y no cambia ninguna respuesta. Todo lo que cambia está en el kernel de aplicación,
en el anillo de adaptadores y en la infraestructura — que es exactamente el reparto que hace que se pueda
hacer sin tocar las diez operaciones.

## Constitution Check — re-evaluación después del diseño

Sin cambios: los once principios siguen como arriba, con la misma excepción declarada en el IV. El diseño
la acota más de lo que la spec prometía, y vale decir por qué: la espera del camino de decisión no es
«mientras haya una acción de administración» sino **mientras una unidad esté abierta**, y FR-012 obliga a
que ninguna acción pueda dejar una abierta detrás de sí.

Lo que el diseño agrega y el Constitution Check tiene que registrar: **el principio IV se protege en dos
direcciones**. Que el camino de decisión espere está declarado y medido; que la cola del registro **no**
espere es una obligación, no una optimización, y si alguien le pusiera un `await` ahí el principio se
rompería sin que ninguna medición lo notara.
