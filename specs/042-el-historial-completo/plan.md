# Implementation Plan: El historial completo

**Branch**: `042-el-historial-completo` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/042-el-historial-completo/spec.md`

## Summary

Toda lectura de una versión de configuración o de texto dice qué mediciones reinició: la publicación,
su repetición, el historial y la versión por número, en los cinco historiales. La configuración del
merchant declara el dato como las globales, y se lee por su número con una operación nueva del
consumidor `admin`.

**Lo que la investigación cambió** ([`research.md`](research.md)): el dato **ya está escrito**. Cada
experimento registra qué versión reinició su ventana (036 y 038), y la versión no guarda nada. Así que
las lecturas **derivan** la lista de esos registros en vez de guardarla (R-01). Es el hecho y no una
afirmación anterior a él, cubre lo publicado desde la 036, y no toca ningún esquema del almacén. La
pregunta es del experimento y se contesta desde el índice en memoria (R-02). Para el merchant, que
numera por merchant, se filtra además por el merchant (R-03). Una publicación repetida responde lo
mismo que la lectura (R-04).

**Lo que toca `src/`**: una regla en la entidad `Experiment`, una lectura en `ExperimentStore` y una
pregunta en `WindowRestartsService`; las cuatro lecturas de niveles, las dos del merchant y las cuatro
de textos ganan la lista; las dos publicaciones de configuración y las de textos la usan al repetir;
`ConfigurationStore.versionOf`, un caso de uso y un controller nuevos; los presentadores dejan de
inventar la lista vacía. Nada en infraestructura ni en el plano de decisión.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas (ADR-011, ADR-017). YAML
para el contrato.

**Primary Dependencies**: las de siempre (openapi-backend, Vitest, Stryker, Spectral, Redocly). Ninguna
nueva.

**Storage**: SQLite por los gateways existentes. Sin migración: nada nuevo se guarda (R-01). Una
consulta nueva de lectura en el gateway de configuración del merchant (R-06).

**Testing**: unidad (la regla `restartedBy`; el servicio), integración sobre el servidor en memoria
(`levels-history`, `admin-configuration`, `messages/base-text`, `messages/merchant-text`,
`isolation`), durabilidad (`experiment-store`, `configuration-store`), contrato. Mutación sobre lo nuevo
(ADR-016).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es de su contrato y de los módulos
`configuration`, `messages` y `experiment`.

**Performance Goals**: ninguno nuevo. Las lecturas son de administración y recorren un índice en
memoria (R-02); el camino de decisión no cambia.

**Constraints**: contrato `1.14.0`, compatible (R-07); `CONTEXT_MAP` intacto (configuración y
mensajes ya dependen de experimentos, y no al revés); ninguna política en el código.

**Scale/Scope**: una operación, un campo opcional, tres descripciones; una regla de dominio, una lectura
de puerto, una pregunta de servicio, un caso de uso, un controller; diez lecturas y cuatro publicaciones
que ganan la lista.

## Constitution Check

**Constitución v1.5.1.** Los once principios, evaluados; los que no aplican se marcan como tales y se
dice por qué.

| Principio                                        | Aplica            | Cómo se cumple / por qué no aplica                                                                                                                                                                                                                         |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                | Ninguna autoridad de decisión lee el historial.                                                                                                                                                                                                            |
| **II. Fail-closed: `NO_OP` por defecto**         | No                | No hay decisión ni salida al SDK.                                                                                                                                                                                                                          |
| **III. La medición precede y no se contamina**   | Sí, de lectura    | Lo que se lee es el registro de la medición —qué ventana se reinició y por qué—, sin escribir nada. Hace visible lo que III protege: el costo de cada correctiva en la medición.                                                                           |
| **IV. Dos caminos, dos garantías**               | No                | Ni el camino de decisión ni el de medición cambian.                                                                                                                                                                                                        |
| **V. Aislamiento por merchant**                  | **Sí**            | `merchantId` sólo en la ruta `admin` (v1.2.0, ADR-020). La versión por número pasa por `ScopedMerchantService` (fuera de alcance: `403` sin revelar). Las preguntas del merchant filtran por su merchant (R-03), y `isolation.test.ts` gana los dos casos. |
| **VI. Identidad e idempotencia explícitas**      | Sí                | La versión se identifica por merchant y número. La repetición idempotente de una publicación responde lo mismo que la original (R-04), en vez de una lista vacía.                                                                                          |
| **VII. OPE observa comportamiento, no personas** | No                | Los identificadores de experimento y de versión no son datos personales.                                                                                                                                                                                   |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente) | Ninguna llamada nueva.                                                                                                                                                                                                                                     |
| **IX. Nada entra al reporte sin trazabilidad**   | No                | Nada de esto entra al reporte.                                                                                                                                                                                                                             |
| **X. Puertos en los dos bordes**                 | No                | No hay borde de integración nuevo.                                                                                                                                                                                                                         |
| **XI. Ninguna política vive en el código**       | Sí                | Ningún valor de comportamiento nuevo; `check:behaviour-constants` lo verifica.                                                                                                                                                                             |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** **Sí.** Diseñada en [`contracts/historial.md`](contracts/historial.md)
  antes de cualquier tarea de código; compatible (R-07). Dispara el orden de seis pasos de
  `.claude/rules/contrato.md`, empezando por `api-map.yaml`.
- **¿Toca persistencia o API?** Las dos, de lectura. Sin migración. Durabilidad: la lista sobrevive un
  reinicio y `versionOf` lee del almacén. Aislamiento: dos casos nuevos y la suite entera.
- **¿Toca el plano de decisión?** No.
- **¿Toca el ledger o la cadena de evidencia?** No.
- **¿Campo nuevo de evento u orden?** No.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** No: «no existe» es el problema existente
  `configuration-version-not-found`, sin invariante nuevo.
- **¿Sustantivo nuevo en el contrato?** No.
- **¿Toca `src/`?** Sí: `domain/experiment` (la regla), `application/experiment` (puerto y servicio),
  `application/configuration` y `application/messages` (lecturas y repeticiones),
  `interface-adapters/{experiment,configuration,messages}` (gateways, controller, presentadores),
  `composition/modules/configuration.ts`. Dirección de dependencias intacta; `npm run arch` lo
  verifica.

**Resultado: pasa, sin enmiendas ni complejidad que justificar.** Re-evaluado después del diseño de la
fase 1: igual.

## Project Structure

### Documentation (this feature)

```text
specs/042-el-historial-completo/
├── spec.md
├── plan.md                 # Este archivo
├── research.md             # Fase 0: ocho hallazgos
├── data-model.md           # Fase 1: la pregunta, quién la hace, la versión por número
├── contracts/
│   └── historial.md        # Fase 1: el cambio de contrato y lo que el servidor hace
├── quickstart.md           # Fase 1: cómo se verifica
└── tasks.md                # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

Lo que la feature toca, y nada más:

```text
contracts/
├── openapi.yaml                                         info.version 1.14.0; la ruta nueva
├── api-map.yaml                                         getMerchantConfigurationVersion: planned → built ("042")
├── paths/admin-configuration-version.yaml               NUEVO
└── components/schemas/
    ├── MerchantConfigurationVersion.yaml                windowsRestarted
    ├── PlatformConfigurationVersion.yaml                la descripción
    ├── TreatmentDefaultsVersion.yaml                    la descripción
    └── TextVersion.yaml                                 la descripción
src/
├── domain/experiment/experiment.ts                      restartedBy(source)
├── application/experiment/ports/experiment-store.ts     all()
├── application/experiment/services/window-restarts.service.ts   restartedBy(source, merchantId?)
├── application/configuration/ports/configuration-store.ts       versionOf(merchantId, version)
├── application/configuration/use-cases/
│   ├── get-merchant-configuration-version.use-case.ts   NUEVO
│   ├── list-configuration-versions.use-case.ts          la lista por versión
│   ├── list-level-versions.use-case.ts                  ídem
│   ├── get-level-version.use-case.ts                    ídem
│   ├── publish-level.use-case.ts                        la repetición pregunta
│   └── publish-merchant-configuration.use-case.ts       windowsRestarted; la repetición pregunta
├── application/messages/use-cases/                      las cuatro lecturas de textos y las dos publicaciones
├── interface-adapters/experiment/gateways/              all() en memoria y durable
├── interface-adapters/configuration/
│   ├── gateways/{memory,sqlite}-configuration-store.ts  versionOf
│   ├── controllers/get-merchant-configuration-version.ts   NUEVO
│   └── presenters.ts                                    sin la lista vacía inventada
├── interface-adapters/messages/presenters.ts            ídem
└── composition/modules/configuration.ts                 el handler nuevo; las dependencias nuevas
tests/
├── unit/domain/experiment/, unit/application/experiment/
├── integration/{levels-history,admin-configuration,isolation}.test.ts
├── integration/messages/{base-text,merchant-text}.test.ts
└── durability/{experiment-store,configuration-store}.test.ts
```

**Structure Decision**: la del repositorio, por anillos y módulos (ADR-013). Ningún módulo nuevo.

## Tramos

1. **El contrato** (pasos 0 a 3 de `contrato.md`): el mapa, la operación, el campo, las descripciones,
   `contract:check` y `contract:types`.
2. **La pregunta** (US1, base): la regla, la lectura del puerto y el servicio, con sus pruebas.
3. **Las lecturas globales y de textos** (US1): niveles y textos, sus repeticiones y presentadores.
4. **El merchant** (US1 y US2): la publicación y el historial con la lista, `versionOf`, el caso de uso
   y el controller nuevos, aislamiento y durabilidad.
5. **El cierre**: la cadena de gates (`format:check`, `quality`, `typecheck`, `test`, `test:durability`,
   `test:mutation`, `test:contract`, `release-check`), el quickstart a mano, `api-map` a `built`.

## Complexity Tracking

Nada que justificar.
