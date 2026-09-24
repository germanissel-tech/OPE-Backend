# Implementation Plan: El núcleo se lee siempre; el resto carga cuando hace falta

**Branch**: `025-instrucciones-por-ruta` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-instrucciones-por-ruta/spec.md`

## Summary

`CLAUDE.md` tiene 573 líneas contra un umbral oficial de **200**, y el motivo que la documentación
da pesa más que el costo de contexto: un archivo más largo **se obedece peor**.

Seis secciones que sólo importan para una parte del código pasan a `.claude/rules/`, cada una con su
`paths`, y entran al contexto cuando el agente trabaja sobre esa parte. En el núcleo queda de cada
una la invariante que impide equivocarse. La tabla de comandos se consolida en un inventario que ya
existe y ya se verifica. El gate de la feature 024 pasa de mirar un archivo a mirar siete, con el
mismo diseño.

**La cuenta de la spec no cerraba** —daba 211 y no 190, porque no contó los punteros—, y de ahí
salen las dos correcciones que el plan aporta: la tabla de comandos se va, y el tipado se queda.

## Technical Context

**Language/Version**: JavaScript de `scripts/` con `checkJs` (ADR-012). El contenido que se mueve es
Markdown.

**Primary Dependencies**: ninguna nueva. Las reglas acotadas son una función de la CLI, no una
biblioteca.

**Storage**: N/A.

**Testing**: Vitest, proyecto `tools`, extendiendo `tests/docs/instructions.test.ts`.

**Target Platform**: N/A — organización del repositorio.

**Project Type**: gobernanza. No toca `src/`, ni el contrato, ni ninguna superficie HTTP.

**Performance Goals**: el gate corre en cada `contract:check` y pasa de leer un archivo a leer
siete; sigue siendo lectura de archivos, sin red.

**Constraints**: el núcleo bajo 200 líneas **contando los punteros**; ninguna línea de contenido se
pierde salvo lo que se consolide y se enumere; la CLI en 2.1.198 o superior (verificado: 2.1.280);
**la feature se aplica a sí misma**.

**Scale/Scope**: un núcleo, seis reglas nuevas, una política extendida, cuatro verificaciones que
amplían su lista.

## Constitution Check

Constitución **v1.4.2**. Los once principios:

| #    | Principio                           | Veredicto                                                                                                                                                                                 |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Separación de autoridades           | **N/A** al producto. En espíritu se cumple: cada regla queda con la parte del código que gobierna, en vez de todo en un archivo que lo sabe todo.                                         |
| II   | Fail-closed                         | **Se respeta.** Una regla sin acotar y sin motivo falla; una regla acotada a algo inexistente falla. No decidir no puede pasar inadvertido.                                               |
| III  | La medición precede                 | **N/A** al producto; se respeta en el método: la corrección más importante de este plan salió de rehacer una cuenta que la spec había estimado.                                           |
| IV   | Dos caminos, dos garantías          | **N/A.**                                                                                                                                                                                  |
| V    | Aislamiento por merchant            | **N/A.**                                                                                                                                                                                  |
| VI   | Identidad e idempotencia            | **N/A.**                                                                                                                                                                                  |
| VII  | Comportamiento, no personas         | **N/A.**                                                                                                                                                                                  |
| VIII | Cero modelos de lenguaje en runtime | **N/A.**                                                                                                                                                                                  |
| IX   | Trazabilidad                        | **N/A** al reporte. La mudanza se hace en dos tiempos por bloque para que el diff muestre que nada se perdió, que es el mismo principio aplicado a la documentación.                      |
| X    | Puertos en los dos bordes           | **N/A.**                                                                                                                                                                                  |
| XI   | Ninguna política vive en el código  | **Pasa.** Los patrones, la clase de cada sección y las excepciones siguen en el archivo de política declarado, no en constantes del script. El umbral de 200 líneas vive en esa política. |

**Gate de superficie HTTP**: no aplica. `contract:diff` no tiene nada que reportar.

**Gate de documentación viva**: aplica y es el objeto de la feature.

**Sin violaciones**: la sección _Complexity Tracking_ queda vacía y se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/025-instrucciones-por-ruta/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R-00..R-07, cada decisión con su medición
├── data-model.md        # el vocabulario: destino, regla acotada, invariante
├── contracts/
│   └── policy.md        # la política extendida a archivos y lo que el gate reporta
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
CLAUDE.md                      # el núcleo: bajo 200 líneas, con la invariante de cada regla

.claude/rules/
├── contrato.md                # paths: contracts/**
├── anillos-y-modulos.md       # paths: src/**
├── caso-de-uso.md             # paths: src/application/**
├── entidad.md                 # paths: src/domain/**
├── gates-de-calidad.md        # paths: src/**, tests/**
└── auditoria.md               # paths: tests/audit/**, .claude/skills/**

scripts/
├── instructions-policy.json   # declara archivos, no sólo secciones
├── instructions-lib.mjs       # la envoltura por archivo y las dos verificaciones nuevas
├── check-instructions.mjs     # recorre los siete
├── check-identifiers.mjs      # las reglas entran a su lista
├── check-adrs.mjs             # ídem
├── check-markers.mjs          # ídem
└── README.md                  # la tabla de comandos consolidada; seis filas nuevas

tests/docs/instructions.test.ts # sus fixtures, con los dos casos nuevos
docs/adr/032-*.md               # la enmienda, citando la documentación oficial
```

**Structure Decision**: `.claude/rules/` es el directorio hermano de `.claude/skills/`, que el
repositorio ya usa y que ya dispara el proyecto de herramientas. No se inventa lugar. Los nombres de
archivo son los de la sección, en castellano como el resto de la documentación (ADR-015).

## Lo que el plan corrige de la spec, con evidencia

**La cuenta no cerraba.** La spec sumó las siete secciones que se quedan (190) y **no contó los
punteros**: tres líneas por sección que se va, 190 + 21 = **211**. Once por encima del umbral. Si el
plan lo daba por bueno, la feature terminaba con un núcleo de 211 líneas declarando que cumple 200.

De ahí, dos correcciones:

1. **La tabla de comandos se va, consolidada.** Medido: **26 de sus 30 comandos ya están descritos
   en `scripts/README.md`**, un inventario que ADR-032 gobierna y que una prueba ya verifica fila por
   fila. Era el mismo acople que la 024 sacó de las notas del contrato, invisible porque esta tabla
   no cita ningún ADR. El núcleo conserva los siete del lazo normal —los que el propio flujo de
   trabajo ya enumera— y apunta al inventario para el resto. La spec lo permite explícitamente: «lo
   que se consolide se enumera».
2. **El tipado se queda.** Diecisiete líneas que ya son casi todas invariantes, y cuyo alcance sería
   casi universal: el mecanismo cobraría su precio —llegar tarde al primer archivo— sin pagar casi
   nada. Es el peor negocio de las siete, y con la corrección 1 el núcleo cierra sin moverla.

Resultado: **≈195 líneas**, bajo el umbral con margen chico y honesto. El plan **no** persigue un
número menor; la spec lo dejó fuera de alcance porque premiaría borrar cosas útiles.

## Las seis que se mueven pasan la prueba de FR-004

FR-004 dice que una sección que no se pueda reducir a una invariante sin exponer al agente **no se
mueve**. Las seis pasan, y el motivo es el mismo en las seis: su invariante está sostenida por un
gate que falla en el acto si se la viola, así que equivocarse cuesta un ciclo de gate y no una
revisión. El caso que más se acercó a quedarse es el de escribir un caso de uso —el escenario exacto
de FR-004, un agente creando el primer archivo de la capa— y sobrevive porque `lint` rechaza en el
acto lo que su invariante prohíbe.

## Orden de implementación

1. **La política y el gate primero** (US2), extendidos a archivos, **antes** de crear ninguna regla:
   así el primer archivo que se cree ya nace verificado, y una regla sin acotar no puede colarse
   mientras se trabaja.
2. **Las cuatro verificaciones** que hoy alcanzan sólo al núcleo reciben los archivos nuevos.
3. **La mudanza, de a una sección** (US1), en dos tiempos: se escribe la regla, se comprueba que el
   gate la ve, y recién entonces se reemplaza la sección por su invariante. En commits separados,
   para que el diff muestre que nada se perdió.
4. **La consolidación de la tabla de comandos**, que es la única que no es una mudanza sino una
   fusión: lo que le falte al inventario se le agrega **antes** de borrar la tabla.
5. **El criterio de los tres destinos** (US3), que necesita la partición hecha para dar ejemplos
   ciertos.
6. **Cierre**: enmienda de ADR-032 citando la documentación oficial, quickstart fechado, cadena
   completa.

**El último paso es contar las líneas del núcleo.** Si no baja de 200, la feature no está terminada
— y el número se registra contra la serie que venía subiendo: 360 → 675 → 573 → …
