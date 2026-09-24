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

**Módulos** dentro de `domain/`, `application/` e `interface-adapters/`: **cuáles existen hoy lo
dice `CONTEXT_MAP` en `.dependency-cruiser.cjs`**, que es su fuente y la que `arch` verifica; la
lista crece con cada feature y copiarla acá sólo la condenaría a quedar vieja. Dentro de un módulo
de aplicación: `use-cases/`, `services/`, `ports/`; en el dominio, `errors.ts` (ADR-023). Cada
módulo expone su API pública en `index.ts`; un módulo importa de otro **sólo por su `index.ts`** y
sólo si el mapa de contextos lo permite. Agregar un módulo = agregar una entrada al mapa. Cada
regla tiene un fixture en `tests/architecture/fixtures/`.

**Composición** (DI manual, sin contenedor; grafo tipado, ADR-033): cada componente lo declara
**una vez** su módulo dueño como una constante exportada —`port("ledger.decisions")<DecisionLedger>()`—
y quien lo necesita la importa. **No hay resolución por texto**, y por eso el mapa de contextos
también rige entre módulos de composición. Cada `src/composition/modules/<módulo>.ts` exporta tres
cosas y nada más (regla de forma `composition-module-shape`): `provides` (sus componentes),
`assembles` (lo que arma con ellos, igual en todo despliegue) y `serves` (handlers por
`operationId`, esquemas de seguridad, CORS). Todo opcional. Cómo se escribe un enlace, qué no
compila y qué reemplaza una prueba está en ADR-033; qué hace el arranque, en ADR-013.
