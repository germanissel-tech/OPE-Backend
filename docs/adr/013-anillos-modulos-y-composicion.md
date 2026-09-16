---
numero: 13
titulo: Anillos, módulos y composición tipada
estado: propuesta
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
   campo por puerto; cada **perfil** (`profiles/memory.ts` ahora; producción después) exporta
   una función que devuelve `Ports` completo, así que un puerto nuevo sin proveer no compila.
   `bootstrap(config, overrides?: Partial<Ports>)` arma casos de uso y servidor y devuelve
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
