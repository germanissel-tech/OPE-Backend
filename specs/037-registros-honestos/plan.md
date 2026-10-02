# Implementation Plan: Registros honestos y lineamiento de persistencia

**Branch**: `037-registros-honestos` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/037-registros-honestos/spec.md`

## Summary

El registro de cada entidad que un almacén guarda deja de declarar sus partes anidadas como clases y
declara los datos planos que el almacén realmente devuelve; la entidad convierte esas partes al
construirse. Con eso el `as XRecord` de los gateways durables dice la verdad, un campo de clase nuevo
sin conversión **no compila**, y se corrige el caso que ya se materializó: el catálogo leído del
almacén trae precios que no son `Money`.

El camino tiene dos partes que no se tocan entre sí. En el dominio, dos entidades convierten en su
constructor (pedido, merchant) y dos tipos declaran el dato plano porque nadie les aplica una regla
(precio de variante del catálogo, precio de un evento); tres gateways y tres controllers pierden
código. En la documentación, un ADR nuevo fija lo que la evaluación del 2026-10-02 estableció y dos
reglas acotadas cambian lo que dicen de la rehidratación; el registro de deudas gana dos filas y una
ampliación. Ni el contrato, ni los puertos, ni la composición cambian.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en modo `strict`, sobre Node 24 (ADR-017).

**Primary Dependencies**: ninguna nueva.

**Storage**: SQLite por `node:sqlite`, sin cambios. **Sin migración**: lo que se escribe no cambia
(R-03), así que un documento ya guardado se lee igual.

**Testing**: Vitest. Las conversiones y la demostración del compilador, en `fast` y en `tests/types/`;
lo que sólo se ve leyendo un almacén de verdad, en `durability`. Stryker sobre el diff.

**Target Platform**: un proceso, servidor Linux o Windows; sin cambios.

**Project Type**: servicio HTTP con arquitectura por anillos (ADR-013).

**Performance Goals**: el camino de decisión no paga nada apreciable (SC-005). R-05 elige para el
catálogo la forma que cuesta cero, y la medición de latencia de ingesta de la suite de durabilidad lo
confirma en la misma máquina.

**Constraints**: ningún cambio observable (FR-012): el contrato no tiene diferencias, ninguna
expectativa de `fast` cambia. El gate de mutación aplica a cada línea de conversión nueva.

**Scale/Scope**: 4 tipos del dominio con partes que son clases (R-01), 14 casts en gateways durables de
los cuales 4 mienten hoy, 3 gateways y 3 controllers que pierden líneas; 1 ADR nuevo, 2 reglas
acotadas, 3 entradas del registro de deudas.

## Constitution Check

_Constitución **v1.4.4**. Se evalúan los once principios; los que no aplican se marcan como tales._

| Principio                                           | Veredicto                | Por qué                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                    | ✅ cumple                | Ninguna autoridad cambia. La conversión de una parte vive con la entidad que la posee, que es donde ADR-024 pone sus reglas; ningún módulo gana una dependencia.                                                                                                                                           |
| **II. Fail-closed**                                 | ✅ cumple                | No se agrega ninguna decisión ni ningún `NO_OP`. Lo que cambia es que una lectura del almacén ya no puede producir una entidad a medias que falle después, en otra petición.                                                                                                                               |
| **III. La medición precede y no se contamina**      | ➖ no aplica             | No se toca la asignación, el ledger ni lo que se estampa en una decisión. `DecisionRecord` no tiene partes que sean clases (R-01) y no cambia.                                                                                                                                                             |
| **IV. Dos caminos, dos garantías**                  | ✅ cumple                | El catálogo está en el camino de decisión y R-05 elige para él la forma que no agrega ninguna asignación: su precio se declara plano. Las conversiones en constructor quedan en pedido y merchant, que son operaciones de la plataforma y de administración. SC-005 lo verifica con la medición existente. |
| **V. Aislamiento por merchant**                     | ✅ cumple                | No se agrega ninguna frontera de datos ni ninguna consulta. Los casos de aislamiento entre merchants de las tres suites de durabilidad alcanzadas (pedidos, merchants, catálogo) siguen corriendo sobre el código nuevo y son la prueba que la constitución pide.                                          |
| **VI. Identidad explícita, idempotencia explícita** | ✅ cumple                | Ninguna identidad ni ninguna clave cambia. La repetición de una devolución, que hoy depende de que `Return` vuelva como clase, pasa a estar garantizada por el constructor del pedido en vez de por el gateway.                                                                                            |
| **VII. OPE observa comportamiento, no personas**    | ➖ no aplica             | No se agrega, mueve ni expone ningún dato.                                                                                                                                                                                                                                                                 |
| **VIII. Cero modelos de lenguaje en runtime**       | ➖ no aplica             | Ninguna inferencia, ningún modelo.                                                                                                                                                                                                                                                                         |
| **IX. Nada entra al reporte sin trazabilidad**      | ✅ cumple, y la refuerza | La cadena de evidencia se lee del ledger de pedidos: con el registro honesto, un pedido leído tras un reinicio es el mismo pedido, con sus partes capaces de responder, y no una copia que se parece hasta que alguien la compara.                                                                         |
| **X. Puertos en los dos bordes**                    | ✅ cumple                | Ningún puerto cambia de forma. Los controllers que envolvían un precio en `Money` para entregarlo a un tipo que ahora declara el dato plano dejan de hacerlo; lo que reciben del contrato es lo mismo.                                                                                                     |
| **XI. Ninguna política vive en el código**          | ✅ cumple                | No hay ningún valor de comportamiento nuevo; sólo formas de datos.                                                                                                                                                                                                                                         |

**Veredicto**: pasa sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/037-registros-honestos/
├── plan.md              # Este archivo
├── research.md          # Fase 0: el inventario, dónde va cada conversión, cómo se demuestra
├── data-model.md        # Fase 1: las formas que cambian, y por qué no hay migración
├── quickstart.md        # Fase 1: cómo se verifica
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

**No hay `contracts/` y es deliberado**: ninguna operación se agrega ni cambia (FR-012). El orden de
seis pasos de `.claude/rules/contrato.md` no se dispara.

### Source Code (repository root)

```text
src/
├── domain/
│   ├── merchant/
│   │   ├── origin.ts                  # NUEVO `OriginRecord`; `rehydrate` lo acepta
│   │   └── merchant.ts                # `origins: readonly OriginRecord[]`; el constructor convierte
│   ├── outcomes/order.ts              # `total`, `correlation`, `redemption`, `returned` como registros
│   ├── catalog/catalog-snapshot.ts    # `Variant.price: MoneyRecord` (dato plano, R-05)
│   └── ingestion/event.ts             # `price?: MoneyRecord` (dato plano, R-05)
├── interface-adapters/
│   ├── outcomes/gateways/sqlite-order-ledger.ts     # `orderOf` en una línea; el comentario se va
│   ├── merchant/gateways/sqlite-merchant-store.ts   # `StoredMerchant` se va
│   ├── catalog/controllers/upsert-catalog-snapshot.ts  # deja de envolver el precio
│   ├── ingestion/controllers/ingest-events.ts          # deja de envolver el precio
│   └── outcomes/controllers/notify-order.ts            # deja de envolver el total
docs/
├── adr/043-<slug>.md                  # NUEVO: el lineamiento de persistencia
└── deudas.md                          # D-33, D-34 y la ampliación de D-21
.claude/rules/
├── gateway-durable.md                 # la rehidratación y «qué no se abstrae»
└── entidad.md                         # cómo declara un registro sus partes
scripts/instructions-policy.json       # la clase de la sección nueva de cada regla

tests/
├── unit/domain/{outcomes,merchant,catalog}/   # construida desde un registro plano, responde
├── types/records.test-d.ts                    # NUEVO: un registro plano no es la clase (R-04)
└── durability/catalog.test.ts                 # el precio vuelve, y vuelve a ser un `Money` al pedirlo
```

**Structure Decision**: sin estructura nueva. Un archivo de tipos nuevo en `tests/types/`, que ya es la
convención del repo para lo que se verifica con el compilador, y un ADR. El resto son ediciones en su
lugar.

## Complexity Tracking

Sin violaciones que justificar.

## Fase 0 — Investigación

Seis preguntas en [research.md](./research.md). Dos cambian lo que la spec traía como supuesto, y las
dos salieron de mirar el código: **el inventario encontró un cuarto tipo** (el precio de un evento,
que viaja en el registro de eventos con el tipo `Money` y vuelve plano), y **el catálogo no convierte:
declara**, porque ninguna regla de `Money` se aplica a un precio de variante y la conversión costaría
una asignación por variante en cada lectura del camino de decisión.

## Fase 1 — Diseño

[data-model.md](./data-model.md) y [quickstart.md](./quickstart.md).

Lo que el diseño confirma: **lo que se escribe no cambia**. Una instancia cumple con la forma de su
registro, así que `record()` devuelve lo mismo que hoy y `toDocument` produce el mismo texto. No hay
migración, no hay reconciliación, y un almacén escrito antes de la feature se lee con ella sin ninguna
diferencia salvo la que la feature existe para producir: que lo leído sea lo que el tipo dice.

## Constitution Check — re-evaluación después del diseño

Sin cambios: los once principios siguen como arriba. Lo que el diseño acota mejor que la spec es el
principio IV: la spec admitía convertir el precio del catálogo en el constructor con una medición;
R-05 decide no convertir, así que el camino de decisión no gana ninguna instrucción y la medición de
SC-005 pasa a ser una confirmación en vez de una condición.
