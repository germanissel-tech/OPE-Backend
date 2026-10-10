# Implementation Plan: El puerto de plataforma

**Branch**: `044-el-puerto-de-plataforma` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/044-el-puerto-de-plataforma/spec.md`

## Summary

Las cuatro operaciones del puerto (constitución X) son cuatro casos de uso del núcleo: los tres que ya deposita el
`push` y uno nuevo, el refresco parcial de stock y precio. Un adaptador es lo que los llama: el genérico son los
controllers del `push`, sin cambios; el `pull` es un planificador que trae de una **fuente** de plataforma a la
cadencia que configura el merchant; el `subscribe` es un aviso autenticado que entra a una cola durable y obliga a
leer. La fuente de prueba, instalada sólo en las pruebas y en `npm run dev`, recorre el circuito completo sin
ninguna plataforma real.

**Lo que la investigación cambió** ([`research.md`](research.md)):

- **El planificador no es un caso de uso**: un caso de uso no invoca a otro, así que vive en el borde y conduce,
  como un controller (R-03).
- **El refresco es una capa sobre la foto**: tabla por variante, verdad = el dato más nuevo, frescura por variante;
  la foto conserva su idempotencia (R-04).
- **El aviso es de otro consumidor**: el mapa ata un consumidor a un esquema de seguridad, y la clave del aviso no
  debe poder depositar nada (R-06).
- **El refresco tiene su propio tag**: es idempotente por ítem, no por pedido (R-12).
- **Un modo que nada ejecuta no se publica, y un modo que no rige no se acepta**: el primero lo juzga la
  configuración contra las fuentes instaladas; el segundo, un decorador delante de cada caso de uso (R-08).

**Lo que toca `src/`**: un módulo nuevo, `platform`; en `catalog`, el caso de uso del refresco, el almacén por
variante y la verdad de producto; en `merchant`, la credencial de aviso; en `configuration`, los valores nuevos y su
juicio; una migración; la composición del planificador y de la fuente de prueba.

## Technical Context

**Language/Version**: TypeScript 7 (`@typescript/native`) en `src/` y pruebas (ADR-011, ADR-017). YAML para el
contrato, SQL para la migración.

**Primary Dependencies**: las de hoy (openapi-backend, `node:sqlite` por el enlace, Spectral, Redocly). Ninguna
nueva.

**Storage**: SQLite, migración `007-platform-port.sql`: `stock_and_price`, `platform_sync`, `platform_notices`, con
la convención de `migrations/README.md`. La credencial de aviso viaja en el documento del merchant, sin migración.

**Testing**: unidad (verdad por variante, juicio de la configuración, planificador con reloj y fuente guionada),
integración sobre el servidor en memoria con la fuente de prueba (refresco, modo, órdenes por `pull`, aviso,
aislamiento, el circuito), durabilidad (cursor, refrescos, avisos), contrato. Mutación sobre lo nuevo (ADR-016).

**Target Platform**: el mismo servidor; `ubuntu-latest` en CI, Windows en desarrollo.

**Project Type**: backend de un servicio; la feature es del borde de plataforma, de los módulos `catalog`,
`merchant` y `configuration`, y de un módulo nuevo.

**Performance Goals**: la decisión no cambia (SC-005). El planificador corre en su tick, con `unref()`, y una
corrida lenta no frena a la siguiente de otro flujo.

**Constraints**: contrato `1.16.0`, incompatible sólo en los contenidos de los niveles, por `building`; ninguna
política en el código (las cadencias, el lote y los reintentos son configuración); instancia única.

**Scale/Scope**: cuatro operaciones, un consumidor, un tag, un esquema de seguridad, tres tipos de problema; un
módulo, un caso de uso de catálogo, dos de plataforma, un decorador; tres tablas; una fuente; un ADR.

## Constitution Check

**Constitución v1.5.1.** Los once principios, evaluados; los que no aplican se marcan como tales y se dice por qué.

| Principio                                        | Aplica                 | Cómo se cumple / por qué no aplica                                                                                                                                                                                                 |
| ------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Separación de autoridades**                 | No                     | Ninguna autoridad cambia; la verdad de producto sigue llegando a la decisión por `ProductTruthService`.                                                                                                                            |
| **II. Fail-closed: `NO_OP` por defecto**         | **Sí**                 | Una variante que el ciclo no alcanzó envejece y se calla sola (R-04); una plataforma caída baja el nivel; órdenes sin estados confirmados no se pueden configurar (R-07).                                                          |
| **III. La medición precede y no se contamina**   | Sí                     | Lo registrado por `pull` y `subscribe` pasa por los mismos casos de uso que el `push`, con la misma idempotencia por `orderId`; un aviso nunca registra su propio contenido.                                                       |
| **IV. Dos caminos, dos garantías**               | **Sí**                 | El planificador y el aviso corren fuera del camino de decisión; ninguna llamada a la fuente desde la decisión, y una prueba con una fuente que no responde lo afirma (FR-013). Instancia única: la no superposición es en memoria. |
| **V. Aislamiento por merchant**                  | **Sí**                 | El merchant sale de la credencial (`push`, aviso) o de la iteración del planificador; cada tabla nueva lleva `merchant_id` en la clave. `isolation.test.ts` gana los tres modos.                                                   |
| **VI. Identidad e idempotencia explícitas**      | **Sí**                 | `orderId` sigue siendo la única identidad de compra, también por `pull` y `subscribe`; el refresco es idempotente por variante e instante; el aviso, por merchant, flujo y referencia mientras está pendiente.                     |
| **VII. OPE observa comportamiento, no personas** | Sí                     | Lo que trae la fuente se traduce a los mismos esquemas de lista blanca; el estado del aviso y los rastros no llevan datos personales; ningún esquema nuevo declara uno (lo verifica el lint).                                      |
| **VIII. Cero modelos de lenguaje en runtime**    | Sí (trivialmente)      | Ninguna llamada nueva.                                                                                                                                                                                                             |
| **IX. Nada entra al reporte sin trazabilidad**   | Sí, de forma indirecta | Cada orden traída conserva la misma cadena de evidencia que la empujada; la correlación sigue siendo sólo por sesión conocida.                                                                                                     |
| **X. Puertos en los dos bordes**                 | **Sí**                 | Es el principio que la feature construye: cuatro operaciones, el núcleo sin saber plataforma ni modo, el adaptador genérico y el de prueba. Magento 2 es la feature siguiente.                                                     |
| **XI. Ninguna política vive en el código**       | **Sí**                 | Cadencias, lote, reintentos, estados confirmados y fuente son configuración versionada; el tick, nivel de plataforma. El código conserva el algoritmo: el dato más nuevo gana, el cursor avanza después de depositar.              |

**Gates explícitos del Constitution Check** (constitución, Flujo de desarrollo, punto 2):

- **¿Toca una superficie HTTP?** **Sí.** Diseñada en [`contracts/puerto.md`](contracts/puerto.md) antes de cualquier
  tarea de código. Compatible salvo los campos requeridos de los contenidos de los niveles, que entran por la marca
  `building` (ADR-003) con versión menor y el reporte de `contract:diff` citado. Dispara el orden de seis pasos de
  `.claude/rules/contrato.md`.
- **¿Toca persistencia o API?** Las dos. Tres tablas nuevas; pruebas de aislamiento en los tres modos y de
  durabilidad del cursor, los refrescos y los avisos.
- **¿Toca el plano de decisión?** Lo lee: `ProductTruthService` mide la frescura por variante. No agrega I/O de red
  ni escritura; toda salida sigue pudiendo ser `NO_OP` con motivo.
- **¿Toca el ledger o la cadena de evidencia?** Lo alimenta por los casos de uso existentes, sin cambiar qué
  registra.
- **¿Campo nuevo de evento u orden?** No: la orden traída tiene la forma de la empujada.
- **¿Llamada a un modelo de lenguaje en runtime?** No.
- **¿Regla de negocio que el esquema no expresa?** **Sí**: `sync-mode-not-configured` (estado de otro recurso),
  `stock-captured-in-future` y `stock-and-price-duplicate-variant-id`, con `x-invariants` y sus pruebas
  `[invariant:…]` (ADR-007).
- **¿Sustantivo nuevo en el contrato?** **Sí**: aviso, fuente de plataforma, regla de confirmación, refresco de
  stock y precio, con su nota en `docs/dominio/` antes del contrato (ADR-008).
- **¿Toca `src/`?** Sí: un módulo nuevo con su línea en `CONTEXT_MAP` y en `deployments/local.ts`; `npm run arch` lo
  verifica.

**Resultado: pasa.** El cambio incompatible de los contenidos de los niveles es el mismo caso que la 041 y la 043
resolvieron con `building`. Re-evaluado después del diseño de la fase 1: igual. Que cada refresco cuente como
recepción del nivel de sincronización (R-05) lo decidió el dueño el 2026-10-10.

## Project Structure

### Documentation (this feature)

```text
specs/044-el-puerto-de-plataforma/
├── spec.md
├── plan.md                 # Este archivo
├── research.md             # Fase 0: doce hallazgos
├── data-model.md           # Fase 1: el refresco, la configuración, el estado de un flujo, el aviso
├── contracts/
│   └── puerto.md           # Fase 1: el cambio de contrato y lo que el servidor hace
├── quickstart.md           # Fase 1: cómo se verifica
└── tasks.md                # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
contracts/
├── openapi.yaml                       1.16.0; tags refresh y notices; las cuatro rutas
├── api-map.yaml                       consumidor notifier; tag refresh; cuatro operaciones
├── problem-types.yaml                 tres tipos
├── components/securitySchemes/noticeKey.yaml               NUEVO
├── components/schemas/                StockAndPrice*, PlatformNotice*, PlatformSync*, los valores nuevos
└── paths/                             stock-and-price, platform-notices, admin-notice-keys, admin-platform-sync
migrations/007-platform-port.sql       NUEVO
config/
├── treatment-defaults.json            platform, orderConfirmation, pull, notices
├── platform.json                      platformSync.tickMs
└── dev-platform.json                  NUEVO: lo que sirve la fuente de prueba en npm run dev
docs/adr/047-el-puerto-de-plataforma.md                      NUEVO
docs/dominio/                          aviso, fuente-de-plataforma, regla-de-confirmacion, refresco-de-stock-y-precio
src/
├── domain/catalog/                    StockAndPriceRefresh, la verdad por variante, StockCapturedInFuture
├── domain/configuration/              los valores nuevos y su juicio; OrderConfirmation
├── domain/merchant/                   la credencial notice
├── application/catalog/               RefreshStockAndPriceUseCase; el puerto del almacén por variante
├── application/configuration/         el juicio contra las fuentes instaladas (puerto PlatformSources)
├── application/platform/              NUEVO: ModeGatedUseCase, AcceptNoticeUseCase, GetPlatformSyncUseCase, puertos
├── interface-adapters/catalog/        el controller y el gateway del refresco
├── interface-adapters/access/         el security handler del aviso
├── interface-adapters/platform/       NUEVO: PlatformSource, la fuente de prueba, el planificador, los gateways
└── composition/modules/platform.ts    NUEVO; deployments/local.ts y durable.ts
tests/ (ver el quickstart)
```

**Structure Decision**: la del repositorio, por anillos y módulos (ADR-013). Un módulo nuevo, `platform`, porque el
modo, el aviso y el estado de cada flujo no son de ninguno de los existentes.

## Tramos

1. **El contrato y los nombres** (pasos 0 a 3 de `contrato.md`): las notas de dominio, ADR-047 propuesta, el mapa,
   los catálogos, las cuatro operaciones, los valores nuevos, `contract:check` y `contract:types`. Con los valores
   nuevos requeridos en los defaults, `config/` los gana en el mismo commit.
2. **El refresco** (US4 y la base de US1): la verdad por variante, el caso de uso, la tabla, el controller, el
   decorador del modo en las cuatro del `push`. Se puede correr: un `push` parcial cambia sólo sus variantes.
3. **El planificador y la fuente de prueba** (US1, US2): la fuente, `runDue`, el estado de cada flujo, el juicio de
   la configuración, la lectura del estado. Se puede correr: un merchant en `pull` tiene catálogo y órdenes.
4. **El aviso** (US3): la credencial, el consumidor, la cola, su procesamiento. Se puede correr: un aviso registra la
   orden leída.
5. **El circuito y el cierre** (US5): la prueba de punta a punta, la durabilidad, el quickstart a mano, ADR-047
   aceptada, el glosario, la cadena de gates, la spec construida.

## Complexity Tracking

| Lo que agrega                    | Por qué hace falta                                                                                | Lo más simple que se descartó, y por qué                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Un consumidor nuevo (`notifier`) | El mapa ata un consumidor a un esquema, y la clave del aviso no debe poder depositar nada (R-06). | La clave de plataforma sin firma: una clave que se configura en el panel de un tercero quedaría habilitada para empujar órdenes. |
| Un tag nuevo (`refresh`)         | El refresco es idempotente por ítem; `outcomes` exige una clave por pedido (R-12).                | Una clave de lote: guardar cada lote sólo para detectar un conflicto que el instante por ítem ya resuelve.                       |
