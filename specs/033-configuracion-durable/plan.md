# Implementation Plan: Nada de lo que se configuró u observó se pierde en un reinicio

**Branch**: `033-configuracion-durable` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: [spec.md](./spec.md) · [research.md](./research.md)

## Summary

Seis almacenes que hoy viven en memoria pasan al almacén durable —merchants con sus orígenes y credenciales, la configuración con todas sus versiones, los experimentos, el registro de administración, el diagnóstico de anclajes y los valores sin mapear— y la ventana de deduplicación se vuelve **recuperable** con el patrón de la feature 032. El comportamiento observable de la API no cambia: lo que cambia es cuánto dura.

**Dos resultados de la investigación gobiernan el plan:**

1. **El camino caliente se resuelve con un índice en memoria sobre un almacén que es la fuente** (R-02), y no consultando por petición. El argumento no es el costo de hoy sino el de mañana: consultar pone **un viaje de red por petición** el día que el almacén sea remoto (**D-21**).
2. **La historia 4 —la auditoría atómica— no entra** (R-05), y el motivo es verificable: `SqlStore.transaction` es síncrona y el caso de uso es asincrónico, así que no hay forma de componer la transacción sin volver la auditoría no transversal. La spec autorizó este resultado. Comparte causa raíz con la atomicidad del presupuesto por sesión, y las dos quedan como una feature del hito.

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
├── data-model.md        # Fase 1 — las seis tablas y la reconstrucción de la ventana
├── quickstart.md        # Fase 1 — cómo verificarlo, terminando en usarlo
└── checklists/
    └── requirements.md
```

**No hay `contracts/` en esta feature, y es deliberado**: el contrato no cambia. Las 21 operaciones de administración responden lo mismo, no se agrega ninguna, no se agrega ningún motivo de `NO_OP` ni ningún tipo de problema. El orden de seis pasos de `.claude/rules/contrato.md` no se dispara porque no hay superficie HTTP nueva — y que eso se diga explícitamente es lo que evita que alguien busque el archivo que falta.

### Source Code (repository root)

```text
migrations/
└── 004-*.sql                                   # seis tablas; la primera de la serie que sólo crea

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

- [data-model.md](./data-model.md) — las seis tablas con lo propio de cada una, el índice en memoria y la reconstrucción de la ventana. Ninguna entidad nueva: las seis ya existen y ninguna cambia de forma.
- [quickstart.md](./quickstart.md) — siete pasos, el último usando el servidor: dar de alta un merchant, apagar, prender, y que siga ahí.
- **Sin `contracts/`**, por el motivo de arriba.

## Constitution Check — re-evaluación después del diseño

Ningún veredicto cambia, y dos se confirman con lo que el diseño concretó:

- **Principio V** se refuerza: cada una de las seis tablas lleva el merchant en su clave de búsqueda, y la única unicidad global —el origen— es la que el aislamiento necesita para que un origen no hable por dos merchants.
- **Principio IV** sigue siendo la única excepción, y el diseño la **reduce** respecto de lo que la spec temía: la deduplicación, que se consulta por evento y habría sido la excepción más caliente de todas, se resuelve como recuperable y no toca el almacén por evento.

**Y una cosa que el diseño confirma y conviene decir**: no hay ninguna entidad nueva ni ningún cambio de forma en las seis que se guardan. Esta feature es de infraestructura y de arranque, no de dominio — el dominio ya estaba listo para que alguien guardara sus entidades, con su `record()` y su `rehydrate` (ADR-024).

---

## Qué habrá que traducir al cambiar de motor

**Por qué esta sección existe acá.** La pregunta la hizo el dueño al revisar el modelo de datos: si el
esquema —tablas, campos, relaciones— es independiente del motor. La respuesta es que **el modelo sí y la
escritura no**, y hasta ahora eso estaba repartido entre `migrations/README.md`, D-21 y los ADR de las
tres features anteriores, una pieza por vez. Juntarlo en un lugar lo vuelve revisable de una vez, que es
el mismo argumento por el que esta feature tiene la tabla de las cuatro columnas.

**Y su casa definitiva no es este archivo.** Un plan se archiva con su feature; este inventario no
caduca. Al cerrar, va a `migrations/README.md`, que es documento vivo y tiene un gate que lo verifica.

### Lo que viaja igual

Qué tablas hay, cuál es la clave de negocio de cada una, qué tiene que ser único, qué índice necesita
cada lectura, y qué campo vive en el documento porque nadie lo busca. **Todo `data-model.md` es eso.** Se
reescribe en otro motor sin volver a pensarlo.

### Lo que hay que traducir

| Construcción                                           | Por qué es del motor          | En PostgreSQL                                                                               |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `INTEGER PRIMARY KEY AUTOINCREMENT`                    | la palabra es de SQLite       | `GENERATED ALWAYS AS IDENTITY`                                                              |
| `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` como `DEFAULT` | función de SQLite             | `now()`, y probablemente una columna `timestamptz` en vez de texto                          |
| `PRAGMA user_version`                                  | **no existe fuera de SQLite** | una tabla de migraciones aplicadas; es el mecanismo de versionado, no el esquema            |
| `json_extract(document, '$.x')`                        | función de SQLite             | `document::jsonb ->> 'x'`, y el documento probablemente pasa a `jsonb`                      |
| `ON CONFLICT (…) DO NOTHING` / `DO UPDATE`             | —                             | **igual**. Es lo único de esta lista que no cambia (en MySQL sí: `ON DUPLICATE KEY UPDATE`) |

**Cuántas veces aparece cada una no se escribe acá**: es una cifra de estado y se desactualiza sola. La
informa un `grep -rE "AUTOINCREMENT|strftime|json_extract|PRAGMA user_version" migrations/ src/`.

### La suposición que el DDL no muestra, y es la que más cuesta encontrar

**Los instantes se guardan como texto ISO y se comparan lexicográficamente.** La feature 032 acota la
ventana del visitante con `created_at >= :since`, y eso funciona porque ISO-8601 en UTC ordena igual como
texto que como fecha.

Sobrevive a PostgreSQL con columnas `text`. Lo que cambia si esas columnas pasan a `timestamptz` es el
binding del parámetro, no la consulta — y es justo el tipo de cosa que no se ve leyendo el esquema, así
que queda escrita.

### Lo que ya se saldó, para no buscarlo dos veces

El orden de inserción se leía del `rowid` **implícito** de SQLite, que PostgreSQL no tiene. La migración
`002` lo cambió por una columna `id` explícita (feature 031). Está en `migrations/README.md` como una de
las tres cosas que D-21 había dejado apoyadas en el motor.

### Qué agrega esta feature al inventario, y qué no

**No agrega ninguna dependencia nueva del motor.** Las decisiones de `data-model.md` se revisaron con
esta lupa:

- `merchant_origins` con `UNIQUE (origin)` viaja tal cual, y su motivo —que la unicidad la haga cumplir
  un índice y no una lectura previa— es **más** fuerte en PostgreSQL, no menos.
- `anchor_diagnostics` con `count = count + 1` en el conflicto: misma sintaxis.
- «La efectiva es la de versión máxima, sin bandera de vigente» es una decisión de modelo.

Lo único que suma son más `strftime` y más `AUTOINCREMENT`: **más de lo mismo que ya hay que traducir**.

**Y una cosa que conviene tener escrita porque cambia una prioridad.** R-05 dejó afuera la auditoría
atómica porque `SqlStore.transaction` es síncrona. Con un driver de PostgreSQL —asíncrono— esa
restricción **no existe**. Así que ese pendiente del hito no es «lo mismo pero después»: es un problema
que el cambio de motor resuelve de paso, y eso es un argumento a favor de esperar en vez de inventar
ahora una forma retorcida de esquivarlo.
