# Implementation Plan: Lo que el SDK manda deja de ser invisible

**Branch**: `031-registro-de-eventos` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-registro-de-eventos/spec.md`

## Summary

Un **puerto de registro de eventos** con una implementación durable sobre el almacén que la feature 030
ya abrió, y una **cola en memoria** que lo alimenta desde fuera del camino crítico. Una fila por evento
(Q1, medida), con su llegada, su decisión y su brazo; el duplicado y el lote rechazado también dejan fila.

El diseño no tiene incógnitas de tecnología: el almacén, el grafo de composición y el patrón de gateway
durable existen desde la 030. **Lo que la investigación encontró son otras dos cosas**, y son las que
dan forma al plan:

1. **El runner de migraciones no sabe migrar.** La 030 declaró «nada que migrar» y `prepareSchema` sólo
   aplica el esquema a un archivo vacío o se niega a arrancar. FR-016 es la primera migración que tiene
   que convivir con una anterior, así que el runner aprende a aplicar las pendientes (research R-02).
2. **El registro no tiene clave natural única, y eso es correcto.** Registrar los duplicados (FR-005)
   impide que `event_id` sea único: cada llegada de un mismo evento es un hecho distinto. La clave pasa a
   ser la llegada, lo que obliga a una identidad nueva —`BatchId`— que la constitución VI hace justificar
   (research R-04, R-05).

Y la parte difícil de FR-018 tiene salida porque el ledger de decisiones **ya** es durable y síncrono:
el hueco de una caída abrupta se nombra reconciliando el ledger contra el registro (research R-10).

## Technical Context

**Language/Version**: TypeScript 7 sobre Node 24 (`.nvmrc`), `strict`, `erasableSyntaxOnly`,
`exactOptionalPropertyTypes`, ESM.

**Primary Dependencies**: **ninguna nueva.** El almacén, el driver y el patrón de gateway durable llegan
de la feature 030.

**Storage**: el mismo `SqlStore` de la 030 — SQLite en archivo, modo WAL — con una migración `002`.
PostgreSQL sigue siendo el motor de producción y queda pendiente con sus pruebas de concurrencia
(**D-21**).

**Testing**: Vitest. Proyecto `fast` para lo unitario, de integración y de contrato; proyecto
`durability` para lo que sólo se ve cruzando un reinicio, que acá es la mitad de lo que la feature
promete (FR-009, FR-017, FR-018).

**Target Platform**: Node 24 en Linux y Windows.

**Project Type**: servicio HTTP con arquitectura en anillos (ADR-013).

**Performance Goals**: el p95 del lote de ingesta **no empeora de forma apreciable** respecto de lo que
la 030 midió (memoria 0,90–1,35 ms; SQLite 1,94–2,72 ms), sobre el objetivo de diseño de 150 ms de
`01 §4.6`, que es PROPUESTO y no SLA. Es SC-004 y es el criterio que verifica FR-007.

**Constraints**: un solo proceso escribe el registro (**D-21**). Sin I/O de red nueva. Ninguna escritura
bloqueante nueva en el camino de decisión: **la feature entera vive del otro lado de esa línea**, y ésa
es la restricción que más gobierna el diseño.

**Scale/Scope**: 1 puerto nuevo con 2 implementaciones (memoria y durable), 1 cola, 1 identidad nueva,
1 migración que además reforma las siete tablas de la 030, 1 campo nuevo en los hechos de la decisión,
5 índices —uno único que da la idempotencia de la escritura y cuatro de consulta, verificados con
`EXPLAIN QUERY PLAN`—. Tres historias.

## Constitution Check

**Constitución v1.4.4.** Los **once** principios, también los que no aplican.

| Principio                                        | Veredicto                                               | Por qué                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | ✅ sin impacto                                          | Ninguna autoridad cambia ni gana una. El registro es un puerto de salida que el caso de uso de ingesta invoca; el orquestador sigue armando contexto e invocando en orden.                                                                                                                                                                                                                           |
| **II. Fail-closed: `NO_OP` por defecto**         | ✅ cumple, **y por una vez al revés**                   | Éste es el único camino del sistema donde una falla del almacén **no** degrada nada: FR-007 lo exige. No contradice el principio: `NO_OP` protege al **visitante** de una promesa sin respaldo, y acá no hay promesa que hacer. Lo que sí se conserva del principio es no mentir: el hueco se declara (FR-018).                                                                                      |
| **III. La medición precede y no se contamina**   | ✅ **es el motivo de la feature**                       | Hoy el insumo de la medición se pierde. Y el registro es un observador puro: FR-011 exige que la decisión, la exposición y la atribución no cambien, y SC-005 que ninguna prueba de comportamiento existente cambie de expectativa.                                                                                                                                                                  |
| **IV. Dos caminos, dos garantías**               | ✅ **cumple, y es la primera vez que se cumple entero** | La 030 dejó una escritura durable en el camino síncrono y lo declaró como excepción medida (ADR-038). Esta feature es el primer componente que cae **del lado de medición**: asíncrono, durable, auditable, sin compartir el presupuesto de latencia. Es lo que `01 §P9` pedía.                                                                                                                      |
| **V. Aislamiento por merchant**                  | ✅ cumple                                               | `merchant_id` en la clave y en el predicado de toda lectura y escritura del registro (FR-008). Hay pruebas de contaminación cruzada, y las que cruzan el reinicio, que es donde un índice mal puesto lo rompería.                                                                                                                                                                                    |
| **VI. Identidad e idempotencia explícitas**      | ⚠️ **aplica: agrega una identidad**                     | `BatchId` es una quinta identidad, y el principio avisa que colapsarlas es el error más caro. Su propósito único —identificar **una llegada**— no lo cubre ninguna de las cuatro, y el `decisionId` no alcanza porque **un lote rechazado no produce decisión**. Justificación completa en research R-05. La idempotencia de la escritura se apoya en `(merchant, lote, posición)`, no en `eventId`. |
| **VII. OPE observa comportamiento, no personas** | ✅ cumple                                               | El registro guarda el evento **tal como el contrato ya lo admite** y no gana un campo (FR-010). El perfil de privacidad no cambia: `01 §665` ya contaba con identificadores propios y secuencias de clicks. El gate de campos personales lo verifica.                                                                                                                                                |
| **VIII. Cero modelos de lenguaje en runtime**    | ✅ cumple                                               | Ninguna llamada.                                                                                                                                                                                                                                                                                                                                                                                     |
| **IX. Nada entra al reporte sin trazabilidad**   | ✅ **mejora, y es lo que hace posible FR-018**          | Hoy una cifra se reconstruye hasta la decisión; después de esta feature, **hasta el evento**, que es lo que el principio dice literalmente. Y como el ledger de decisiones ya es durable y síncrono, sirve de contraparte para nombrar el hueco del registro.                                                                                                                                        |
| **X. Puertos en los dos bordes**                 | ✅ cumple                                               | Un puerto nuevo con dos implementaciones, elegidas por el despliegue como la 030 resolvió el ledger (ADR-033, `.with("sqlite")`). El puerto de plataforma sigue con sus cuatro operaciones.                                                                                                                                                                                                          |
| **XI. Ninguna política vive en el código**       | ⚠️ **aplica: dos valores nuevos**                       | El tamaño de la cola y su intervalo de vaciado son **comportamiento**, así que van al **nivel plataforma** (son reglas del despliegue, no del merchant) y no a una constante; `check:behaviour-constants` lo vigila. La ruta del archivo del almacén sigue siendo entorno, como en la 030.                                                                                                           |

### Gates explícitos del flujo

| Gate                                                   | Respuesta                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Toca una superficie HTTP?                             | **No.** Ninguna operación cambia, `contracts/` no se toca y `check:api-map` lo confirma. Por eso este plan **no lleva `contracts/`**: no hay nada que diseñar ahí. Lo que las historias prometen leer son **puertos con pruebas**, y exponerlo por API es otra feature — ver «Lo que este plan no puede prometer». |
| ¿Toca persistencia o API?                              | **Persistencia, y es la feature entera.** Tareas de aislamiento por merchant en las tres historias, y en la suite de durabilidad.                                                                                                                                                                                  |
| ¿Toca el plano de decisión?                            | **Lo roza y no lo cambia.** El caso de uso de ingesta gana una dependencia; el plano decide igual. No introduce I/O de red ni escritura bloqueante: el encolado es una operación en memoria. Toda salida sigue pudiendo ser `NO_OP` con motivo. SC-004 es la verificación.                                         |
| ¿Toca el ledger o la cadena de evidencia?              | **Sí, en un campo**: los hechos de la decisión ganan cuántos eventos traía su lote, que es lo que permite nombrar el hueco en eventos (research R-10). Los cinco estados de la cadena no cambian.                                                                                                                  |
| ¿Introduce un campo nuevo de evento u orden?           | **No.** El evento se registra como el contrato ya lo declara.                                                                                                                                                                                                                                                      |
| ¿Introduce una llamada a un modelo en runtime?         | No.                                                                                                                                                                                                                                                                                                                |
| ¿Introduce una regla que el esquema no puede expresar? | **No una nueva.** Las dos invariantes de `EventBatch` siguen donde están; esta feature las hace **visibles cuando fallan**, que es distinto de agregarlas.                                                                                                                                                         |
| ¿Introduce un sustantivo nuevo en el contrato?         | **No toca el contrato.** «Llegada», «cola» y «registro» son vocabulario interno, y `BatchId` no viaja al SDK.                                                                                                                                                                                                      |
| ¿Toca `src/`?                                          | **Sí**: un puerto en aplicación, dos gateways en adaptadores, la cola, y el cableado en composición. La dirección de dependencias no cambia y `npm run arch` es el gate.                                                                                                                                           |

### Lo que este plan no puede prometer, y conviene leerlo antes de las tareas

- **Nadie puede «consultar» el registro por una API.** Las historias prometen que el dato se puede
  obtener, y lo que esta feature entrega son **puertos con pruebas** y las consultas del quickstart. SC-001
  dice «sin leer el código», y una consulta SQL escrita en el quickstart lo cumple con lo justo. Exponerlo
  para un operador es otra feature, y la spec la excluye explícitamente («No analiza nada»).
- **El costo de la cola se mide contra SQLite local.** En producción el registro vive detrás de red y el
  orden de magnitud es otro (**D-21**). El número que esta feature publique es el de este entorno, dicho
  como tal.
- **Los lotes rechazados y los aceptados no tienen la misma garantía** al nombrar un hueco: los aceptados
  se reconcilian contra el ledger de decisiones, los rechazados se cuentan desde el log operativo, porque
  no dejan decisión (research R-10). Se declara en vez de promediarse.

## Project Structure

### Documentation (this feature)

```text
specs/031-registro-de-eventos/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
```

No hay `contracts/`: la feature no toca ninguna superficie HTTP (ver el gate).

### Source Code (repository root)

```text
migrations/
└── 002-*.sql                                  # el registro, y las siete tablas de la 030 reformadas

src/
├── domain/ingestion/
│   ├── ids.ts                                 # + BatchId, junto a EventId (research R-05)
│   └── recorded-event.ts                      # la entidad de una llegada registrada (ADR-024)
├── domain/ledger/decision.ts                  # + cuántos eventos traía el lote (research R-10)
├── application/ingestion/
│   ├── ports/event-log.ts                     # el puerto del registro
│   ├── ports/batch-id-generator.ts            # quien acuña una llegada, del dueño de la identidad
│   └── use-cases/ingest-batch.use-case.ts     # los dos puntos de encolado (research R-01)
├── interface-adapters/ingestion/gateways/
│   ├── memory-event-log.ts                    # la implementación del lazo local y del proyecto `fast`
│   └── sqlite-event-log.ts                    # la durable, con el patrón de .claude/rules/gateway-durable.md
├── interface-adapters/ingestion/queue/        # la cola: encolar no espera, vaciar corre aparte
├── infrastructure/sqlite/open-store.ts        # el runner aprende a migrar (research R-02)
└── composition/
    ├── modules/ingestion.ts                   # el puerto nuevo y su elección de tecnología (ADR-033)
    └── deployments/{local,durable}.ts         # cada despliegue elige

tests/
├── (proyecto fast)                            # unitarias, integración, aislamiento entre merchants
└── durability/                                # lo que sólo se ve cruzando un reinicio
```

**Structure Decision**: la de siempre (ADR-013), sin anillos ni módulos nuevos. El registro pertenece al
módulo **ingestion**, que es el dueño del evento y de la llegada; ponerlo en `ledger` habría hecho que el
módulo de las decisiones supiera de eventos, que es la dependencia que `CONTEXT_MAP` no tiene y no debería
ganar.

## Re-evaluación del Constitution Check después del diseño

Hecha con `data-model.md` y `quickstart.md` escritos. **Ningún veredicto cambia**, y el diseño agregó
tres cosas que conviene dejar dichas porque ninguna se veía antes de escribirlo:

- **El tipo del puerto es lo que hace cumplir FR-007.** `record(...)` devuelve `void`, no `Promise`, y no
  tiene canal de fallo. Un tipo que se puede esperar invita a esperarlo, y ahí se pierde la garantía de
  que el registro no frena la decisión. El requisito deja de depender de que alguien se acuerde.
- **El principio VI se cumple mejor de lo que el veredicto sugiere.** La identidad nueva no sólo se
  justifica: **separa** dos cosas que estaban colapsadas sin que nadie lo hubiera notado, porque hoy el
  `decisionId` hace de identificador de la llegada para todo efecto práctico, y **no puede** para el lote
  rechazado. La quinta identidad no agrega confusión; la saca.
- **Ninguna superficie nueva y ninguna dependencia nueva**, confirmado por gate: `contract:check` pasa
  con el mapa en 30 operaciones construidas, igual que antes.

Lo que el diseño **no** resolvió y el plan ya declaraba: el registro no se puede leer por API (los pasos
4, 5 y 8 del quickstart usan puertos y SQL), y los números son de SQLite local (**D-21**).

## Complexity Tracking

| Violación                                                                   | Por qué hace falta                                                                                                                     | Alternativa más simple, y por qué se rechaza                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Una quinta identidad (`BatchId`)**, contra el aviso de la constitución VI | Registrar los duplicados impide que `eventId` sea la clave, y agrupar los eventos de una llegada es lo que FR-003 pide (research R-04) | **Agrupar por `decisionId`**: más barato y no hace falta acuñar nada. Se rechaza porque **un lote rechazado no produce decisión**, y entonces la historia 2 —la que vuelve forense al registro— se queda sin la mitad de su tráfico                  |
| **Tocar el runner de migraciones**, que no es de esta feature               | FR-016 es la primera migración que convive con una anterior, y hoy un almacén en versión 1 **se niega a arrancar** (research R-02)     | **Borrar el archivo y recrearlo**: sirve hoy, porque no hay datos en producción. Se rechaza porque convierte la primera migración real del piloto en un procedimiento manual no escrito, y el momento de aprenderlo es cuando no hay nada que perder |
| **Un campo nuevo en los hechos de la decisión**                             | Sin él el hueco se nombra en lotes y no en eventos, y SC-010 pide eventos (research R-10)                                              | **Un contador durable propio del registro**: sería una escritura síncrona en el camino crítico, que es exactamente lo que FR-007 prohíbe                                                                                                             |
| **Dos implementaciones del puerto** (memoria y durable)                     | El lazo local y el proyecto `fast` no pueden depender de un archivo, y el patrón ya existe desde la 030                                | **Sólo la durable**: haría que toda prueba unitaria abriera un almacén, y volvería lento el lazo que ADR-016 necesita rápido para el gate de mutación                                                                                                |
