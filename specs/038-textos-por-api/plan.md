# Implementation Plan: Los textos se editan por API, en la capa base y en la de cada merchant

**Branch**: `038-textos-por-api` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/038-textos-por-api/spec.md`

## Summary

Los textos curados dejan de ser un archivo del release y pasan a publicarse por la API de administración,
clave por clave, en dos capas: la base, completa en cada idioma soportado, y la de cada merchant, dispersa.
Cada publicación es una versión inmutable por clave, con el trato de congelamiento de la feature 036 y
una definición propia de «experimento alcanzado». La voz se retira. Y la comprobación cruzada que faltaba
—un idioma se soporta sólo con la base completa en él— se hace al publicar idiomas, que es el único
momento en que se puede rechazar.

El molde es el de la 036 y la fase 0 encontró **cinco cosas** que le dan forma: la completitud es por
familia incondicional y no por valor de atributo (la spec se corrigió); el módulo `messages` tiene que
ganar tres dependencias en el mapa de contextos para ser dueño de sus casos de uso; el reinicio de ventana
sabe de niveles y no de textos, y el registro gana una causa; la comprobación cruzada entra a dos casos
de uso que no pueden crecer, así que va como decorador; y el reinicio de ventanas se extrae al módulo
`experiment`, que es su dueño, en vez de copiarse.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) con `strict`, como todo `src/`.

**Primary Dependencies**: ninguna nueva.

**Storage**: SQLite (D-21). Una tabla para las dos capas, con la capa como parte de la clave —el merchant,
o un centinela para la base— y `MAX(version)+1` por clave dentro de una transacción, como
`configuration_levels`. Una migración nueva. Los textos vigentes se sirven de un índice en memoria que la
misma escritura mantiene después del commit (ADR-041).

**Testing**: Vitest. Unitarias e integración en `fast`; lo que cruza un reinicio, en `durability`; la
latencia de SC-006, en `durability` con la medición existente. Stryker sobre el diff. Prueba de contrato
sobre el bundle.

**Target Platform**: el servidor del MVP, una instancia.

**Project Type**: backend con anillos (ADR-013). Módulo `messages` dueño de los textos y de sus casos de
uso; `configuration` gana la comprobación cruzada; `experiment` gana el reinicio de ventanas como servicio.

**Performance Goals**: el camino de decisión no gana I/O (FR-007). La búsqueda de un texto pasa de una
consulta en memoria a dos como máximo, capa del merchant y base, en el mismo mapa.

**Constraints**: lo que el SDK recibe no cambia de forma (FR-024). Seis dependencias como máximo por caso
de uso (ADR-023), y los dos casos de uso de publicación de la 036 que ganan la comprobación cruzada ya
están en cuatro y seis. El contrato está en construcción: el cambio incompatible entra con bump MINOR y
se reporta. Un caso de uso nunca invoca a otro.

**Scale/Scope**: 6 operaciones nuevas, 1 migración, 3 tipos de problema nuevos, 3 arcos nuevos en el
mapa de contextos, 1 servicio extraído a `experiment`, 1 decorador, 1 esquema retirado, la semilla
reescrita sin voz, y una enmienda de redacción a la constitución X.

## Constitution Check

_Constitución **v1.4.4**. Se evalúan los once principios; los que no aplican se marcan como tales._

| Principio                                           | Veredicto                                    | Por qué                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I. Separación de autoridades**                    | ✅ cumple                                    | `messages` sigue siendo el dueño de los textos y gana sus casos de uso; ninguna autoridad del plano de decisión cambia. El reinicio de ventanas pasa a su dueño natural, `experiment`, en vez de vivir copiado en dos módulos.                                                                                                                                                                                     |
| **II. Fail-closed**                                 | ✅ cumple, y cierra un hueco                 | Un texto inválido se rechaza nombrando el motivo; un idioma sin base completa no puede soportarse; y un almacén que no acepta escribir no deja ni versión ni entrada de auditoría (ADR-042). Hoy un idioma sin textos se acepta y la decisión calla sin que nada lo diga.                                                                                                                                          |
| **III. La medición precede y no se contamina**      | ⚠️ **tensión declarada, la misma de la 036** | Un texto es tratamiento y cambiarlo puede contaminar una medición en curso — y ya puede hoy, por deploy, sin motivo y sin reiniciar ventanas. La feature pone ese riesgo bajo la regla: motivo obligatorio, ventana reiniciada por experimento alcanzado, entrada en el registro, y **alcance acotado por clave e idioma** (FR-014). El principio queda mejor servido después que antes.                           |
| **IV. Dos caminos, dos garantías**                  | ✅ cumple                                    | Los textos se sirven de un índice en memoria; una publicación lo reemplaza después del commit. La búsqueda pasa de una consulta a dos en el mismo mapa. SC-006 lo mide con la medición existente.                                                                                                                                                                                                                  |
| **V. Aislamiento por merchant**                     | ✅ cumple, y es la historia 2                | La capa del merchant está en la clave; un texto de un merchant no se sirve nunca a otro (FR-011) y el alcance del operador se juzga contra el merchant de la ruta. La suite de durabilidad gana sus casos de contaminación cruzada.                                                                                                                                                                                |
| **VI. Identidad explícita, idempotencia explícita** | ✅ cumple, y la mejora                       | La versión de un texto pasa a ser acuñada por OPE y correlativa por clave, en lugar de un nombre escrito en un archivo que nadie obliga a cambiar. Un cuerpo idéntico repite la versión.                                                                                                                                                                                                                           |
| **VII. OPE observa comportamiento, no personas**    | ➖ no aplica                                 | Los textos son prosa de OPE; no hay datos de personas.                                                                                                                                                                                                                                                                                                                                                             |
| **VIII. Cero modelos de lenguaje en runtime**       | ✅ cumple                                    | Los textos siguen siendo curados por una persona y versionados; cambia quién los escribe y dónde se guardan, no quién los genera. Ninguna inferencia.                                                                                                                                                                                                                                                              |
| **IX. Nada entra al reporte sin trazabilidad**      | ✅ cumple, y es lo que la feature agrega     | Cada intervención ya estampa la versión del texto; ahora esa versión lleva a actor, instante, motivo y contenido en el historial de su clave (SC-005). Los identificadores viejos con voz no se reescriben.                                                                                                                                                                                                        |
| **X. Puertos en los dos bordes**                    | ⚠️ **enmienda de redacción**                 | Dice que el merchant elige «la versión del catálogo de mensajes». Con versiones por clave no hay versión del catálogo: el merchant recibe el último texto publicado de cada clave y lo que se estampa es la versión del texto. OPE sigue escribiendo y el merchant sigue eligiendo idiomas; «con qué voz» se retira. Es un parche PATCH de la constitución y va en la fase de cierre, con `/speckit-constitution`. |
| **XI. Ninguna política vive en el código**          | ✅ cumple                                    | Ningún valor nuevo de comportamiento: el largo máximo de un texto ya es una invariante del dominio, y las familias y los valores de atributo son vocabulario cerrado por diseño (ADR-036).                                                                                                                                                                                                                         |

**Veredicto**: pasa con una tensión declarada (III), la misma que la 036 registró y por el mismo motivo,
y una enmienda de redacción a X que la feature lleva.

## Project Structure

### Documentation (this feature)

```text
specs/038-textos-por-api/
├── plan.md              # Este archivo
├── research.md          # Fase 0: siete preguntas, cinco cambian el diseño derivado
├── data-model.md        # Fase 1: la clave, las dos capas, la versión, la causa de un reinicio, la migración
├── contracts/
│   └── http.md          # Fase 1: las seis operaciones, los tipos de problema y lo que se retira
├── quickstart.md        # Fase 1: cómo se verifica
├── checklists/
│   └── requirements.md  # Calidad de la spec
└── tasks.md             # Fase 2 (`/speckit-tasks`, no lo crea este comando)
```

### Source Code (repository root)

```text
contracts/
├── api-map.yaml                                   # 6 operaciones planned → built; capacidades texts:read/write
├── paths/admin-texts*.yaml, admin-merchant-texts*.yaml   # NUEVOS
├── components/schemas/Text*.yaml                  # NUEVOS; Voice.yaml se retira
├── problem-types.yaml                             # text-key-unknown, base-text-required, locale-incomplete
config/messages.json                               # la semilla, sin voz
migrations/006-texts.sql                           # NUEVA

src/
├── domain/
│   ├── shared-kernel/voice.ts                     # se retira
│   ├── messages/
│   │   ├── text-key.ts                            # NUEVO: la clave, juzgada contra el vocabulario
│   │   ├── text-version.ts                        # NUEVO: la versión de una clave (clase; registra «quitado»)
│   │   ├── completeness.ts                        # NUEVO: la regla por familia incondicional (hoy en composición)
│   │   └── errors.ts                              # TextKeyUnknown, BaseTextRequired, LocaleIncomplete
│   └── experiment/experiment.ts                   # WindowRestart gana la causa «texto»
├── application/
│   ├── messages/
│   │   ├── ports/text-store.ts                    # NUEVO: publicar, quitar, vigente, historial, completitud
│   │   ├── ports/message-corpus.ts                # la clave pierde la voz y gana el merchant
│   │   ├── services/reached-by-text.service.ts    # NUEVO: qué experimentos alcanza un texto
│   │   ├── services/message.service.ts            # merchant primero, base después, dentro de cada idioma
│   │   └── use-cases/{publish-text,publish-merchant-text,import-texts,list-text-versions,get-text-version}.use-case.ts
│   ├── experiment/services/window-restarts.service.ts   # NUEVO: extraído de configuration
│   └── configuration/
│       ├── ports/text-completeness.ts             # NUEVO: lo que configuration pregunta de messages
│       ├── decorators/complete-locales.ts         # NUEVO: la comprobación cruzada, sin crecer los casos de uso
│       └── services/reached-experiments.service.ts   # pierde el reinicio, que ahora pide a experiment
├── interface-adapters/messages/
│   ├── controllers/*.ts                           # 6 NUEVOS
│   ├── gateways/{memory,sqlite}-text-store.ts     # NUEVOS; el sqlite sirve también el corpus desde su índice
│   ├── gateways/memory-message-corpus.ts          # se retira (el almacén de textos lo reemplaza)
│   └── presenters.ts
├── composition/
│   ├── modules/messages.ts                        # serves, por tecnología; el corpus deja de venir del release
│   ├── modules/configuration.ts                   # el decorador alrededor de las dos publicaciones
│   ├── corpus-config.ts                           # lee la semilla; deja de juzgarla
│   └── bootstrap.ts                               # importa la semilla como importa los niveles
└── .dependency-cruiser.cjs                        # messages gana operator, merchant, experiment

tests/
├── unit/, integration/                            # fast
├── durability/texts.test.ts                       # NUEVO: reinicio, aislamiento, historial, degradación
└── contract-rules/                                # si una regla nueva lo pide
```

**Structure Decision**: sin estructura nueva. Lo nuevo entra en los directorios que ya existen de cada
módulo, y el único archivo de composición que gana responsabilidad es `bootstrap.ts`, que importa una
semilla más.

## Complexity Tracking

| Violation                                                           | Why Needed                                                                                                                                                              | Simpler Alternative Rejected Because                                                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principio III: una publicación puede contaminar una medición activa | Es el asunto de la feature, como en la 036: hoy ya pasa por deploy sin rastro. La regla lo pone bajo motivo, reinicio y registro, y acota el alcance por clave e idioma | Bloquear toda edición con experimentos activos deja al operador sin poder corregir un texto roto durante semanas; el dueño eligió motivo por texto (spec)  |
| `messages` gana tres arcos en el mapa de contextos                  | Sus casos de uso necesitan el actor, el alcance sobre el merchant y los experimentos alcanzados. Ninguno de los tres depende de `messages`, así que no hay ciclo (R-02) | Poner los casos de uso en `admin` separa la regla de su dueño; `admin` ya depende de `messages` y la regla de completitud quedaría en el módulo equivocado |
| Un decorador para la comprobación cruzada en `configuration`        | Los dos casos de uso que publican idiomas están en cuatro y seis dependencias; el segundo no puede ganar una (ADR-023), y la pregunta es la misma para los dos (R-05)   | Un servicio que envuelva la pregunta sigue siendo una dependencia; fusionar dos dependencias existentes para hacer lugar esconde una regla dentro de otra  |

## Diseño

### La clave y las dos capas

Una clave es familia, valor de atributo cuando la familia habla de uno, e idioma. La capa es el merchant,
o la base. El almacén guarda **versiones por clave y capa**, numeradas por OPE dentro de una transacción
como las de los niveles, y una versión puede decir «quitado». Lo vigente de cada clave es su versión más
alta; si dice «quitado», la clave no tiene texto en esa capa y resuelve a la base.

El corpus en memoria es un índice de lo vigente, llenado al construirse y mantenido por la misma escritura
después del commit (ADR-041, el patrón de merchants y experimentos). La búsqueda del servicio de mensajes
prueba, dentro de cada idioma, primero la capa del merchant y después la base; el orden de idiomas no
cambia.

### Alcanzado, para un texto

Un texto base alcanza a todo experimento activo de un merchant que **no** tiene texto propio vigente en esa
clave e idioma; un texto de merchant alcanza sólo a los experimentos activos de ese merchant. Es la
pregunta de la 036 con otra fuente de merchants fuera de alcance, y por eso es un servicio propio de
`messages` (R-03) que reutiliza el reinicio de ventanas extraído a `experiment` (R-04).

### La comprobación cruzada

Publicar idiomas en defaults o en un merchant pregunta a `messages` qué familias incondicionales faltan en
la base para cada idioma que entra como soportado o reserva, y rechaza nombrándolas. Va como decorador
alrededor de los dos casos de uso de publicación de la 036 (R-05): mira el contenido del request antes de
delegar, y no cambia la forma de ninguno.

### La semilla y la voz

`config/messages.json` pierde el campo de voz y pasa a ser semilla de la capa base: se importa en un
almacén vacío, a nombre del sistema, y la completitud se juzga **al importar** contra los idiomas que los
niveles sembrados soportan; el arranque deja de juzgarla. La voz se retira del tipo, de la clave, del
esquema del contrato y de los identificadores de versión; los identificadores ya estampados no se tocan.

## Constitution Check — re-evaluación después del diseño

Sin cambios de veredicto. Lo que el diseño acota mejor que la spec: el principio IV queda verificado por
construcción —el corpus es un índice en memoria que sólo cambia después de un commit— y el III queda con el
alcance más preciso que la spec pedía, por clave e idioma, con la fuente de «fuera de alcance» siendo el
propio almacén de textos.

Lo que el diseño agrega y conviene registrar: **la extracción del reinicio de ventanas a `experiment`
toca la 036**. No cambia su comportamiento ni sus pruebas de integración, y es lo que evita que la regla
de reinicio viva copiada en dos módulos que no pueden depender entre sí.

## Riesgos

- **Dos casos de uso de la 036 ganan un decorador.** Si la composición los envuelve mal, un idioma pasa
  sin base completa y nada lo dice hasta el `NO_OP`. La prueba de integración de la historia 4 es la que
  lo fija, y va antes del cableado.
- **El índice en memoria y la unidad de trabajo.** Una publicación que revierte no puede dejar el índice
  con un texto que la tabla no tiene: es exactamente la regla de orden de ADR-041, y se prueba igual.
- **La semilla sin voz rompe el arranque de un almacén viejo.** No: un almacén con textos no aplica la
  semilla; sólo un almacén vacío la lee, y la lee con la forma nueva. Un archivo con voz se rechaza
  nombrando el campo, por `additionalProperties`.
