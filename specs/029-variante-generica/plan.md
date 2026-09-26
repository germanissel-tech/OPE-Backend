# Implementation Plan: La variante deja de exigir dos atributos de indumentaria

**Branch**: `029-variante-generica` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-variante-generica/spec.md`

## Summary

`CatalogVariant` deja de exigir los dos atributos de indumentaria y pasa a declarar `attributes`, la
misma forma que el producto usa desde la feature 010 — extraída a un componente único que los dos
referencian, para que el contrato tenga **una** manera de decir qué es un atributo y no dos.

Es un cambio de **petición solamente**: la variante no aparece en ninguna respuesta del contrato, así
que nada del SDK ni de la administración se entera. La única parte que altera comportamiento es la
comparación de contenido entre instantáneas, y es la que se prueba.

Cierra **D-16**, cuya pregunta de diseño resultó no existir: ningún claim lee esos campos.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`), `strict`, `erasableSyntaxOnly`,
`exactOptionalPropertyTypes`, ESM.

**Primary Dependencies**: ninguna nueva.

**Storage**: en memoria, como hoy. No toca persistencia.

**Testing**: Vitest (`fast` y `tools`), Schemathesis contra el contrato, Stryker sobre las líneas
cambiadas.

**Target Platform**: Node 22; el contrato lo consume la plataforma del merchant al publicar catálogo.

**Project Type**: servicio HTTP con arquitectura en anillos (ADR-013).

**Performance Goals**: sin cambio de orden. La prueba de carga del catálogo del piloto (5 000
productos × 10 variantes) es la que lo confirma, y ya existe.

**Constraints**: el contrato lleva `info.x-stability: building` (ADR-003), así que el cambio
incompatible entra con bump **MINOR**; `contract:diff` lo reporta y lo acepta. Nada persistido que
migrar.

**Scale/Scope**: 1 esquema del contrato (más uno nuevo, compartido), 2 archivos de `src/`, 1 nota del
glosario, 8 archivos de `tests/`. Una sola historia.

## Constitution Check

**Constitución v1.4.4** (ratificada 2026-09-16, última enmienda 2026-09-25 — la de la feature 028).
Los **once** principios, también los que no aplican, que se marcan como tales.

| Principio                                      | Veredicto      | Por qué                                                                                                                                                                                                  |
| ---------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**               | ✅ sin impacto | Ninguna autoridad cambia. Las que no leían el campo siguen sin leerlo.                                                                                                                                   |
| **II. Fail-closed: `NO_OP` por defecto**       | ✅ cumple      | La forma vieja se rechaza nombrando el campo; nada se acepta degradando.                                                                                                                                 |
| **III. La medición precede y no se contamina** | ✅ cumple      | Nada registrado cambia de forma: la variante no entra al ledger, que guarda el identificador de la variante en foco y no sus atributos.                                                                  |
| **IV. Dos caminos, dos garantías**             | ➖ no aplica   | No se toca la separación entre decisión y medición.                                                                                                                                                      |
| **V. Aislamiento por merchant**                | ✅ cumple      | El catálogo ya es por merchant y las pruebas de aislamiento existentes siguen corriendo.                                                                                                                 |
| **VI. Identidad e idempotencia explícitas**    | ⚠️ **aplica**  | La huella de contenido cambia: dos instantáneas del mismo instante que difieren en un atributo de variante pasan a ser **conflicto** y no repetición. Es más correcto, y es lo único que hay que probar. |
| **VII. Comportamiento, no personas**           | ✅ cumple      | Ningún dato nuevo de la persona. Los atributos son del producto, no del visitante.                                                                                                                       |
| **VIII. Cero modelos de lenguaje en runtime**  | ✅ cumple      | Ninguna llamada.                                                                                                                                                                                         |
| **IX. Nada entra al reporte sin trazabilidad** | ✅ cumple      | El reporte no ve la variante más que por su identificador, que no cambia.                                                                                                                                |
| **X. Puertos en los dos bordes**               | ✅ cumple      | El puerto de plataforma recibe una forma más general; ningún puerto cambia de firma.                                                                                                                     |
| **XI. Ninguna política vive en el código**     | ✅ cumple      | No hay valor de comportamiento nuevo. Los límites del atributo son del contrato, donde ya estaban.                                                                                                       |

### Gates explícitos del flujo (constitución §Flujo de desarrollo)

| Gate                                                   | Respuesta                                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Toca una superficie HTTP?                             | **Sí**, el cuerpo de la publicación de catálogo. El delta se diseña en `specs/029-variante-generica/contracts/` antes de cualquier código; incompatible, entra por `building`. |
| ¿Toca persistencia o API?                              | **API.** Las pruebas de aislamiento por merchant del catálogo ya existen y siguen corriendo.                                                                                   |
| ¿Toca el plano de decisión?                            | **No**, salvo por la forma del dato que consulta. Ninguna I/O nueva; toda salida sigue pudiendo ser `NO_OP` con motivo.                                                        |
| ¿Toca el ledger o la cadena de evidencia?              | **No.** El ledger guarda el identificador de la variante, no sus atributos.                                                                                                    |
| ¿Introduce un campo nuevo de evento u orden?           | **De catálogo, y reemplaza a dos.** No es PII: son atributos del artículo, no de la persona.                                                                                   |
| ¿Introduce una llamada a un modelo en runtime?         | No.                                                                                                                                                                            |
| ¿Introduce una regla que el esquema no puede expresar? | **No.** Un atributo repetido o dos variantes con los mismos atributos se aceptan, igual que en el producto: no se inventa una invariante que el precedente no tiene.           |
| ¿Introduce un sustantivo nuevo en el contrato?         | **No.** `attribute` ya resuelve al glosario por los atributos del producto. Lo que cambia es la nota de `variante`, que cita texto que la fuente ya no tiene (research R-05).  |
| ¿Toca `src/`?                                          | **Sí**, dos archivos, sin cambiar la dirección de dependencias. `npm run arch` lo verifica.                                                                                    |

### Lo que este Constitution Check quiere dejar señalado

El principio **VI** es el único con impacto y conviene no perderlo entre los verdes: esta feature
**amplía lo que cuenta como contenido distinto**. Hasta hoy, dos publicaciones del mismo instante que
diferían en un eje que no fuera talle o color se consideraban la misma; ahora se distinguen. Es la
corrección de un agujero que nadie había nombrado, y es la razón por la que la feature tiene pruebas
propias en vez de sólo las que ya existían.

## Project Structure

### Documentation (this feature)

```text
specs/029-variante-generica/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/
```

### Source Code (repository root)

```text
contracts/
├── components/schemas/CatalogAttribute.yaml   # nuevo: la forma, una sola vez
├── components/schemas/CatalogVariant.yaml     # pierde los dos campos, gana attributes
└── components/schemas/CatalogProduct.yaml     # su lista pasa a referenciar el componente

src/
├── domain/catalog/catalog-snapshot.ts                       # la variante y la huella
└── interface-adapters/catalog/controllers/upsert-catalog-snapshot.ts

docs/dominio/variante.md                                     # la cita y el cuerpo

tests/
├── helpers/test-app.ts                                      # el constructor de variantes
└── …siete archivos que construyen variantes
```

**Structure Decision**: sin estructura nueva. El único archivo que nace es un componente del contrato
que **quita** duplicación en vez de agregarla: la forma del atributo deja de estar escrita dos veces.

## Complexity Tracking

Sin violaciones que justificar. La feature quita dos campos obligatorios y una duplicación del
contrato, y agrega un componente compartido que es la misma forma con un nombre.
