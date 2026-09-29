# Implementation Plan: Nada de lo que se configuró u observó se pierde en un reinicio

**Branch**: `033-configuracion-durable` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md) · [research.md](./research.md)

## Summary

Seis almacenes que hoy viven en memoria pasan al almacén durable —merchants con sus orígenes y credenciales, la configuración con todas sus versiones, los experimentos, el registro de administración, el diagnóstico de anclajes y los valores sin mapear— y la ventana de deduplicación se vuelve **recuperable** con el patrón de la feature 032. El comportamiento observable de la API no cambia: lo que cambia es cuánto dura.

**Dos resultados de la investigación gobiernan el plan:**

1. **El camino caliente se resuelve con un índice en memoria sobre un almacén que es la fuente** (R-02), y no consultando por petición. El argumento no es el costo de hoy sino el de mañana: consultar pone **un viaje de red por petición** el día que el almacén sea remoto (**D-21**).
2. **La historia 4 —la auditoría atómica— no entra** (R-05). El obstáculo es verificable: `SqlStore.transaction` es síncrona y el caso de uso es asincrónico. Al tensionarlo apareció una salida que **no deforma el diseño** —un ámbito de transacción asincrónico con el almacén haciendo la cola, en la enmienda de R-05— y el motivo de dejarla afuera pasó a ser de alcance y no de imposibilidad: esta feature ya tiene su propio riesgo de camino caliente y dos riesgos de latencia se estorban al medirlos. Queda como **D-28**, con su diseño escrito, y comparte el mismo puerto con la atomicidad del presupuesto por sesión — lo que las vuelve una feature y no dos.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para `build` y `typecheck`; `typescript` es el alias de la API 6.0 que consumen las herramientas (ADR-017).

**Primary Dependencies**: ninguna nueva. `node:sqlite` ya está en uso desde la feature 030.

**Storage**: el mismo almacén SQLite de las tres features anteriores, con una migración `004` que **sólo crea** — es la primera de la serie que no reconstruye ninguna tabla.

**Testing**: Vitest. Proyecto `fast` para lo que no depende del almacenamiento; proyecto `durability` para todo lo que cruza un reinicio, que acá es casi todo. Stryker sobre el diff.

**Target Platform**: un proceso Node 24 sobre un archivo local (**D-21**).

**Project Type**: servicio HTTP con cuatro anillos (ADR-013).

**Performance Goals**: la latencia de la ingesta no empeora de forma apreciable (SC-002), medida como el p95 con el almacén durable contra el mismo con todo en memoria en la misma corrida. Y la reconstrucción de la ventana de deduplicación no aparece en la latencia por evento (SC-006).

**Constraints**: sin I/O de red en el camino crítico de decisión. Esta feature pone una **lectura local** en el borde de autenticación de todo request y lo declara como excepción, con el trato de ADR-038 y ADR-040 — nombrada, medida contra la única base que hay, y con su costo real abierto hasta que exista el gateway remoto.

**Scale/Scope**: seis gateways durables, una migración, una lectura nueva en el registro de eventos, un índice en memoria, y una línea de log en el arranque. El contrato **no cambia**.

## Constitution Check

_GATE: se evalúan los **once** principios, también los que no aplican. Constitución **v1.4.4**._

| #    | Principio                                   | Veredicto                              | Por qué                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Separación de autoridades                   | **Cumple**                             | ningún gateway gana una decisión. Un almacén guarda y devuelve; quién decide sigue siendo el dueño de la regla. El índice en memoria de R-02 es una vista, no una autoridad                                                                                                                                    |
| II   | Fail-closed: `NO_OP` por defecto            | **Cumple**                             | las escrituras ya responden `StoreUnavailable` y los consumidores ya degradan (ADR-021). Esta feature no agrega un camino donde una falla intervenga                                                                                                                                                           |
| III  | La medición precede y no se contamina       | **Cumple, y mejora**                   | hoy un deploy borra el diagnóstico de anclajes y los valores sin mapear, que son medición. Hacerlos durables es lo que este principio pide                                                                                                                                                                     |
| IV   | Dos caminos, dos garantías                  | **Excepción declarada**                | pone una lectura local en el borde de autenticación de **todo** request. Es la tercera excepción de esta serie y la más caliente; se declara con el trato de ADR-038 y ADR-040 y **su ADR es un entregable de esta feature**. La deduplicación se resuelve como _recuperable_ justo para no agregar una cuarta |
| V    | Aislamiento por merchant                    | **Cumple, y es la prueba obligatoria** | toda tabla lleva el merchant y toda lectura lo toma. La unicidad global de origen es la excepción deliberada: es una unicidad **entre** merchants, que es lo que el aislamiento necesita para que un origen no hable por dos                                                                                   |
| VI   | Identidad explícita, idempotencia explícita | **Cumple**                             | las cuatro identidades se conservan. `merchant_origins` existe para que la unicidad la haga cumplir un índice y no una lectura previa, que es la carrera que `01 §6` prohíbe                                                                                                                                   |
| VII  | OPE observa comportamiento, no personas     | **Cumple**                             | ningún campo nuevo de dato personal: identificadores, orígenes, huellas de credencial y qué operador hizo qué. El gate lo verifica igual                                                                                                                                                                       |
| VIII | Cero modelos de lenguaje en runtime         | **No aplica**                          | esta feature no toca inferencia ni texto generado                                                                                                                                                                                                                                                              |
| IX   | Nada entra al reporte sin trazabilidad      | **Cumple, y mejora**                   | una decisión referencia la versión de configuración con que se tomó, y hoy esa versión desaparece en un deploy. Y el registro de administración deja de perderse. Lo que **no** cierra es la ventana de ADR-034 (R-05), dicho de frente                                                                        |
| X    | Puertos en los dos bordes                   | **Cumple**                             | seis puertos ya existen y no cambian de forma; lo que se agrega son implementaciones. La única forma que cambia es una lectura nueva en el registro de eventos, que es del dueño de ese puerto                                                                                                                 |
| XI   | Ninguna política vive en el código          | **Cumple**                             | ningún valor de comportamiento nuevo. El tope de la ventana de deduplicación y su TTL siguen siendo del nivel 1; la reconstrucción los **lee**, no los redefine                                                                                                                                                |

**Puertas del flujo**: spec y plan antes de implementar (hecho). Pruebas antes de la implementación en los pares que la lista de tareas marque. Cadena de gates antes de cerrar.

**Re-evaluación después de la fase 1**: ver el final de este documento.

## Project Structure

### Documentation (this feature)

```text
specs/033-configuracion-durable/
├── spec.md              # Fase de especificación
├── research.md          # Fase 0 — seis preguntas, dos deciden la forma
├── plan.md              # Este archivo
├── data-model.md        # Fase 1 — las siete tablas y la reconstrucción de la ventana
├── quickstart.md        # Fase 1 — cómo verificarlo, terminando en usarlo
└── checklists/
    └── requirements.md
```

**No hay `contracts/` en esta feature, y es deliberado**: el contrato no cambia. Las 21 operaciones de administración responden lo mismo, no se agrega ninguna, no se agrega ningún motivo de `NO_OP` ni ningún tipo de problema. El orden de seis pasos de `.claude/rules/contrato.md` no se dispara porque no hay superficie HTTP nueva — y que eso se diga explícitamente es lo que evita que alguien busque el archivo que falta.

### Source Code (repository root)

```text
migrations/
└── 004-*.sql                                   # siete tablas; la primera de la serie que sólo crea

src/application/
├── ingestion/ports/event-log.ts                # + la lectura de ids por merchant y ventana
└── ingestion/ports/event-dedup.ts              # sin cambio de forma; el gancho es su implementación

src/interface-adapters/
├── merchant/gateways/sqlite-merchant-store.ts   # + el índice en memoria de R-02
├── configuration/gateways/sqlite-configuration-store.ts
├── experiment/gateways/sqlite-experiment-store.ts
├── admin/gateways/sqlite-admin-log.ts
├── admin/gateways/sqlite-anchor-diagnostics-store.ts
├── admin/gateways/sqlite-unmapped-value-log.ts
├── ingestion/gateways/sqlite-event-log.ts       # + la lectura nueva
└── ingestion/gateways/recovering-event-dedup.ts # la ventana que se reconstruye al primer tráfico

src/composition/
├── deployments/durable.ts                       # los módulos que pasan a .with("sqlite")
├── modules/{merchant,configuration,experiment,admin,access,ingestion}.ts
└── bootstrap.ts                                 # la línea que el arranque no dice

tests/durability/                                # casi todo el peso de la feature
tests/unit/interface-adapters/                   # el índice, la reconstrucción, la lectura nueva
docs/adr/041-*.md                                # la tercera excepción al principio IV
```

**Structure Decision**: la de siempre (ADR-013), sin módulos nuevos ni entradas nuevas en `CONTEXT_MAP`. Los seis módulos ya existen y ya tienen su variante en memoria; lo que se agrega es la variante `sqlite` de cada uno y la tecnología elegida en `deployments/durable.ts`. El único archivo con una forma que no existe hoy es `recovering-event-dedup.ts`, que envuelve la deduplicación en memoria como `queuedEventLog` envuelve el registro.

## Complexity Tracking

| Violación                                                                     | Por qué se necesita                                                                              | Alternativa más simple, y por qué se rechaza                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lectura local en el borde de autenticación de todo request** (principio IV) | sin ella, un merchant creado por la API no existe después de un deploy, que es la feature entera | no hacer la feature. Lo que se rechaza es la _forma_ caliente: consultar el almacén por petición, porque contra un almacén remoto es un viaje de red por request (R-02) |
| **Un índice en memoria sobre el almacén**                                     | evita esa lectura en el camino caliente sin renunciar a que el almacén sea la fuente             | consultar por petición: más simple de escribir y **peor donde importa**. Rechazada por lo que cuesta contra PostgreSQL, no por lo que cuesta hoy                        |
| **Los orígenes en su propia tabla**, fuera del documento                      | la unicidad de origen entre todos los merchants la tiene que hacer cumplir un índice             | guardarlos en el documento y comprobar leyendo antes de escribir: es la carrera entre comprobación y escritura que `01 §6` prohíbe                                      |
| **Una lectura nueva en el registro de eventos**                               | la ventana de deduplicación no se puede reconstruir con las cuatro lecturas que hay (R-03)       | usar `volume`, que devuelve conteos por tipo y no identificadores. No sirve                                                                                             |

**Lo que no está en esta tabla porque no es complejidad sino alcance**: la historia 4 sale de la feature (R-05). No se justifica una violación; se dice que no entra y por qué.

---

## Fase 0 — Investigación

Completa en [research.md](./research.md). Seis preguntas: cuánto ya existe (R-01), el camino caliente (R-02), la reconstrucción de la ventana (R-03), el esquema (R-04), **por qué la auditoría atómica no entra** (R-05) y qué tiene que decir el arranque (R-06).

## Fase 1 — Diseño

- [data-model.md](./data-model.md) — las siete tablas con lo propio de cada una, el índice en memoria y la reconstrucción de la ventana. Ninguna entidad nueva: las seis ya existen y ninguna cambia de forma.
- [quickstart.md](./quickstart.md) — siete pasos, el último usando el servidor: dar de alta un merchant, apagar, prender, y que siga ahí.
- **Sin `contracts/`**, por el motivo de arriba.

## Constitution Check — re-evaluación después del diseño

Ningún veredicto cambia, y dos se confirman con lo que el diseño concretó:

- **Principio V** se refuerza: cada una de las siete tablas lleva el merchant en su clave de búsqueda, y la única unicidad global —el origen— es la que el aislamiento necesita para que un origen no hable por dos merchants.
- **Principio IV** sigue siendo la única excepción, y el diseño la **reduce** respecto de lo que la spec temía: la deduplicación, que se consulta por evento y habría sido la excepción más caliente de todas, se resuelve como recuperable y no toca el almacén por evento.

**Y una cosa que el diseño confirma y conviene decir**: no hay ninguna entidad nueva ni ningún cambio de forma en las seis que se guardan. Esta feature es de infraestructura y de arranque, no de dominio — el dominio ya estaba listo para que alguien guardara sus entidades, con su `record()` y su `rehydrate` (ADR-024).

---

## Qué habrá que traducir al cambiar de motor

**Mudado a `migrations/README.md` al cerrar la feature (2026-09-29), como esta sección misma decía que
iba a pasar.** El inventario no caduca con la feature y un plan se archiva con ella; el README es
documento vivo y tiene un gate que lo verifica. Lo que se mudó: qué viaja igual, la tabla de las cinco
construcciones que hay que traducir, la suposición que el DDL no muestra —los instantes como texto ISO
comparados lexicográficamente—, lo que la migración `002` ya saldó y las tres decisiones del esquema que
no dependen del motor.

Lo que esta feature agregó al inventario: **ninguna dependencia nueva del motor**, sólo más `strftime` y
más `AUTOINCREMENT`. Y una nota que sí es de acá: R-05 dejó afuera la auditoría atómica porque
`SqlStore.transaction` es síncrona, y lo que el cambio de motor aporta ahí no es la solución sino
**simplificarla** — con un pool asincrónico, `scope` es `BEGIN`/`COMMIT` y el `enter()` que hace la cola
desaparece. El puerto sobrevive al cambio de motor, así que hacerlo antes no es trabajo que se tire, y
tampoco urge adelantarlo (**D-28**).
