# Implementation Plan: Protocolo del SDK e ingesta de eventos

**Branch**: `004-protocolo-sdk-ingesta` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-protocolo-sdk-ingesta/spec.md`

## Summary

Primera feature de dominio. Dos entregas en una: (1) reorganizar `src/` en anillos de Clean
Architecture con módulos adentro y un composition root tipado (DI manual con contenedor de
puertos y perfiles), moviendo `getHealth` sin cambiar comportamiento y verificando anillos,
módulos y mapa de contextos con dependency-cruiser; (2) el protocolo del SDK: `POST /v1/events`
(lote de eventos como lista blanca cerrada, credencial de ingesta pública por merchant,
deduplicación por `eventId` por merchant, decisión inline siempre `NO_OP` con motivo de
catálogo), `POST /v1/exposures` (confirmación de exposición → `EXPOSED` en el ledger en
memoria) y CORS por merchant. Todo lo no trivial se verificó empíricamente antes de decidir
([research.md](research.md)): reglas de módulo en dependency-cruiser, security handler de
openapi-backend, `@fastify/cors` con origen dinámico, y la unión discriminada de eventos —
donde apareció un conflicto real entre Ajv y openapi-typescript que se resuelve con `mapping`
explícito en el contrato y una función que lo quita en el adaptador (R-05).

## Technical Context

**Language/Version**: Node.js 22, TypeScript 5.9.3 (sin cambio)

**Primary Dependencies**: las existentes (Fastify 5, openapi-backend 5.20, ajv-formats,
openapi-fetch, yaml) + `@fastify/cors@^11` (runtime, nueva; ya instalada en el sondeo)

**Storage**: en memoria, detrás de puertos (`EventDedup`, `DecisionLedger`, `ExposureLedger`,
`MerchantDirectory`); la persistencia real es la feature 006

**Testing**: Vitest (unitarias por módulo, integración con `fastify.inject`, arquitectura con
fixtures por regla, gobernanza), Schemathesis contra las tres operaciones

**Target Platform**: servidor Linux (CI) y desarrollo en Windows/macOS; el SDK consume desde
navegador (CORS)

**Project Type**: web-service (backend HTTP contract-first)

**Performance Goals**: SC-003 — lote de 20 eventos con p95 < 50 ms en el perfil de memoria,
medido en pruebas (p50/p95 reportados); no es SLA

**Constraints**: `merchantId` nunca en el request (derivado de la credencial); ningún dato
fuera de la lista blanca se registra ni loguea; IP no persistida ni logueada; sin I/O de red en
el camino de decisión; dominio puro (sin npm ni Node); sin decoradores ni `reflect-metadata`
(`erasableSyntaxOnly`); sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite (R-05)

**Scale/Scope**: 2 operaciones nuevas, 12 tipos de evento, ~30 schemas nuevos, 5 tipos de
problema nuevos, 1 security scheme, 6 puertos, 5 módulos × 2 anillos, ~8 reglas de
dependency-cruiser con fixture, ~30 notas de glosario, 2 ADRs, CLAUDE.md actualizado

## Constitution Check

| Gate                                                        | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficie HTTP → contrato primero                          | **Sí**   | Diseño completo en [contracts/](contracts/) (validado con Redocly y Spectral del repo, bundleado y tipado); se copia a `contracts/` como primer paso de la implementación; `contract:check` en verde antes de cualquier handler                                                          |
| Persistencia / API → aislamiento por merchant               | **Sí**   | FR-050: pruebas de aislamiento en deduplicación (mismo `eventId`, dos merchants), decisiones (exposición de decisión ajena → `exposure-decision-unknown`, sin revelar), exposiciones y orígenes (credencial A + origen de B → 403); la clave del dedup y del ledger incluye `merchantId` |
| Plano de decisión / ledger / campos / LLM                   | **Sí**   | Decisión siempre `NO_OP` con motivo (II); toda decisión entra al ledger al emitirse y la exposición sólo con confirmación del SDK (cadena de evidencia, 01 §5); cero LLM; sin red en el camino crítico                                                                                   |
| Regla de negocio no expresable por esquema (`x-invariants`) | **Sí**   | `session-visitor-mismatch`, `event-timestamp-out-of-range` (sobre `EventBatch`), `exposure-decision-unknown`, `exposure-of-no-op` (sobre `confirmExposure`), `origin-not-allowed` (sobre ambas operaciones); tipos en `problem-types.yaml`; prueba `[invariant:<slug>]` por cada una     |
| Sustantivo nuevo en el contrato (glosario)                  | **Sí**   | R-09: lista exacta de huérfanos obtenida corriendo `check:glossary` contra el bundle del diseño; notas nuevas + una por tipo de evento + vocabulario técnico; el check pasa antes del primer handler                                                                                     |
| Toca `src/` → dirección de dependencias                     | **Sí**   | Nueva configuración de dependency-cruiser (anillos + módulos + mapa de contextos, R-01) con un fixture por regla (FR-004, SC-002); `npm run arch` en 0                                                                                                                                   |
| Privacidad (V, VII)                                         | **Sí**   | `ope-no-pii` sobre todos los schemas nuevos; serializer de logs sin IP ni headers (R-07) con prueba que captura el stream                                                                                                                                                                |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA (ver re-evaluación al final).

## Project Structure

### Documentation (this feature)

```text
specs/004-protocolo-sdk-ingesta/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/                      # diseño del contrato, validado; se copia a contracts/ en la implementación
│   ├── paths/events.yaml, exposures.yaml
│   ├── components/schemas/*.yaml   # Event (oneOf + discriminator con mapping), 12 tipos, PageContext, Money, Decision, …
│   ├── components/responses/*.yaml # Forbidden, EventBatchUnprocessable, ExposureUnprocessable
│   ├── components/securitySchemes/ingestKey.yaml
│   ├── examples/*.yaml
│   ├── no-op-reasons.yaml          # catálogo de motivos (nuevo archivo de contracts/)
│   ├── problem-types.additions.yaml
│   └── openapi.additions.md        # cambios en la raíz (tags, paths, components.securitySchemes, version)
└── tasks.md
```

### Source Code (repository root)

`src/` queda con `main.ts`, `composition/` y los cuatro anillos; nada más. Los módulos se repiten
en cada anillo que los necesite; cada módulo tiene un `index.ts` que es su API pública.

```text
src/
├── main.ts                                   # lee configuración, bootstrap(), listen, señales → close()
├── composition/                              # composition root (ADR-013); sólo main.ts y pruebas lo importan
│   ├── config.ts                             # AppConfig desde env: puerto, OPE_MOCK, merchants de prueba (OPE_MERCHANTS_FILE / JSON)
│   ├── ports.ts                              # interface Ports { clock, ids, merchants, eventDedup, decisions, exposures }
│   ├── profiles/memory.ts                    # memoryPorts(config): Ports  (perfil de esta feature, pruebas y mock)
│   ├── use-cases.ts                          # instancia casos de uso con puertos → UseCases
│   └── bootstrap.ts                          # bootstrap(config, overrides?: { ports?: Partial<Ports>; handlers?: Handlers }) → { app, ports, close }
├── domain/                                   # puro: ni npm ni Node; sólo importa domain/
│   ├── shared-kernel/  index.ts, ids.ts (tipos marcados MerchantId, SessionId, VisitorId, EventId, DecisionId), instant.ts
│   ├── system/         index.ts, health.ts (serviceHealth, movido)
│   ├── merchant/       index.ts, merchant.ts (Merchant, IngestKey, Origin, originAllowed)
│   ├── ingestion/      index.ts, event.ts (Event = unión por type, PageContext, Money, DeviceClass), batch.ts (checkBatch: session/visitor, tolerancia de instante), no-op-reasons.ts
│   └── ledger/         index.ts, decision.ts (Decision, noOp()), exposure.ts (Exposure, EXPOSED)
├── application/                              # casos de uso y puertos; importa domain/ y application/
│   ├── shared-kernel/  index.ts, ports/clock.ts, ports/id-generator.ts
│   ├── system/         index.ts, get-service-health.ts
│   ├── merchant/       index.ts, ports/merchant-directory.ts (resolveIngestKey → Merchant | undefined)
│   ├── ingestion/      index.ts, ports/event-dedup.ts, ingest-batch.ts (dedup → decidir NO_OP → registrar decisión)
│   └── ledger/         index.ts, ports/decision-ledger.ts, ports/exposure-ledger.ts, confirm-exposure.ts
├── interface-adapters/                       # traducción; importa application/, domain/, npm; no infraestructura
│   ├── http/
│   │   ├── generated/api.d.ts                # tipos del contrato (movido; sigue siendo generado, nunca editado)
│   │   ├── client.ts                         # cliente tipado openapi-fetch (movido)
│   │   ├── typed.ts, problem-details.ts      # movidos
│   │   ├── security/ingest-key.ts            # security handler: credencial → merchant; par credencial/Origin → 403
│   │   └── controllers/
│   │       ├── system/get-health.ts
│   │       ├── ingestion/ingest-events.ts    # DTO ↔ dominio; 202 IngestResult; invariantes → 422 con tipo
│   │       └── ledger/confirm-exposure.ts    # 201 / 200 / 422
│   └── gateways/                             # implementan puertos; un gateway no importa otro gateway
│       ├── shared-kernel/system-clock.ts, random-ids.ts
│       ├── merchant/config-merchant-directory.ts
│       ├── ingestion/memory-event-dedup.ts   # Map<merchantId, LRU/ventana de eventId>
│       └── ledger/memory-decision-ledger.ts, memory-exposure-ledger.ts
└── infrastructure/                           # frameworks y drivers; importa todo menos composition/main
    └── http/
        ├── build-server.ts                   # Fastify + openapi-backend (+ discriminator: true) + CORS + serializer de logs
        ├── strip-discriminator-mappings.ts   # R-05: quita discriminator.mapping antes de init()
        ├── cors.ts                           # @fastify/cors con origin(callback) sobre el directorio de merchants
        └── request-logging.ts                # serializer sin remoteAddress ni headers (R-07)

.dependency-cruiser.cjs                       # reescrito: anillos + modules-only-via-index + context-map:<módulo> (R-01)
contracts/                                    # + paths/events.yaml, exposures.yaml, schemas, responses, securitySchemes, examples, no-op-reasons.yaml
docs/adr/013-anillos-modulos-y-composicion.md, 014-protocolo-del-sdk.md
docs/dominio/*.md, docs/dominio/eventos/*.md, _tecnicos.json
tests/
├── unit/{domain,application}/<módulo>/*.test.ts
├── integration/ingest-events.test.ts, confirm-exposure.test.ts, cors.test.ts, isolation.test.ts, ingest-latency.test.ts, logging-privacy.test.ts, bootstrap.test.ts
├── architecture/fixtures/src/…               # un fixture por regla nueva
└── contract/… (Schemathesis cubre las tres operaciones vía test:contract)
```

**Structure Decision**: anillos afuera, módulos adentro (research R-01). `generated/` y `client/`
dejan de ser carpetas sueltas: son adaptadores de interfaz HTTP (los tipos del contrato los
consumen los controllers y el cliente; la infraestructura importa hacia adentro). Los scripts
`contract:types*` apuntan a la nueva ruta. `handlers/`, `ports/`, `adapters/` desaparecen.

### Comandos npm (cambios)

| Comando                    | Cambio                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `contract:types`, `:check` | salida en `src/interface-adapters/http/generated/api.d.ts`                                                    |
| `arch`                     | misma invocación; configuración nueva (anillos + módulos + mapa de contextos)                                 |
| `dev`, `contract:mock`     | leen `OPE_MERCHANTS` (JSON) o `OPE_MERCHANTS_FILE`; con `OPE_MOCK=1` cargan un merchant de prueba por defecto |

## Diseño de los puntos no triviales

- **Composición** (R-02): `Ports` es una interfaz; `memoryPorts(config)` la implementa entera
  (si falta un puerto, no compila: FR-003). `bootstrap` = `{ ...memoryPorts(config), ...overrides.ports }`
  → `buildUseCases(ports)` → `buildServer({ useCases, ports, config })` → `{ app, ports, close }`.
  `close` cierra Fastify y luego cada gateway que exponga `close()`, en orden inverso. Las
  pruebas de integración usan `bootstrap(testConfig, { clock: fixedClock })`.
- **Seguridad** (R-03): openapi-backend llama al security handler `ingestKey` antes del
  handler; devuelve `{ merchant }` o lanza → 401 `unauthorized` (Problem Details, antes que la
  validación 400). El handler además compara `Origin` (si viene) con `merchant.origins` → 403
  `origin-not-allowed`. Rotación: `MerchantDirectory` resuelve cualquiera de hasta dos claves.
- **CORS** (R-04): `@fastify/cors` con `origin: (origin, cb)` que consulta el directorio de
  merchants (¿algún merchant registró este origen?) para el preflight — el preflight no trae la
  credencial — y el security handler verifica el par en el request real. Métodos `POST`, header
  `X-OPE-Ingest-Key`, sin credenciales de navegador. La ruta catch-all del servidor excluye
  `OPTIONS` para no pisar el preflight.
- **Unión discriminada** (R-05): el contrato lleva `discriminator.mapping` explícito (así los
  tipos generados llevan el valor de cable); `stripDiscriminatorMappings` lo quita del
  documento en memoria antes de `init()` porque Ajv lo rechaza; `ajvOpts.discriminator: true`
  da un error preciso por violación. Prueba unitaria de la función y prueba de integración con
  campo extra, tipo desconocido y campo propio faltante.
- **Caso de uso `ingestBatch`**: recibe `{ merchantId, batch, now }`; el dominio ya validó
  esquema (openapi-backend) y `checkBatch` aplica las dos invariantes; `eventDedup.claim(merchantId,
eventIds)` devuelve cuáles entraron; `decisions.record(noOp(reason))`; devuelve
  `IngestResult`. Motivo: `page-context-incomplete` si ningún evento de la sesión resolvió
  producto en una ficha; si no, `decision-plane-unavailable`. Sin ramificación adicional: el
  plano de decisión llega después.
- **Caso de uso `confirmExposure`**: `decisions.find(merchantId, decisionId)` (ajena ≡ inexistente
  → `exposure-decision-unknown`); `outcome !== INTERVENE` → `exposure-of-no-op`; `exposures.record`
  devuelve `recorded | already-recorded`. En esta feature toda decisión es `NO_OP`, así que el
  camino 201 se prueba inyectando una decisión `INTERVENE` en el ledger en memoria desde la
  prueba (el puerto lo permite; no hay ruta HTTP que la produzca).
- **Errores de dominio → Problem Details**: los casos de uso devuelven un resultado
  discriminado (`{ ok: true, value } | { ok: false, invariant: slug }`), nunca lanzan por reglas
  de negocio; el controller mapea `invariant` → `422` con el `type` del catálogo. Las 5xx
  quedan para fallas reales.
- **Logs** (R-07): serializer de request propio (`method`, `url`, `reqId`, `merchantId` si se
  resolvió); prueba que captura el stream y afirma ausencia de `remoteAddress`, IP y clave.
- **Orden de commits**: (1) contrato + catálogos + glosario + ADRs (contract:check verde con
  501 en las operaciones nuevas); (2) reorganización en anillos/módulos + composición +
  dependency-cruiser + fixtures (suite anterior intacta, SC-001); (3) merchant + seguridad +
  CORS; (4) ingesta + decisión; (5) exposición; (6) aislamiento, latencia, privacidad de logs,
  CLAUDE.md, quickstart.

## Complexity Tracking

| Elemento                                       | Por qué                                                                                                    | Alternativa rechazada                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Módulos dentro de los anillos desde ya         | con 5 módulos y 2 anillos el mapa de contextos ya vale; agregarlo después obliga a mover todo dos veces    | carpetas sueltas por concepto (`ports/`, `handlers/`): no escalan a 10 módulos y no expresan dependencias entre contextos     |
| `discriminator.mapping` + función que lo quita | único modo de tener contrato explícito, tipos correctos y errores precisos a la vez (R-05)                 | `oneOf` sin discriminador: errores ruidosos; transformar el bundle antes de generar tipos: contrato semánticamente incompleto |
| `components.securitySchemes` en la raíz        | `security` referencia por nombre, no por `$ref`; Redocly lo exige (R-06)                                   | ninguna: es la única excepción a "sin components en la raíz" y queda documentada                                              |
| Una nota de glosario por tipo de evento        | son las señales de 03 §4.1, el lenguaje ubicuo de la feature; el check las exige palabra por palabra si no | volcar los 12 nombres a `_tecnicos.json`: los convertiría en "vocabulario técnico", que no son                                |

## Re-evaluación del Constitution Check (post-Phase 1)

El contrato diseñado pasa Redocly y Spectral con el ruleset completo (incluidas
`ope-invariants`, `ope-no-generic-422`, `ope-required-capabilities`, `ope-no-pii`,
`ope-no-merchant-id-in-request`, `ope-request-closed-schema`), bundlea y genera tipos con los
valores de cable correctos. Los cinco tipos de problema nuevos están en el catálogo del diseño.
El glosario tiene lista cerrada de faltantes. La estructura de `src/` respeta la constitución I
(dominio puro, dependencia hacia adentro) y queda verificada por herramienta. **PASA.**
