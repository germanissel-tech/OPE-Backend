# Implementation Plan: El catálogo de mensajes

**Branch**: `027-catalogo-de-mensajes` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-catalogo-de-mensajes/spec.md`

## Summary

El plano de decisión funciona entero y no se ve: cada intervención devuelve un identificador que no
resuelve a ningún texto. Esta feature lo viste.

El mecanismo que fijan las tres decisiones del 2026-09-24: **OPE declara un vocabulario cerrado de
valores de atributo y escribe prosa curada para cada uno; el merchant traduce sus etiquetas**. El
corpus es un activo del release; lo que se publica por merchant es sólo lo que varía —versión, voz,
idiomas, correspondencia de etiquetas—.

**Sin texto, la familia no es candidata** (`01 §322`): la disponibilidad de texto filtra candidatos
dentro de la selección, junto al quality gate, y no degrada una intervención ya decidida. Así un
merchant con corpus incompleto sigue interviniendo con un escalón más bajo en vez de callarse, y el
orquestador no elige mensajes — que es lo que el principio I le prohíbe por su nombre.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`), `strict`, `erasableSyntaxOnly`.

**Primary Dependencies**: ninguna nueva. El corpus es un archivo del repositorio leído por un
puerto; el mecanismo de valores pendientes reusa la forma de los diagnósticos de anclajes.

**Storage**: en memoria detrás de puertos, como todo lo demás hasta el hito de persistencia.

**Testing**: unitarias del dominio y del filtro, integración por `fastify.inject`, réplicas
contra el contrato (voz, motivo de `NO_OP`), y las invariantes del corpus verificadas al arrancar.

**Target Platform**: el mismo servidor.

**Project Type**: módulo nuevo en los tres anillos, más cambios acotados en el contrato y en la
configuración del merchant.

**Performance Goals**: la resolución del texto ocurre en el camino crítico de decisión, así que **sin I/O de red
ni escritura bloqueante**: el corpus se resuelve desde memoria, cargado al arrancar.

**Constraints**: cero modelos de lenguaje en runtime; todo texto escrito y revisado por una persona
antes de servirse; una versión de texto es inmutable; `message-unavailable` no puede confundirse con
una decisión de callarse; el valor crudo del merchant no se muestra nunca.

**Scale/Scope**: un módulo nuevo (`messages`), un filtro en la selección, tres puertos, un activo del release,
tres campos nuevos de configuración del merchant, un motivo de `NO_OP`, una operación que **se
retira** del mapa antes de construirse.

## Constitution Check

Constitución **v1.4.3** (enmendada por esta feature; ver R-01). Los once principios:

| #    | Principio                              | Veredicto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Separación de autoridades              | **Es el principio que más manda acá.** Dice literalmente que el orquestador «MUST NOT … **elegir mensajes**», así que la elección del texto vive en la **autoridad de selección**, que es donde `01 §322` la pone: sin texto, la familia no es candidata. El orquestador arma el contexto e invoca; el veredicto lo sigue emitiendo sólo la política comercial (research R-03)                                                                                                                                                                                     |
| II   | Fail-closed                            | **Se respeta, y es el corazón del diseño.** Sin texto aplicable ⇒ `NO_OP` `message-unavailable`, nunca un texto aproximado, nunca uno en otro idioma, nunca el valor crudo del merchant. Las invariantes del corpus se verifican **al arrancar**: un corpus incoherente no arranca el servidor                                                                                                                                                                                                                                                                     |
| III  | La medición precede y no se contamina  | **Se respeta, y hay que cuidarlo en un punto.** El texto depende sólo del producto, del idioma de la página y de la configuración del merchant — **nunca de un rasgo de la persona** (`FR-010`), porque eso volvería la voz una variable no controlada dentro de un brazo. Un `message-unavailable` en TREATMENT es una intervención asignada y no entregada: queda registrada con su motivo, que es lo que el ITT necesita para no confundirla con CONTROL                                                                                                        |
| IV   | Dos caminos, dos garantías             | **N/A.** La feature no toca ingesta ni outcomes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| V    | Aislamiento por merchant               | **Se respeta.** La versión, la voz, los idiomas y la correspondencia de etiquetas son configuración del merchant, resuelta por su credencial; el corpus compartido no lleva nada de ningún merchant. La feature incluye pruebas de aislamiento porque toca configuración                                                                                                                                                                                                                                                                                           |
| VI   | Identidad e idempotencia               | **Se respeta en lo que aplica**: una versión de texto es un identificador estable e **inmutable**; corregir acuña una versión nueva. Sin eso, un cambio del corpus reescribiría lo que el ledger dice que se mostró                                                                                                                                                                                                                                                                                                                                                |
| VII  | Comportamiento, no personas            | **Se respeta.** Ningún dato de la persona entra en la elección del texto, y el corpus no admite ninguna clave que dependa de ella. La tentación —elegir la voz por la persona inferida— está **explícitamente fuera de alcance** en la spec                                                                                                                                                                                                                                                                                                                        |
| VIII | Cero modelos de lenguaje en runtime    | **Se respeta, y el principio respalda el diseño.** Dice que los mensajes «son curados y versionados; el runtime los lee de un almacén» y que «la **redacción del catálogo de mensajes**» es un uso offline cuyas salidas «se revisan y versionan **antes de servirse**». Un activo del repositorio es exactamente eso: la revisión previa a servirse es la revisión del cambio                                                                                                                                                                                     |
| IX   | Nada entra al reporte sin trazabilidad | **Se respeta.** `DecisionRecord.intervention` ya lleva la versión del mensaje; lo que cambia es que deja de ser un placeholder. Por eso el texto se resuelve **antes** del veredicto y del registro: el registro tiene que poder decir qué leyó la persona                                                                                                                                                                                                                                                                                                         |
| X    | Puertos en los dos bordes              | **Pasa, con una tensión que el ADR deja escrita.** El principio enumera el «catálogo de mensajes» entre lo que varía por merchant como configuración versionada. Con los textos escritos por OPE, la prosa deja de variar por merchant; **lo que varía —voz, idiomas, correspondencia— sí es configuración versionada**, por el camino que ya existe. El principio se cumple en su intención (nada que varíe por merchant vive en el código). Queda para el dueño: si prefiere la lectura literal, la alternativa es una enmienda, no este reparto (research R-01) |
| XI   | Ninguna política vive en el código     | **Se respeta.** El tope de valores pendientes es nivel plataforma; la voz, la cadena y la correspondencia son del merchant. El corpus **no es una política**: no gobierna comportamiento, es el contenido que se muestra — y por eso es un activo propio y no un cuarto nivel de configuración                                                                                                                                                                                                                                                                     |

**Gate de superficie HTTP**: aplica. Cambia `Intervention` (lleva el texto), se agregan campos a la configuración del merchant, se agrega el motivo
`message-unavailable` y **se retira `publishMessageCatalog` del mapa**. Todo incompatible entra con
bump MINOR conservando `/v1/` mientras el contrato lleve `info.x-stability: building` (ADR-003);
`contract:diff` lo reporta y lo acepta.

**Gate de documentación viva**: aplica. un ADR nuevo al cerrar la feature (research R-08), notas de dominio para los
sustantivos nuevos —voz, valor de atributo, versión de mensaje— y la fila del
corpus en el inventario de su directorio (ADR-032).

**Sin violaciones**: la sección _Complexity Tracking_ queda vacía y se elimina.

## Project Structure

### Documentation (this feature)

```text
specs/027-catalogo-de-mensajes/
├── spec.md
├── plan.md              # este archivo
├── research.md          # R-01..R-08
├── data-model.md        # el vocabulario, con sus invariantes y su dueño
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
contracts/
├── components/schemas/Intervention.yaml    # lleva el texto; su descripción cambia
├── components/schemas/MerchantConfigurationDeclared.yaml  # voz, cadena, correspondencia
├── no-op-reasons.yaml                      # message-unavailable
├── problem-types.yaml                      # los errores del módulo
└── api-map.yaml                            # publishMessageCatalog se retira

config/                                     # el corpus, como activo del release

src/domain/messages/                        # CuratedText, LocaleChain, MessageOutcome, ids, errors
src/application/messages/
├── services/message.service.ts             # resuelve el texto de una familia
└── ports/                                  # MessageCorpus, MessageDirectory, UnmappedValueLog
src/interface-adapters/messages/            # gateways, index
src/composition/modules/messages.ts         # + una línea en deployments/local.ts y otra en CONTEXT_MAP

src/application/decision/ports/message-plane.ts   # lo que decision declara y messages implementa

docs/adr/036-*.md
docs/dominio/                               # los sustantivos nuevos
```

**Structure Decision**: módulo nuevo `messages` en los tres anillos, con dependencias mínimas
(`[shared-kernel, selection]`). `decision` **no importa `messages`**: declara el puerto y la
composición enlaza, igual que `ingestion` declara `DecisionPlane` (ADR-026).

## Las decisiones del plan

1. **El corpus es un activo del release y `publishMessageCatalog` se retira** (R-01). Con los
   textos escritos por OPE, una operación por merchant deja a la prosa duplicada en cada uno y
   permite publicar texto que nadie revisó. Lo que sí es configuración del merchant —voz, cadena,
   correspondencia— entra por donde ya entra todo lo suyo. **La operación está planeada y no
   construida**: retirarla ahora es gratis y después cuesta una versión mayor.
2. **Sin texto, la familia no es candidata** (R-03), que es lo que `01 §322` decide. El filtro vive
   en la selección, junto al quality gate, que sigue siendo puro porque la disponibilidad de texto
   le llega como evidencia. Un merchant con corpus incompleto interviene con un escalón más bajo en
   vez de callarse.
3. **`message-unavailable` es un motivo de `NO_OP`** (R-02). `ledger-unavailable` es el precedente
   exacto: una falla de entrega, no una decisión de callarse, distinguible por su motivo. Y los
   presupuestos no se consumen, porque el orquestador ya los consume sólo si hubo intervención.
4. **El vocabulario de valores es cerrado y de OPE; la correspondencia es del merchant** (R-04),
   con el patrón de `AnchorMap`, que el merchant ya tuvo que entender.
5. **El texto viaja en la respuesta** (R-05). Cambia la descripción de `Intervention`, que hoy dice
   lo contrario. `messageVersionId` se conserva: el texto es para renderizar, la versión para medir.
6. **El idioma de reserva se queda como está** (R-06): uno y opcional, como `01 §14.2` lo decide. El idioma manda sobre la voz.
7. **Prosa completa, sin huecos** (R-07): una plantilla rompe la concordancia del castellano y lee a
   ficha técnica.
8. **Un ADR nuevo al cerrar la feature, sin enmienda de la constitución** (R-08). Se escribe cuando sus identificadores existen: el gate de identificadores verifica contra el contrato y el código lo que un ADR cita.

## Lo que el plan agrega a la spec

**Tres cosas que aparecieron al leer la constitución y el código, y que la spec no podía saber:**

1. **`01 §322` decide dónde vive el filtro, y corrigió a este plan.** La primera versión proponía
   una autoridad nueva después del veredicto; la fuente dice que sin texto la familia **no es
   candidata**. Es mejor —con corpus parcial se interviene más abajo en vez de callarse—, es una
   autoridad menos, y deja a `decision.service.ts` (hoy en 267 de 300 líneas) sin crecer.
2. **El principio X había perdido una palabra.** Su fuente (`01 §14.2`) dice «versión del catálogo
   de mensajes» y la paráfrasis escribió «catálogo de mensajes», que se lee como que el contenido
   varía por merchant. Enmendado por decisión del dueño del 2026-09-24: constitución **1.4.3**,
   PATCH, sin tocar los documentos del MVP porque restaura lo que la fuente ya decía.
3. **`FR-018` ya está estructuralmente cumplido**: `DecisionRecord.intervention` lleva
   `messageVersionId` desde la feature 011. Lo que falta no es el campo sino la **inmutabilidad de
   la versión**, sin la cual un cambio del corpus reescribe el pasado del ledger.

## Orden de implementación

1. **US1 — el SDK muestra texto real.** El módulo, el filtro en la selección, el corpus con su estructura
   completa (una voz, un idioma), el motivo de `NO_OP`, el cambio de `Intervention` y el registro de
   la versión. **Sola ya vuelve visible todo el plano de decisión**, que es lo que la feature viene a
   arreglar.
2. **US2 — dos productos dicen cosas distintas.** El vocabulario de valores, la prosa por valor, la
   correspondencia del merchant y el candidato que afirma un atributo. Es la decisión del
   stakeholder y lo que hace que el catálogo escale.
3. **US3 — los valores sin mapear.** Última: el sistema es correcto sin ella, sólo ciego.

**Cada cambio del contrato va antes que su código**, y el contrato antes que los tipos generados: es
el orden de seis pasos que rige toda feature que toca HTTP.
