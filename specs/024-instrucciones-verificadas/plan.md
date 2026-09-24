# Implementation Plan: Las instrucciones tienen criterio de admisión y gate

**Branch**: `024-instrucciones-verificadas` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-instrucciones-verificadas/spec.md`

## Summary

`CLAUDE.md` crece monótonamente (360 → 675 líneas en seis días) porque no tiene criterio de
admisión, y casi nada lo verifica: de sus 759 referencias, sólo las citas de ADR y los marcadores
tienen gate. Está exacto **por disciplina**, no por construcción, y ya hay una prueba de que la
disciplina no alcanza: una ruta nombra un módulo del que el archivo se fue hace dos features.

El arreglo son tres cosas, en este orden: un **gate** que verifique las tres formas de referencia
(identificador, ruta, comando) contra su fuente; un **criterio de admisión declarado** por sección,
verificado en los dos sentidos para que abrir una sección obligue a decidir; y la **mudanza** de lo
descriptivo a su ADR, dejando el puntero.

Ni el mecanismo ni el hospedaje se inventan: el patrón es el de ADR-032 (política declarada más
prueba que la verifica) y la casa es `contract:check`, por un motivo medido que la spec no
anticipaba.

## Technical Context

**Language/Version**: JavaScript de `scripts/` verificado con `checkJs` (ADR-012): toda función
exportada con su firma en JSDoc, valores desconocidos leídos con `prop()`/`isObject()`.

**Primary Dependencies**: ninguna nueva. La verificación es lectura de archivos y comparación de
texto, como los seis `check:*` que ya existen.

**Storage**: N/A.

**Testing**: Vitest, proyecto `tools`, siguiendo a `tests/docs/readmes.test.ts`. La **prueba** vive
en `tools`; el **gate** no (ver Constitution Check y research R-01).

**Target Platform**: N/A — herramienta de repositorio.

**Project Type**: gobernanza del repositorio; no toca `src/` ni el contrato.

**Performance Goals**: el gate corre en cada `contract:check`, así que tiene que costar lo que
cuestan los otros seis: lectura de archivos, sin red.

**Constraints**: cero falsos positivos sobre las diecinueve referencias que se escriben con barras y
no son rutas (medido: un gate ingenuo da 75); **la feature se aplica a sí misma**, así que el
documento que la enuncia tiene que cumplirla.

**Scale/Scope**: un archivo de política, una biblioteca de funciones puras, un script de gate, una
prueba, y la edición del documento auditado.

## Constitution Check

Constitución **v1.4.2**. Los once principios:

| #    | Principio                           | Veredicto                                                                                                                                                                                                                                                                   |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Separación de autoridades           | **N/A.** No toca el plano de decisión ni el composition root.                                                                                                                                                                                                               |
| II   | Fail-closed                         | **Refuerza, aplicado a la documentación.** Una referencia que no se puede verificar pasa a fallar en vez de pasar inadvertida, y una sección sin clasificar falla en vez de admitirse por omisión.                                                                          |
| III  | La medición precede                 | **N/A** al producto. Se respeta en el método: cada decisión del plan cita su medición.                                                                                                                                                                                      |
| IV   | Dos caminos, dos garantías          | **N/A.** No hay runtime involucrado.                                                                                                                                                                                                                                        |
| V    | Aislamiento por merchant            | **N/A.**                                                                                                                                                                                                                                                                    |
| VI   | Identidad e idempotencia            | **N/A.**                                                                                                                                                                                                                                                                    |
| VII  | Comportamiento, no personas         | **N/A.** No hay datos de personas.                                                                                                                                                                                                                                          |
| VIII | Cero modelos de lenguaje en runtime | **N/A.** El gate es comparación de texto; ningún modelo interviene.                                                                                                                                                                                                         |
| IX   | Trazabilidad                        | **N/A** al reporte del merchant.                                                                                                                                                                                                                                            |
| X    | Puertos en los dos bordes           | **N/A.**                                                                                                                                                                                                                                                                    |
| XI   | Ninguna política vive en el código  | **Pasa, y condicionó el diseño.** Lo que el gate espera —raíces implícitas, formas no-ruta, clase de cada sección, excepciones— va en un **archivo de política declarado**, no en constantes del script. Es el mismo principio de la constitución llevado a la herramienta. |

**Gate de superficie HTTP**: no aplica. Esta feature no toca `contracts/` ni `src/`;
`contract:diff` no tiene nada que reportar e `info.version` no se mueve.

**Gate de documentación viva**: aplica y es el corazón de la feature. Lo que hoy se cumple por
disciplina pasa a cumplirse por gate.

**Sin violaciones**: la sección _Complexity Tracking_ queda vacía y se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/024-instrucciones-verificadas/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R-01..R-08, cada decisión con su medición
├── data-model.md        # el vocabulario: política, clases, formas de referencia
├── contracts/
│   └── policy.md        # la forma del archivo de política y del reporte
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
├── instructions-policy.json   # la política declarada (raíces, formas, secciones, excepciones)
├── instructions-lib.mjs       # funciones puras sobre texto, como readme-inventory-lib.mjs
├── check-instructions.mjs     # el gate: lee la política, reporta, sale 1
└── check-identifiers.mjs      # una línea: CLAUDE.md entra a `documents`

tests/docs/
└── instructions.test.ts       # proyecto `tools`, con sus fixtures

package.json                   # el script `check:instructions`, encadenado en contract:check

CLAUDE.md                      # lo que la feature audita, y que tiene que cumplir sus propias reglas
docs/adr/032-*.md              # la enmienda
```

**Structure Decision**: nada nuevo estructuralmente. Se sigue el molde que ADR-032 dejó para los
README —política declarada, biblioteca de funciones puras, prueba con fixtures— porque ya funciona y
nadie tiene que aprender un segundo mecanismo. Lo único que **no** se copia es dónde corre.

## Las decisiones del plan

1. **El gate vive en `contract:check`, no en el proyecto `tools`** (research R-01). Medido:
   `TOOLS_TRIGGERS` no incluye `CLAUDE.md` **ni `src/`**, y CI corre `test:scoped`, no `test:all`.
   Una prueba en `tools` **no habría corrido en el commit que movió la ventana de firma**, que es
   exactamente el commit que esta feature existe para atrapar. `contract:check` corre siempre y ya
   hospeda los seis `check:*` de gobernanza. La **prueba** del gate sí vive en `tools`, con sus
   fixtures, como todas.
2. **Los identificadores se verifican extendiendo `check:identifiers`** (R-02), que ya sabe hacerlo
   y ya tiene el precedente: `check-adrs.mjs` y `check-markers.mjs` ya incluyen `CLAUDE.md` en su
   lista. Es una línea. **No se toca `PROSE_CHARS`**: descarta las rutas por diseño y está bien, lo
   que las rutas necesitan es resolverse contra el disco, no buscarse en un texto.
3. **Las formas no-ruta se reconocen por su forma, no por una lista de nombres** (R-03). Una lista
   de diecinueve nombres es una lista que envejece; un nombre sin raíz que coincide con una
   convención declarada y un prefijo de plugin declarado no.
4. **La decisión se registra como enmienda de ADR-032** (R-07), que inventó el patrón. Un ADR nuevo
   obligaría a leer dos para entender un mecanismo.

## Lo que el plan agrega a la spec

**Aparece una tercera clase de sección que la spec no anticipó: `mixed`.** Al aplicar el criterio a
las catorce secciones, tres tienen párrafos de los dos tipos (Anillos y módulos, Gates de calidad,
Convenciones). No es «depende»: es una deuda concreta y localizada.

El plan la admite como clase declarable **con `reason` obligatorio**, y no la resuelve ahora:
separar esos párrafos es trabajo de la historia 3 y su tamaño no se conoce hasta haber aplicado el
criterio a los diez bloques primero. Declararla es admitir la deuda; forzar las tres a un lado sería
mentirle a la política el día uno.

**Y un bloque de la mudanza no tiene destino**: «Configuración del SDK y diagnóstico de anclajes»
(33 líneas) cita la feature 017 y el documento de arquitectura, no un ADR. Va **último**, y si al
llegar no hay destino se queda con su motivo escrito: inventar un ADR para poder mudar sería el
trámite que esta feature debería estar eliminando.

## Orden de implementación

1. **El gate primero, y se corre contra el documento sin corregir** (US1). Es la única prueba de que
   sirve: tiene que encontrar las dos cosas reales y ninguna de las diecinueve falsas. Un gate
   escrito después del arreglo no demuestra nada.
2. **Después el arreglo** de lo que el gate encontró, y verde.
3. **El criterio y su verificación en los dos sentidos** (US2), con la política de las catorce
   secciones y sus fixtures.
4. **La mudanza, de a un bloque** (US3), agregando al ADR **antes** de borrar de las instrucciones,
   en commits separados para que el diff lo muestre.
5. **Cierre**: enmienda de ADR-032, quickstart fechado, cadena completa.

**La feature se aplica a sí misma**: el último paso es que `CLAUDE.md`, ya editado, pase el gate que
él mismo enuncia. Si no lo cumple, no está terminada.
