# Modelo — Adaptadores por módulo (018)

No hay entidades de dominio nuevas ni cambios de datos: el "modelo" de esta feature es la forma
del árbol y las reglas que la sostienen.

## Forma del anillo

```text
src/interface-adapters/
├── http/                          núcleo: no nombra ningún módulo de feature
│   ├── typed.ts                   OperationHandler<"opId">, TypedRequest, SecurityScheme
│   ├── to-problem.ts              DomainError → Problem Details
│   ├── problem-details.ts         tipos del contrato + problem(); re-exporta #generated/problem-types
│   ├── status.ts                  HTTP_STATUS
│   ├── boundary.ts                instantOf, idempotent, pageQueryOf, pageDto, merchantIdOf, merchantPageResponse
│   └── security/                  principal.ts (merchantOf, operatorOf), capabilities.ts, headers.ts
├── shared-kernel/                 paging.ts, random-id.ts, system-clock.ts, windowed-map.ts, index.ts
├── system/                        controllers/get-health.ts, index.ts
├── merchant/
│   ├── controllers/               create-merchant, get-merchant, list-merchants, deactivate-merchant,
│   │                              rotate-ingest-key, rotate-platform-key, rotate-platform-secret, set-kill-switch
│   ├── presenters.ts              merchantDto, rotationResponse
│   ├── security/                  ingest-key.ts, platform-key.ts
│   ├── gateways/                  memory-merchant-store, node-credential-minter, node-message-authenticator
│   └── index.ts
├── ledger/                        controllers/confirm-exposure; gateways/memory-{decision,exposure,…}-ledger; index.ts
├── experiment/                    controllers/{create,list,activate,close}-experiment; presenters.ts;
│                                  gateways/{memory-experiment-store, memory-assignment-ledger, node-experiment-id-minter}; index.ts
├── ingestion/                     controllers/ingest-events; gateways/memory-event-dedup; index.ts
├── catalog/                       controllers/upsert-catalog-snapshot; gateways/memory-catalog-store; index.ts
├── barrier/                       gateways/…; index.ts                (sólo salida)
├── decision/                      gateways/{memory-session-state-store, memory-visitor-state-store,
│                                  switch-aware-policy-directory}; index.ts   (sólo salida)
├── outcomes/                      controllers/{notify-order, notify-return, corroborate-order}; presenters.ts (linesOf);
│                                  gateways/{memory-order-ledger, memory-corroboration-ledger}; index.ts
├── configuration/                 controllers/…; presenters.ts; gateways/{memory-configuration-store,
│                                  release-configuration-levels}; index.ts
└── admin/                         controllers/{list-admin-log, list-merchant-admin-log, get-sdk-config,
                                   report-anchor-diagnostics, list-anchor-diagnostics}; presenters.ts;
                                   security/admin-token.ts; gateways/{memory-admin-log, memory-anchor-diagnostics-store,
                                   config-operator-directory, node-token-fingerprinter}; index.ts
```

Un módulo tiene las partes que necesita; la ausencia de una parte no cambia la forma. `index.ts`
exporta exactamente lo que `composition/modules/<m>.ts` cablea: fábricas de controllers
(`makeX`), security handlers y sus constantes de esquema/header, fábricas de gateways.

## Fuera de `src/`

```text
generated/
├── api.d.ts                       tipos del contrato (openapi-typescript)
├── problem-types.js               catálogo de problemas en runtime (desde contracts/problem-types.yaml)
└── problem-types.d.ts             su declaración con literales; ProblemSlug
client/
└── index.ts                       cliente tipado para consumidores (export ./client del paquete)
```

Importados como `#generated/api.js`, `#generated/problem-types.js` (`package.json` `imports`).

## Composición

```text
src/composition/
├── config.ts                      readConfig, AppConfig, MerchantConfig, ReleaseLevels, variables de entorno
├── merchants-config.ts            semilla de merchants
├── experiments-config.ts          experimentos de la semilla
├── levels-config.ts               niveles del release
├── operators-config.ts            (existe)
├── config-error.ts                (existe)
├── modules/<m>.ts                 importa interface-adapters/<m>/index.js (+ shared-kernel) y nada más del anillo
└── adapters/                      (vacío al cierre; reservado a dependencias entre módulos del anillo que el mapa no permita)
```

## Reglas de arquitectura (dependency-cruiser)

| Regla                                  | Qué prohíbe                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules-only-via-index` (ampliada)    | un módulo de `domain`, `application` o `interface-adapters` importa el interior de otro módulo                                                  |
| `context-map:<m>` (ampliada al anillo) | un módulo del anillo importa un módulo que el mapa no permite                                                                                   |
| `adapters-core-knows-no-module`        | `interface-adapters/http/` importa un módulo del anillo, o un módulo de dominio/aplicación fuera de `shared-kernel`, `operator`, `merchant`     |
| `composition-imports-module-index`     | `composition/modules/<m>.ts` importa del anillo algo que no es `interface-adapters/<m>/index.js` ni `interface-adapters/shared-kernel/index.js` |
| `gateways-drivers-from-infrastructure` | un gateway importa un paquete npm (drivers) en vez de tomarlo de `infrastructure/`                                                              |
| `generated-only-from-http-core`        | algo fuera de `interface-adapters/http/` e `infrastructure/http/` importa `#generated/*`                                                        |

Las existentes (`gateways-no-cross`, `controllers-no-gateways`, `profiles-compose-modules`,
`problem-translation-only-in-http`, `composition-wires-by-module`) cambian de ruta y conservan
su fixture.

## Nivel de plataforma

`config/platform.json` gana `retryAfterSeconds` (entero ≥ 1; hoy 5). Lo aplica la infraestructura
HTTP a toda respuesta `503` sin `Retry-After`.
