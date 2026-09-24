# Implementation Plan: Las cuatro deudas de las instrucciones se registran y se cierran

**Branch**: `026-deudas-de-las-instrucciones` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-deudas-de-las-instrucciones/spec.md`

## Summary

Cuatro deudas que las features 024 y 025 nombraron y no registraron. Tres son la misma operación
—separar lo que dice **qué hacer** de lo que describe **cómo es el sistema**— en tres secciones
declaradas mixtas; la cuarta es un procedimiento de cuatro pasos escrito como si fuera una
instrucción.

Antes que cerrarlas, el registro se muda: **un registro vivo no vive dentro del documento de una
feature cerrada**, y eso explica por qué nadie registró estas cuatro.

Ninguna toca `src/`, el contrato ni las pruebas del producto.

## Technical Context

**Language/Version**: N/A. Lo que se mueve es Markdown y una entrada de configuración declarada.

**Primary Dependencies**: ninguna. El criterio ya está escrito (ADR-032, enmienda de la 025) y el
gate que lo verifica ya existe (feature 024).

**Storage**: N/A.

**Testing**: las pruebas de documentación que ya existen (`tests/docs/`), más el gate de
instrucciones dentro de `contract:check`.

**Target Platform**: N/A — organización del repositorio.

**Project Type**: gobernanza y documentación.

**Performance Goals**: N/A.

**Constraints**: nada se pierde —lo que se mueve se agrega en el destino **antes** de borrarse del
origen, en commits separados—; el núcleo baja de 195 y sigue bajo 200; una skill no puede importar
nada del repositorio por ruta; **la feature se aplica a sí misma**.

**Scale/Scope**: un registro que se muda, tres secciones que se separan, un procedimiento que se
convierte en skill, y las cuatro filas.

## Constitution Check

Constitución **v1.4.2**. Los once principios:

| #    | Principio                           | Veredicto                                                                                                                                                                                                   |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Separación de autoridades           | **N/A** al producto. En espíritu se cumple y es el objeto de la feature: cada cosa queda con su dueño.                                                                                                      |
| II   | Fail-closed                         | **Se respeta.** Una sección que no se puede separar **se queda**, con su deuda registrada; no se cierra por decreto.                                                                                        |
| III  | La medición precede                 | **N/A** al producto; se respeta en el método: el reparto de cada sección se decidió leyéndola viñeta por viñeta, no por su título.                                                                          |
| IV   | Dos caminos, dos garantías          | **N/A.**                                                                                                                                                                                                    |
| V    | Aislamiento por merchant            | **N/A.**                                                                                                                                                                                                    |
| VI   | Identidad e idempotencia            | **N/A.**                                                                                                                                                                                                    |
| VII  | Comportamiento, no personas         | **N/A.**                                                                                                                                                                                                    |
| VIII | Cero modelos de lenguaje en runtime | **N/A.**                                                                                                                                                                                                    |
| IX   | Trazabilidad                        | **Se respeta en el método.** Cada mudanza va en dos tiempos para que el diff muestre que nada se perdió, y cada deuda cerrada dice dónde se cerró.                                                          |
| X    | Puertos en los dos bordes           | **N/A.**                                                                                                                                                                                                    |
| XI   | Ninguna política vive en el código  | **Pasa, y es lo que D-07 hace más legible.** La viñeta que describe los tres niveles se va a su ADR; la **regla** —un valor nuevo es una entrada, nunca una constante— se queda donde un agente la obedece. |

**Gate de superficie HTTP**: no aplica; `contract:diff` no tiene nada que reportar.

**Gate de documentación viva**: aplica, y la mudanza del registro es exactamente su aplicación —lo
vivo no vive en lo histórico—.

**Sin violaciones**: la sección _Complexity Tracking_ queda vacía y se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/026-deudas-de-las-instrucciones/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R-01..R-07, cada reparto decidido viñeta por viñeta
├── data-model.md        # el vocabulario: deuda, estado, registro vivo
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
docs/
├── deudas.md                       # el registro vivo, con D-01..D-10
└── README.md                       # su fila en el inventario (ADR-032)

specs/019-deudas-tecnicas/spec.md   # su tabla queda como historia, apuntando al registro

CLAUDE.md                           # Convenciones separada; el núcleo baja de 195
.claude/rules/
├── gates-de-calidad.md             # los umbrales se van; el procedimiento también
└── anillos-y-modulos.md            # la lista de módulos y el detalle de composición se van

.claude/skills/<procedimiento>/     # D-10, sin importar nada del repo por ruta

docs/adr/031-*.md, 013-*.md, 033-*.md  # reciben lo descriptivo, antes de que se borre

scripts/instructions-policy.json     # las tres secciones dejan de estar declaradas mixtas
```

**Structure Decision**: nada nuevo estructuralmente. El registro va a `docs/`, que es donde el
repositorio ya guarda lo vivo y que tiene su inventario verificado; la skill va al directorio que ya
hospeda dos.

## Las decisiones del plan

1. **El registro se muda a `docs/deudas.md`** (research R-01). No es un capricho de orden: la
   convención del repositorio dice que lo de `specs/` es **histórico y fechado**, y un registro de
   deuda es lo contrario — recibe filas de features que todavía no existen. Meterlo adentro de una
   spec cerrada hace crecer para siempre el documento de otra feature y, sobre todo, **lo esconde**:
   para registrar una deuda de la 025 había que saber que el registro estaba en la 019. Eso explica
   por qué las cuatro se escribieron donde cada uno estaba trabajando.
2. **De `Convenciones` se va una sola viñeta** (R-02), y sólo su cuerpo: la regla son dos líneas, las
   otras trece describen lo que ADR-031 decidió. Las otras siete viñetas son normativas y se quedan.
3. **De `Gates de calidad` se van los umbrales** (R-03): los declara `eslint.config.mjs`, que ya
   lleva la justificación de cada uno. Duplicarlos en una instrucción los condena a quedar viejos.
4. **De `Anillos y módulos` se van la lista de módulos y el detalle de composición** (R-04). La
   lista crece con cada feature y `CONTEXT_MAP` es su fuente verificada.
5. **El procedimiento del gate de mutación es una skill** (R-05): su propio texto dice «ante un
   superviviente, **en este orden**» y enumera cuatro pasos. Eso se ejecuta, no se consulta.
6. **Sin ADR nuevo ni enmienda** (R-07): esta feature **aplica** el criterio que ADR-032 ya fijó. Un
   ADR que registre «esta vez lo aplicamos» diluye a los que registran decisiones.

## Lo que el plan agrega a la spec

**Una duplicación dentro del propio núcleo, que no estaba en la lista de deudas.** «Sin `any`»
aparece dos veces en `CLAUDE.md`: en la viñeta de tipado y en la de convenciones. Es exactamente lo
que el criterio existe para evitar, y aparece al leer `Convenciones` viñeta por viñeta. **Se resuelve
al separar**, sin trabajo extra y sin abrir una deuda: si costara trabajo aparte, sería una fila
nueva en el registro, no un arreglo de paso.

## Orden de implementación

1. **El registro primero** (US1): se muda a `docs/deudas.md` con su fila en el inventario, y entran
   las cuatro filas D-07 a D-10 en estado abierto. **Antes de cerrar ninguna**, porque el registro
   tiene que existir para poder anotar dónde se cerró cada una — y porque si la feature se
   interrumpiera acá, lo que quedaría es lo más valioso: la deuda registrada.
2. **D-07** (US2), que es la que devuelve margen al núcleo.
3. **D-08 y D-09** (US3), independientes entre sí.
4. **D-10** (US4), último: es el de mayor riesgo de equivocarse en el destino, y para entonces las
   tres separaciones ya mostraron cómo se comporta el reparto.
5. **Cierre**: cada fila recibe su referencia, el quickstart queda fechado y la cadena completa.

**Cada separación va en dos tiempos**: lo descriptivo se agrega a su destino, se verifica que está
completo, y **recién entonces** se borra del origen. En commits separados, para que el diff lo
muestre.
