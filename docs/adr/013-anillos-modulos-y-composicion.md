---
numero: 13
titulo: Anillos, módulos y composición tipada
estado: aceptada
fecha: 2026-09-16
fuente: specs/004-protocolo-sdk-ingesta/research.md
reemplaza: 6
---

# ADR-013 — Anillos, módulos y composición tipada

## Contexto

ADR-006 fijó cuatro capas planas (`domain`, `ports`, `adapters`, `handlers`) con un `main.ts`
que cableaba todo a mano. Con la primera feature de dominio aparecen varios módulos del sistema
(merchant, ingestion, ledger, y después experiment, catalog, decision, outcomes, measurement) y
varios puertos por módulo: las carpetas por concepto dejan de expresar de qué depende qué, y el
composition root crecería sin forma. Se descartaron contenedores de inyección: inversify y
tsyringe requieren decoradores y `reflect-metadata` (incompatibles con `erasableSyntaxOnly` y
con la pureza del dominio); awilix resuelve por nombre en runtime y el compilador no puede
verificar que un perfil provea todos los puertos.

## Decisión

1. **Anillos afuera** (Clean Architecture), dependencia sólo hacia adentro:
   `domain` ← `application` ← `interface-adapters` ← `infrastructure` ← `composition` ← `main.ts`.
   `domain` no importa nada de npm ni de Node (tipos incluidos). `application` define casos de
   uso **y los puertos que necesita**. `interface-adapters` traduce (controllers HTTP, cliente
   tipado, tipos generados del contrato) e implementa puertos (gateways). `infrastructure` es
   framework y drivers (Fastify, openapi-backend, CORS, logging). Nadie importa `composition`,
   `infrastructure` ni `main.ts`, salvo las pruebas.
2. **Módulos adentro** de `domain` y `application` (`shared-kernel`, `system`, `merchant`,
   `ingestion`, `ledger`, …), cada uno con un `index.ts` que es su única API pública. Un módulo
   importa de otro **sólo por su `index.ts`** y sólo si el **mapa de contextos** lo permite. El
   mapa es un objeto en `.dependency-cruiser.cjs` (`CONTEXT_MAP`) del que se generan las reglas
   `context-map:<módulo>`; agregar un módulo es agregar una entrada. En `interface-adapters` los
   controllers y gateways también se agrupan por módulo; un gateway no importa otro gateway.
3. **Composición tipada, DI manual**: `composition/ports.ts` declara `interface Ports` con un
   campo por puerto; cada **perfil** (`profiles/local.ts` ahora; producción después) exporta
   una función que devuelve `Ports` completo, así que un puerto nuevo sin proveer no compila.
   `bootstrap(config, overrides?: { ports?: Partial<Ports>; handlers?: Handlers })` arma casos de uso y servidor y devuelve
   `{ app, ports, close }`; `close` apaga en orden inverso. `main.ts` sólo lee configuración,
   llama a `bootstrap` y maneja señales. Reemplazar un adaptador es cambiar el perfil o pasar
   un override (las pruebas pasan `{ clock }`).

Todo verificado por dependency-cruiser con un fixture por regla (`tests/architecture/`).

## Consecuencias

- `src/` contiene `main.ts`, `composition/` y los cuatro anillos: ninguna carpeta suelta.
  `generated/` y `client/` pasan a `interface-adapters/http/`.
- El mapa de contextos es código revisable en cada PR; un import fuera del mapa falla el build.
- Sin decoradores ni metadatos en runtime: el dominio y la aplicación son TypeScript plano.
- Reemplaza a ADR-006; la tabla de capas de `CLAUDE.md` pasa a describir anillos y módulos.

## Enmienda (2026-09-16): cada módulo se cablea solo; arranque fail-closed

La primera versión de `bootstrap.ts` enumeraba los casos de uso (`buildUseCases`) y los
controllers (`wireControllers`) de todos los módulos en dos mapas centrales: con tres
operaciones cabía en una pantalla; con diez módulos era el archivo de 93 rutas de la POC
(constitución I). Se decide:

1. **Un módulo por archivo en `composition/modules/<módulo>.ts`**: declara el slice de puertos
   que necesita (`XPorts`), instancia sus casos de uso y devuelve lo que sirve
   (`{ handlers?, security?, cors? }`). `Ports` es la intersección de los slices; un puerto
   nuevo sin proveer en el perfil sigue sin compilar.
2. **El root conserva la lista de módulos** (`MODULES` en `composition/modules/index.ts`), nunca
   la de operaciones: una operación nueva toca sólo el archivo de su módulo; un módulo nuevo es
   una línea ahí y otra en `CONTEXT_MAP`. `wireModules` falla si dos módulos sirven el mismo
   `operationId`, el mismo esquema de seguridad o ambos declaran la política CORS.
3. **Fail-closed en el arranque** (constitución II): `bootstrap` comprueba que toda operación
   declarada en el contrato tiene handler y **no arranca** si falta alguna (sin modo ni mock,
   ADR-018). El
   servidor conserva el 501 para mapas de handlers arbitrarios (FR-044 de la 001), pero en
   producción un controller olvidado se ve al desplegar, no en un 501 bajo carga.
4. Regla `composition-wires-by-module` en dependency-cruiser: fuera de `composition/modules/`,
   `composition/` no importa controllers, security handlers ni casos de uso (con fixture).
5. **El enlace de cada puerto vive con su módulo; el perfil es un despliegue, no un entorno**
   (2026-09-17). `composition/modules/<módulo>.ts` declara lo que el módulo necesita
   (`LedgerPorts`), cómo lo sirve cada tecnología (`memoryLedgerPorts: Bindings<LedgerPorts>`,
   `postgresLedgerPorts(pool)` cuando llegue: conviven, no se reemplazan) y lo que el módulo
   sirve (`ledgerModule`). Un perfil (`profiles/local.ts`) compone **una tabla de enlaces por
   módulo** con `binder(overrides).bind(...)`: el override reemplaza el puerto antes de
   construirlo, lo construido se registra en orden para el cierre, y un despliegue mixto
   (Postgres para ledgers, Redis para dedup, configuración para merchants) es la forma normal.
   Cambiar la base de datos de un módulo = un archivo en `gateways/<módulo>/`, una tabla en su
   módulo y una línea en el perfil. Regla `profiles-compose-modules`: `composition/profiles/`
   no importa `interface-adapters/gateways/` (con fixture).

El punto 3 de la decisión sigue vigente en lo demás (perfil como parámetro, `close` en orden
inverso declarado por el perfil); la firma es `bootstrap(config, { profile?, modules?, ports?, handlers? })`.

6. **El logger es un puerto y el proceso falla cerrado** (2026-09-17). `Logger` vive en
   `application/shared-kernel/ports/`; `infrastructure/logging/pino-logger.ts` lo implementa
   sobre pino con los serializadores privados y Fastify comparte esa instancia; el root no
   conoce ningún tipo del framework. `composition/lifecycle.ts` adjunta al proceso el apagado
   ordenado (SIGINT/SIGTERM → `close()` → salida 0; fallo o timeout de gracia → salida 1) y el
   corte ante `uncaughtException`/`unhandledRejection` (log + salida 1, sin intentar recuperar
   un estado que no se puede confiar); el proceso es un parámetro, así que se prueba sin señales.
   `readConfig` valida (`PORT` decimal 0–65535, blanco = no definido, merchants con forma) y
   rechaza con `ConfigError` nombrando la variable.

## Enmienda (2026-09-21): el anillo de adaptadores por módulo; lo derivado fuera de `src/`

Feature 018 (`specs/018-adaptadores-por-modulo/`), tras la evaluación con el dueño del
2026-09-21. El anillo `interface-adapters/` crecía partido por tecnología
(`http/controllers/<m>/` y `gateways/<m>/`), con helpers de borde sueltos en la raíz de `http/`
que un módulo tomaba de otro sin que ninguna regla lo viera, y con la composición importando
cada archivo por su ruta.

1. **Lectura estricta de Clean Architecture, confirmada.** `interface-adapters/` contiene todo lo
   que **traduce**, en las dos direcciones: controllers y presenters (entrada), security handlers,
   y gateways que implementan puertos (salida). `infrastructure/` contiene sólo lo que **hospeda o
   provee tecnología** (Fastify, pino, CORS; mañana el driver de Postgres). Se evaluaron y
   descartaron: la variante Onion (gateways en `infrastructure/<m>/`: mejor prior del agente y
   persistencia en un solo lugar, pero un módulo en cuatro directorios y `infrastructure/`
   redefinido), la radical (`src/modules/<m>/` con los cuatro anillos adentro: rompe los anillos y
   el tooling) y la fusión de archivos (contraria a "un controller por operación, un gateway por
   puerto y tecnología"). El adaptador en memoria no es un placeholder: es el doble oficial de cada
   puerto para desarrollo y pruebas y se queda cuando llegue la persistencia.
2. **Forma vertical, con la dirección por nombre.** `interface-adapters/<módulo>/{controllers/,
presenters.ts, security/, gateways/, index.ts}`: un módulo tiene las partes que necesita
   (`barrier`, `selection`, `commercial`, `operator` no tienen adaptadores y no tienen
   directorio). `index.ts` exporta exactamente lo que la composición cablea; los presenters son
   internos al módulo. `interface-adapters/shared-kernel/` (paginación, ids aleatorios, reloj,
   mapa acotado) es importable por todo módulo del anillo.
3. **Núcleo `http/` sin módulos.** `typed.ts` (tipado de handlers; re-exporta los tipos del
   contrato para los módulos), `to-problem.ts`, `problem-details.ts`, `status.ts`, `boundary.ts`
   (instantes, idempotencia, paginación, `merchantIdOf`, `merchantPageResponse`) y `security/`
   (principales, capacidades, lectura de header). De los anillos interiores conoce sólo
   `shared-kernel`, `operator` y `merchant` (los principales que una request resuelve).
4. **Reglas nuevas en dependency-cruiser, cada una con fixture**: el mapa de contextos y
   `modules-only-via-index` rigen también en el anillo (el núcleo no es un módulo y todos pueden
   importarlo); `adapters-core-knows-no-module`; `composition-imports-module-index`
   (`composition/modules/<m>.ts` importa del anillo sólo `interface-adapters/<m>/index.js` y el
   `shared-kernel`); `gateways-drivers-from-infrastructure` (un gateway no importa npm; `node:`
   sí; el driver entra por `infrastructure/`); `generated-only-from-http-core`. Las existentes
   (`gateways-no-cross`, `controllers-no-gateways`, `profiles-compose-modules`,
   `problem-translation-only-in-http`, `composition-wires-by-module`) cambian de ruta. Lo que une
   puertos de varios módulos es un adaptador del root: `composition/adapters/`
   (`switchAwarePolicyDirectory`: decisión + configuración + merchant).
5. **Lo derivado y lo ajeno fuera de `src/`.** `generated/api.d.ts` y
   `generated/problem-types.{js,d.ts}` los escribe `npm run contract:types` desde el bundle y desde
   `contracts/problem-types.yaml` (una sola fuente: la réplica manual del catálogo y su prueba
   desaparecen; la declaración lleva los literales para que el status siga verificándose en
   compilación); se leen por el subpath import `#generated/*` de Node (`package.json` `imports`),
   versionados, verificados por drift (`contract:types:check`) y marcados `linguist-generated`.
   El cliente para consumidores vive en `client/` (export `./client` del paquete, su propio
   `tsconfig.client.json`). `Retry-After` deja de ser una constante del adaptador: es
   `retryAfterSeconds` del nivel de plataforma y lo agrega la infraestructura a toda `503`.
6. `composition/config.ts` partido por lo que lee: `merchants-config.ts`, `experiments-config.ts`,
   `levels-config.ts`, `env.ts`, `seed-errors.ts` (y `operators-config.ts`, que ya existía).
   Las pruebas unitarias del anillo espejan el árbol (`tests/unit/interface-adapters/<m>/`).
