---
paths:
  - "src/**"
---

# Anillos y módulos (ADR-013, verificado por `npm run arch`)

`src/` contiene `main.ts`, `composition/` y cuatro anillos; nada más. Dependencia sólo hacia
adentro:

| Anillo                    | Qué va ahí                                                                                                                                                                                                                                                                                                   | Puede importar de                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`             | reglas y valores puros, por módulo                                                                                                                                                                                                                                                                           | sólo `domain/`. **Nada de npm ni de Node, ni tipos**                                                                                                                                                                                   |
| `src/application/`        | casos de uso y **los puertos que definen** (`<módulo>/ports/`), por módulo                                                                                                                                                                                                                                   | `domain/`, `application/`. Tampoco npm ni Node                                                                                                                                                                                         |
| `src/interface-adapters/` | todo lo que **traduce**, por módulo: `<módulo>/{controllers/, presenters.ts, security/, gateways/, index.ts}` (entrada y salida por nombre); núcleo `http/` sin módulos (tipado, Problem Details, borde genérico, principales); `shared-kernel/`                                                             | `application/`, `domain/`, `node:`. El mapa de contextos rige también aquí; un gateway no importa otro gateway ni npm (los drivers entran por `infrastructure/`); un controller no importa gateways; el núcleo no conoce ningún módulo |
| `src/infrastructure/`     | sólo lo que **hospeda o provee tecnología**: Fastify + openapi-backend, CORS, logging (mañana el driver de Postgres)                                                                                                                                                                                         | todo menos `composition/` y `main.ts`                                                                                                                                                                                                  |
| `src/composition/`        | `graph/` (la biblioteca del grafo, sin conocer ningún módulo), `modules/<módulo>.ts` (se cablea solo; del anillo importa sólo `interface-adapters/<módulo>/index.js`), `deployments/` (la lista de módulos con su tecnología), `release.ts` (lo que viene de afuera del grafo), `bootstrap()`, `*-config.ts` | todo; sólo `main.ts` y las pruebas lo importan. Controllers y casos de uso sólo desde `modules/`                                                                                                                                       |
| `src/main.ts`             | lee configuración, `bootstrap`, señales                                                                                                                                                                                                                                                                      | `composition/` y Node; nadie lo importa                                                                                                                                                                                                |

**Dónde va lo que comparten los controllers**: lo que sirve al borde **sin conocer un módulo**
(`instantOf`, `idempotent`, la paginación) vive en `http/boundary.ts`; lo que **conoce el módulo**
(el DTO de sus entidades) en `<módulo>/presenters.ts`; nunca en `controllers/`, donde un archivo es
una operación.

Fuera de `src/`: `generated/` (lo que `contract:types` deriva del contrato; nunca editado;
importable sólo desde `interface-adapters/http/` e `infrastructure/http/` como `#generated/*`) y
`client/` (el cliente tipado para consumidores; nada de `src/` lo importa). Qué contiene cada
directorio de primer nivel lo dice su `README.md` (ADR-032; verificado por `tests/docs`):
`config/`, `contracts/`, `generated/`, `patches/`, `scripts/`, `docs/`, `tests/`, `client/`,
`specs/`.

**Módulos** dentro de `domain/`, `application/` e `interface-adapters/`: `shared-kernel`, `system`, `operator`
(quién opera: `Operator`, `OperatorId`, alcance; sólo dominio), `merchant`,
`ledger`, `experiment`, `ingestion`, `catalog`, `barrier`, `selection`, `commercial`, `decision`,
`outcomes`, `configuration` (los tres niveles y su resolución; nadie lo importa: cada consumidor
define su puerto de lectura y la composición enlaza), `admin` (registro de administración,
diagnóstico de anclajes, configuración del SDK), `access` (ADR-034: los tres esquemas de
autenticación, sus resolvedores y las políticas de seguridad del nivel 1; lee el directorio de
merchants y nunca escribe) — los demás cuando llegue su feature. Dentro de un módulo
de aplicación: `use-cases/`, `services/`, `ports/`; en el dominio, `errors.ts` (ADR-023). Cada módulo expone su API pública
en `index.ts`; un módulo importa de otro **sólo por su `index.ts`** y sólo si el mapa de
contextos (`CONTEXT_MAP` en `.dependency-cruiser.cjs`) lo permite. Agregar un módulo =
agregar una entrada al mapa. Cada regla tiene un fixture en `tests/architecture/fixtures/`.

**Composición** (DI manual, sin contenedor; grafo tipado, ADR-033): el cableado es un grafo donde
cada componente lo declara **una vez** su módulo dueño como una constante exportada —`port("
ledger.decisions")<DecisionLedger>()`— y quien lo necesita la importa: **no hay resolución por
texto**, y por eso el mapa de contextos también rige entre módulos de composición. Cada
`src/composition/modules/<módulo>.ts` exporta tres cosas y nada más (regla de forma
`composition-module-shape`): `provides` (sus componentes, la lista de enlaces; y **sólo** si hay
más de una manera de servirlos, una tabla por tecnología —no hay nombre que inventar hasta que
haya algo que elegir—), `assembles` (lo que arma con ellos, igual en todo despliegue) y `serves`
(handlers por `operationId`, esquemas de seguridad, CORS). Todo opcional.

Un enlace declara lo que necesita **por nombre**: `bind(Puerto, { clock: ClockPort }, ({ clock })
=> …)`; `bindAll([Store, Directory], …)` es "una instancia, varias vistas" —se construye una vez y
los dos puertos responden con el mismo objeto—. El despliegue (`deployments/local.ts`) es una
lista sin orden significativo, y un módulo nombra su tecnología **sólo si declara más de una**
(`ledgerModule.with("postgres")`): con una sola no hay nada que decidir.
**No compilan**: un requisito sin proveedor (`Missing<…>`), dos tecnologías de un módulo que no
proveen lo mismo (`TechnologiesDisagree<…>`), un módulo con varias tecnologías que entra al
despliegue sin elegir (`ChooseATechnology<…>`), una instancia que no satisface todas sus vistas, y
un despliegue que no cubre las operaciones del contrato (`Unwired<…>`). La resolución es perezosa y memorizada —una instancia por
arranque, sin nada global ni estático— y un ciclo falla al arrancar nombrándolo.
`instantiate(plan, [replace(Puerto, doble)])` es lo que una prueba reemplaza.
`bootstrap(config, { deployment?, ports?, handlers? })` devuelve `{ app, resolve, close }`; el
logger es un componente (`Logger` en `shared-kernel`, pino en `infrastructure/logging/`) y las
pruebas lo reemplazan con `replace(LoggerPort, …)`. `start()` adjunta el ciclo de vida (`lifecycle.ts`):
SIGINT/SIGTERM cierran en orden y salen 0; un cierre que falla o excede la gracia, una excepción
no capturada o una promesa rechazada sin manejar se loguean y salen 1. `readConfig` rechaza con
`ConfigError` (variable + problema) lo que no puede arrancar el servidor; `bootstrap` se niega
a arrancar si el contrato declara una operación que ningún módulo sirve. Las pruebas usan
`startTestApp()` de `tests/helpers/test-app.ts` (dos merchants fijos, reloj reemplazable).
Los merchants viven detrás del puerto `MerchantStore` (ADR-031; en memoria hasta la feature de
persistencia): `OPE_MERCHANTS` (JSON) o `OPE_MERCHANTS_FILE` es una **semilla** que
`bootstrap` importa por `ImportMerchantsUseCase` como el operador `system` sólo si el store
arranca vacío (con merchants ya registrados, no pisa nada); sin semilla ni store poblado, nadie
autentica. Nada de lo que un operador hace a un merchant (crear, rotar, apagar, dar de baja)
requiere reiniciar: se lee del store en la siguiente request. Los dos niveles del release
(constitución XI, ADR-031) son archivos del repositorio, `config/platform.json` y
`config/treatment-defaults.json` (`OPE_PLATFORM_CONFIG` / `OPE_TREATMENT_DEFAULTS` nombran
otros), que `readConfig` lee por los lectores de forma del módulo `configuration`
(`readPlatformConfiguration`, `readTreatmentDefaults`) y las fábricas del dominio
(`PlatformConfiguration.of`, `TreatmentDefaults.of`) juzgan: un valor fuera de rango es un
`ConfigError` que nombra `platform.<campo>` o `treatmentDefaults.<campo>`. La semilla admite,
junto a los campos del merchant, todo lo que `MerchantConfigurationDeclared` admite
(`decisionPolicy`, `commercialPolicy`, `evidenceProfile`, `holdoutShare`, `freshness`, …):
`bootstrap` lo publica como la versión 1 del merchant (`ImportMerchantConfigurationUseCase`,
operador `system`) sólo si el merchant no tiene versiones. No hay servidor mock ni modo
(ADR-018): el composition root no decide sobre configuración (`shape` regla 5).
