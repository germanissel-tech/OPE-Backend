# Implementation Plan: El vocabulario deja de nombrar una prenda

**Branch**: `028-vocabulario-sin-vertical` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-vocabulario-sin-vertical/spec.md`

## Summary

Tres renombres del vocabulario cerrado de OPE, para que ninguno de sus miembros nombre un concepto de
indumentaria: el punto de anclaje y el evento del control que elige variante (`variant_selector`,
`variant_selector_interacted`), el bloque de la ficha donde la página explica si el producto va a
servir (`specifications`), y el tope de barreras declarables, que **se borra** porque el tipo ya lo
expresa. Ningún comportamiento observable cambia: la misma secuencia de señales produce la misma
barrera, el mismo escalón, el mismo anclaje y el mismo texto.

La feature existe porque **la fuente se enmendó primero**, el 2026-09-25, después de evaluarla con el
dueño. Sin esa enmienda, renombrar habría separado el código de la fuente de verdad #2.

Dos cosas se cierran de paso y no son renombres: el contrato le debía un anclaje a la fuente (cinco
listados, cuatro publicados) y generalizar los dos selectores en uno hace que la deuda **desaparezca**
en vez de pagarse; y el evento transporta un campo que ninguna autoridad lee, que se elimina.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`), `strict`, `erasableSyntaxOnly`,
`exactOptionalPropertyTypes`, ESM.

**Primary Dependencies**: sin dependencias nuevas. Fastify + openapi-backend en infraestructura,
Redocly/Spectral para el contrato, Vitest y Stryker para las pruebas.

**Storage**: en memoria, como hoy. Esta feature no toca persistencia.

**Testing**: Vitest (proyectos `fast` y `tools`), Schemathesis contra el contrato, Stryker sobre las
líneas cambiadas.

**Target Platform**: Node 22 en Linux/Windows; el contrato lo consume el SDK del navegador y la
plataforma del merchant.

**Project Type**: servicio HTTP con arquitectura en anillos (ADR-013).

**Performance Goals**: sin cambio. El camino crítico de decisión no gana ni pierde trabajo: un
renombre de literales no agrega ramas.

**Constraints**: el contrato lleva `info.x-stability: building` (ADR-003), así que los renombres
entran con bump **MINOR** y `contract:diff` los reporta y los acepta; `release-check` avisa. Nada
persistido que migrar (decisión del dueño, 2026-09-25). Cero llamadas a modelos en runtime.

**Scale/Scope**: 12 archivos del contrato, 5 de `src/`, 2 de `config/`, 2 del glosario y 27 de
`tests/` (R-00). Tres historias independientes.

## Constitution Check

**Constitución v1.4.3** (ratificada 2026-09-16, última enmienda 2026-09-24). Los **once** principios,
también los que no aplican, que se marcan como tales.

| Principio                                      | Veredicto      | Por qué                                                                                                                                                                                                                                |
| ---------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**               | ✅ sin impacto | Ningún motor cambia de responsabilidad. Se renombran literales que las autoridades ya leían.                                                                                                                                           |
| **II. Fail-closed: `NO_OP` por defecto**       | ✅ cumple      | El vocabulario sigue cerrado: un evento, un anclaje o un bloque con el nombre viejo se **rechaza nombrando el campo** (FR-010), no se acepta degradando.                                                                               |
| **III. La medición precede y no se contamina** | ⚠️ aplica      | El renombre de familias del corpus **acuña versiones nuevas** (R-06). Como nada está registrado, ninguna medición existente pierde su referencia; si lo hubiera, esto sería una migración y no un renombre.                            |
| **IV. Dos caminos, dos garantías**             | ➖ no aplica   | No se toca la separación entre el camino de decisión y el de medición.                                                                                                                                                                 |
| **V. Aislamiento por merchant**                | ✅ cumple      | El vocabulario es global y no lleva `merchantId`. Las pruebas de aislamiento existentes que nombran el vocabulario viejo se actualizan y **siguen corriendo**.                                                                         |
| **VI. Identidad e idempotencia explícitas**    | ➖ no aplica   | No se tocan identificadores de eventos, sesiones ni órdenes.                                                                                                                                                                           |
| **VII. Comportamiento, no personas**           | ✅ mejora      | Se **elimina** un campo que transportaba texto libre del merchant y que nadie leía (R-03). Menos dato que viaja.                                                                                                                       |
| **VIII. Cero modelos de lenguaje en runtime**  | ✅ cumple      | Ninguna llamada nueva; el corpus sigue siendo un archivo del release.                                                                                                                                                                  |
| **IX. Nada entra al reporte sin trazabilidad** | ✅ cumple      | Los identificadores de reglas que viajan al ledger se renombran con su vocabulario (R-05); ninguno queda nombrando algo que no existe.                                                                                                 |
| **X. Puertos en los dos bordes**               | ✅ cumple      | Ningún puerto cambia de forma. El `AnchorSet` del borde del front queda alineado con la fuente por primera vez.                                                                                                                        |
| **XI. Ninguna política vive en el código**     | ✅ mejora      | El tope de barreras **se borra** en vez de mudarse a una constante: el vocabulario lo acota y el esquema deja de declarar un número que era una política disfrazada (R-07). Los identificadores de reglas siguen siendo configuración. |

### Gates explícitos del flujo (constitución §Flujo de desarrollo)

| Gate                                                   | Respuesta                                                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Toca una superficie HTTP?                             | **Sí.** El delta se diseña en `specs/028-vocabulario-sin-vertical/contracts/` **antes** de cualquier tarea de código. No es compatible hacia atrás, y entra bajo `info.x-stability: building` (ADR-003), con bump MINOR. |
| ¿Toca persistencia o API?                              | **API.** Las pruebas de aislamiento por merchant que ya existen se actualizan al vocabulario nuevo y siguen en cada build.                                                                                               |
| ¿Toca el plano de decisión?                            | **Sí, por nombre.** No introduce I/O de red ni escritura bloqueante: un literal renombrado no agrega trabajo. Toda salida sigue pudiendo ser `NO_OP` con motivo.                                                         |
| ¿Toca el ledger o la cadena de evidencia?              | **Sólo los identificadores de reglas** que el ledger registra como motivo. Cada estado se sigue registrando explícitamente.                                                                                              |
| ¿Introduce un campo nuevo de evento u orden?           | **No: elimina uno.** El que se elimina no es PII —era la etiqueta del talle que la tienda muestra— y ninguna autoridad lo leía.                                                                                          |
| ¿Introduce una llamada a un modelo en runtime?         | No.                                                                                                                                                                                                                      |
| ¿Introduce una regla que el esquema no puede expresar? | **No, y quita una al revés**: el tope de barreras era un número en el esquema que el tipo ya garantizaba. No hace falta `x-invariants` nuevo.                                                                            |
| ¿Introduce un sustantivo nuevo en el contrato?         | **No.** `variant` y `specification` ya tienen su nota o resuelven al glosario; lo que cambia son notas que dejan de nombrar una prenda (R-09). `check:glossary` lo verifica en los dos sentidos.                         |
| ¿Toca `src/`?                                          | **Sí**, cinco archivos, sin cambiar la dirección de dependencias. `npm run arch` lo verifica.                                                                                                                            |

### Enmiendas de la constitución que esta feature propone

Dos viñetas de `Contrato de datos e identidad`, en un solo **PATCH** (R-08):

1. **Derivada de la fuente**: `fit` glosado como «(talle y calce)» pasa a «(calce)». La cláusula de
   Governance lo contempla: un principio derivado de un `DECIDIDO` de los documentos del MVP se
   enmienda **si el documento fuente cambia**, y cambió el 2026-09-25.
2. **Hallazgo, no alcance**: la viñeta `Escalas` contradice a **ADR-035** desde la feature 022. La
   constitución prevalece sobre todo, así que la contradicción es peligrosa y no cosmética. Se
   propone corregirla acá; si el dueño prefiere separarla, se registra como deuda y esta feature
   hace sólo la primera.

## Project Structure

### Documentation (this feature)

```text
specs/028-vocabulario-sin-vertical/
├── plan.md              # este archivo
├── spec.md
├── research.md          # fase 0: las diez decisiones con lo medido
├── data-model.md        # fase 1: los vocabularios, antes y después
├── quickstart.md        # fase 1: cómo se verifica
├── contracts/           # fase 1: el delta del contrato, antes de tocar código
└── checklists/
```

### Source Code (repository root)

```text
contracts/
├── components/schemas/{Anchor,AnchorMap,BlockDwelled,Event}.yaml   # el vocabulario
├── components/schemas/SizeSelectorInteracted.yaml                  # se renombra el archivo
├── components/schemas/MerchantConfigurationDeclared.yaml           # el tope de barreras
├── examples/{event-batch,exposure-confirmation}.yaml
└── paths/{admin-configuration,admin-diagnostics,admin-treatment-defaults,sdk-config,sdk-diagnostics}.yaml

src/
├── domain/shared-kernel/intervention.ts   # ANCHORS
├── domain/ingestion/event.ts              # EVENT_TYPES, el evento, BLOCKS
├── domain/barrier/signals.ts              # el switch exhaustivo del extractor
├── domain/selection/candidate.ts          # las familias de candidatos
└── interface-adapters/ingestion/controllers/ingest-events.ts

config/
├── treatment-defaults.json   # las reglas y sus identificadores
└── messages.json             # las familias del corpus y sus versiones

docs/dominio/
├── anclaje.md
└── eventos/interaccion-con-selector-de-talle.md   # el archivo se renombra
```

**Structure Decision**: sin estructura nueva. La feature cambia literales de vocabulario en los
anillos que ya los declaran: el kernel compartido (anclajes), ingesta (tipos de evento y bloques) y
selección (familias de candidatos). El mapa de contextos no cambia y `npm run arch` es el gate.

## Complexity Tracking

Sin violaciones que justificar. La feature **quita** complejidad en tres lugares: un campo de evento
que nadie leía, un número del esquema que el tipo ya garantizaba, y un anclaje faltante que deja de
faltar sin agregarlo.
