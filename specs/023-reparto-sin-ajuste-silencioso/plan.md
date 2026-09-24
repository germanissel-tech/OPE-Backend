# Implementation Plan: El reparto no se ajusta en silencio

**Branch**: `023-reparto-sin-ajuste-silencioso` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-reparto-sin-ajuste-silencioso/spec.md`

## Summary

El reparto de un experimento se resuelve en cien baldes de un centésimo y el dominio acepta
cualquier tasa 0..1, así que una tasa más fina se ajusta al balde más cercano **sin decirlo**: un
`treatmentShare: 0.004` abre el experimento y no asigna a nadie. El holdout tiene el mismo agujero.

El arreglo es una regla de creación con un dueño: **una tasa es declarable si vuelve a ser ella
misma después de pasar por su balde** —`bucketsOf(share) / ASSIGNMENT_BUCKETS === share`—, escrita
como método estático de `Experiment`, junto al número que define la resolución. `Experiment.of` la
aplica al reparto y devuelve un error nuevo del catálogo; `TreatmentValues.judge` la aplica al
holdout con el `InvalidConfigurationValue` que ya existe. El contrato deja de prometer el ajuste y
declara la regla como `x-invariants`.

**Lo que no se toca**: el algoritmo de asignación, la resolución (el 100), la comparación contra el
holdout, y toda tasa que nadie cuantiza (cortes, techo, escalones, margen).

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) para `build` y `typecheck`; API 6.0 para
el tooling (ADR-017). `strict`, `erasableSyntaxOnly`, `exactOptionalPropertyTypes`, sin `any`.

**Primary Dependencies**: ninguna nueva. La regla es aritmética del dominio y no necesita nada.

**Storage**: N/A. El almacén de experimentos es en memoria hasta la feature de persistencia, así que
no hay migración de datos (research R-05).

**Testing**: Vitest (proyectos `fast` y `tools`), Schemathesis para el contrato, Stryker para
mutación. La prueba que sostiene la feature recorre los 101 valores de dos decimales.

**Target Platform**: servidor Node, una sola instancia (constitución IV).

**Project Type**: servicio HTTP con anillos (ADR-013).

**Performance Goals**: sin impacto. La regla se evalúa al **crear** un experimento y al **leer**
configuración, nunca en el camino de decisión (constitución IV).

**Constraints**: la regla no puede introducir ninguna constante de comportamiento nueva
(constitución XI); tiene que conocerse en un solo lugar, el mismo que sabe cuántos baldes hay
(FR-010); y no puede exportarse como función suelta del dominio (`ope/domain-no-loose-functions`).

**Scale/Scope**: dos campos, un error nuevo, cuatro archivos del contrato, cinco archivos de `src/`.

## Constitution Check

Constitución **v1.4.2**. Los once principios, evaluados:

| #    | Principio                             | Veredicto                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Separación de autoridades             | **Pasa.** La regla vive en la autoridad que la produce —el experimento, dueño del reparto—, invocada por nombre. La configuración la consulta; no la reimplementa. Ningún módulo instancia nada nuevo.                                                                                                                                               |
| II   | Fail-closed                           | **Refuerza.** Hoy un valor ambiguo se convierte en una acción (un reparto que no es el declarado); después, en un rechazo explícito con motivo. Es exactamente «lo que no se sabe no se convierte en promesa» aplicado a la entrada.                                                                                                                 |
| III  | La medición precede y no se contamina | **Es el principio que esta feature defiende.** Un experimento cuyo reparto declarado no es el que ocurre contamina la medición desde el primer visitante; uno con `0.004` no produce ninguna. El algoritmo de asignación no se toca y la huella de la 007 lo verifica.                                                                               |
| IV   | Dos caminos, dos garantías            | **Pasa.** La regla corre al crear un experimento y al leer configuración, no en el plano de decisión. Cero I/O, cero latencia agregada al camino crítico.                                                                                                                                                                                            |
| V    | Aislamiento por merchant              | **Pasa.** No toca identidad ni fronteras de datos. El `merchantId` de la operación sigue viniendo de la ruta bajo el consumidor `admin`, como ADR-020 permite.                                                                                                                                                                                       |
| VI   | Identidad e idempotencia              | **N/A.** No toca ninguna de las cuatro identidades ni ninguna clave de idempotencia.                                                                                                                                                                                                                                                                 |
| VII  | Comportamiento, no personas           | **Pasa.** Ningún campo nuevo, ningún dato del visitante. El `details` del error lleva la tasa declarada por el operador, que es un valor de configuración.                                                                                                                                                                                           |
| VIII | Cero modelos de lenguaje en runtime   | **N/A.**                                                                                                                                                                                                                                                                                                                                             |
| IX   | Trazabilidad                          | **Pasa.** No cambia lo que el ledger estampa. Un experimento rechazado no se registra, y por eso el rechazo tiene que ocurrir **antes** de abrirlo (FR-005).                                                                                                                                                                                         |
| X    | Puertos en los dos bordes             | **N/A.** No toca el puerto de plataforma ni ningún adaptador.                                                                                                                                                                                                                                                                                        |
| XI   | Ninguna política vive en el código    | **Pasa, y es el principio que más condicionó el diseño.** La regla es una **invariante** («qué valores son válidos»), que es justo lo que XI deja en el código; el valor de la resolución ya vive donde vive y no se mueve. El epsilon quedó descartado en parte por esto: habría sido un número en `src/` que decide qué se acepta (research R-01). |

**Gate de superficie HTTP**: el cambio es incompatible (estrecha lo aceptado) y entra con incremento
menor conservando `/v1/`, bajo `info.x-stability: building` — la excepción declarada de ADR-003 que
la v1.4.2 incorporó al gate. Verificado que la marca sigue en el contrato.

**Sin violaciones**: la sección _Complexity Tracking_ queda vacía y se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/023-reparto-sin-ajuste-silencioso/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R-01..R-08, cada decisión con su medición
├── data-model.md        # la regla, el error y los dos campos sujetos
├── contracts/
│   └── delta.md         # el cambio del contrato, campo por campo
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
contracts/
├── components/schemas/ExperimentCreate.yaml        # descripción + x-invariants nueva
├── components/responses/ExperimentUnprocessable.yaml  # segundo ejemplo de 422
├── problem-types.yaml                              # slug treatment-share-too-fine
└── openapi.yaml                                    # info.version 1.5.0 → 1.6.0

generated/                                          # regenerado, nunca editado a mano

src/
├── domain/experiment/
│   ├── experiment.ts        # el método estático que juzga, junto a ASSIGNMENT_BUCKETS
│   └── errors.ts            # TreatmentShareTooFine, en la unión del módulo
└── domain/configuration/
    └── treatment-values.ts  # el holdout se juzga con el mismo método

tests/
├── unit/domain/experiment/experiment.test.ts       # los 101 y los cinco rechazos
├── unit/domain/configuration/levels.test.ts        # el holdout
├── unit/composition/config.test.ts                 # la semilla y el arranque
└── integration/admin-experiments.test.ts           # [invariant:treatment-share-too-fine]
```

**Structure Decision**: los anillos de ADR-013, sin cambios. La feature vive **entera en el
dominio** salvo el contrato y sus pruebas: no hay caso de uso nuevo, ni puerto, ni gateway, ni
controller, ni cableado. Que sea así es la señal de que la regla está en su lugar — si hubiera hecho
falta tocar `application/` o `interface-adapters/`, sería que el dominio no la estaba protegiendo.

## Las tres decisiones que el plan tomó

1. **Cómo se juzga** (R-01): ida y vuelta por el balde, sin epsilon y **sin ningún número nuevo**.
   Descartados `multipleOf: 0.01` —falsa-rechaza 10 de 101 valores legítimos, `0.07` entre ellos— y
   el epsilon, que habría introducido una constante de comportamiento.
2. **Dónde vive** (R-02): método estático de `Experiment`. Ni en el kernel (movería el conocimiento
   de la resolución al lugar equivocado) ni como función suelta (`ope/domain-no-loose-functions` lo
   prohíbe, y ninguna de las dos opciones de la spec lo contemplaba).
3. **Qué motivo devuelve** (R-03): slug propio `treatment-share-too-fine`. No se amplía
   `invalid-treatment-share`, cuyo título dice «out of range» y mentiría sobre `0.075`.

## Lo que el plan contradice de la spec, con evidencia

**FR-008 se reemplaza.** La spec pedía aceptar un valor que difiera de un balde por el ruido de la
representación en punto flotante. La regla elegida lo rechaza, y está bien que lo haga:

- aceptar el ruido **es** ajustar en silencio, que es lo que la feature vino a eliminar;
- el ruido no llega por la red: `0.07`, `0.070000000000000007` y `7/100` son el mismo doble, y los
  tres se aceptan. El único ruido que sobrevive viene de una suma del cliente (`0.1 + 0.2`);
- rechazar es mejor servicio que ajustar: el cliente que suma mal se entera.

La regla nueva en su lugar: **la tasa tiene que ser exactamente la que su balde representa**. Todo
lo demás de la spec queda como está. La contradicción se registra en la enmienda de ADR-035.

## Orden de implementación

El contrato es el corte, como siempre: hasta que los tipos se regeneren no hay nada que cablear.
Después, las dos historias son independientes entre sí.

1. **Contrato** (bloquea todo): catálogo, invariante, descripción, ejemplo de la `422`, versión.
   `contract:check` y `contract:types`.
2. **US1 — el reparto** (P1): el método estático, el error, `Experiment.of`, y las pruebas: los 101,
   los cinco rechazos, la invariante y el camino de la semilla.
3. **US2 — el holdout** (P2): `TreatmentValues.judge` y sus pruebas por los tres caminos.
4. **US3 — los datos ya escritos** (P3): recorrer las tasas versionadas y arrancar el servidor.
5. **Cierre**: enmienda de ADR-035, `CLAUDE.md` si la convención cambia de texto, quickstart fechado,
   cadena completa y mutación.

**La prueba de regresión de la asignación se corre en el paso 2**, no al final: es el único lugar
donde esta feature puede cambiar comportamiento sin que nadie lo note.
