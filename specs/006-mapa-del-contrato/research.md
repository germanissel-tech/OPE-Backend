# Research — Feature 006: mapa del contrato y convenciones transversales

**Fecha**: 2026-09-17 · **Estado**: completo. Decisiones transversales → ADR-019 (mapa del
contrato y ciclo de vida de una operación) y ADR-020 (consumidores, autenticación,
idempotencia y paginación) durante la implementación.

## R-01 Dónde viven las operaciones planeadas (verificado)

- **Decisión (DECIDIDO → ADR-019)**: en `contracts/api-map.yaml`, **no** en `openapi.yaml`.
  El contrato describe lo que existe (el servidor lo sirve entero, los tipos se generan de él,
  Schemathesis lo ejercita); el mapa describe lo que existe y lo que va a existir.
- **Alternativa rechazada**: declarar las planeadas en `openapi.yaml` con una extensión
  `x-status: planned`. Redocly y openapi-backend las tratarían como reales (el servidor
  respondería `501`, los tipos generados las incluirían, Schemathesis las probaría y el
  `contract:diff` las contaría como superficie), y quitar una planeada sería un "cambio
  incompatible" para oasdiff. Demasiadas herramientas engañadas para un estado.
- **Documentación publicada**: `contract:docs` genera desde el mapa una sección Markdown
  "Superficie planeada" (tabla: operación, consumidor, feature, estado, fuente) y la agrega al
  `info.description` de **la copia** del bundle que usa para construir el HTML; el contrato
  commiteado no cambia. Verificado: Spectral acepta la tabla en `info.description`; Redoc
  renderiza GitHub-flavored Markdown (tablas incluidas) en la descripción.

## R-02 Esquemas de seguridad propuestos y `no-unused-components` (verificado)

- Redocly (`no-unused-components: error`) rechaza un esquema de seguridad declarado en
  `components.securitySchemes` sin operación que lo use: `Security scheme: "platformKey" is
never used`.
- **Decisión (DECIDIDO)**: los cuatro esquemas existen como archivos en
  `contracts/components/securitySchemes/` (`ingestKey.yaml` existente, `platformKey.yaml`,
  `portalSession.yaml`, `adminToken.yaml`); la raíz `openapi.yaml` referencia **sólo los que
  alguna operación construida usa**. El mapa (`consumers.<x>.securityScheme`) apunta al archivo
  y `check:api-map` verifica que exista y tenga forma válida (`type`, `in`/`scheme`,
  `description`), aunque no esté en la raíz. Cuando se construye la primera operación de un
  consumidor, su esquema entra a la raíz — es parte del paso "pasar de planeada a construida".
- Lo mismo vale para los esquemas reutilizables de paginación (`Page`, parámetros `cursor`,
  `limit`, `from`, `to`): archivos en `components/` sin referencia desde la raíz hasta la
  primera lectura de colección; el bundle no los incluye y por eso no hay "unused". El check
  del mapa los parsea para que no se pudran.
- **Alternativa rechazada**: `redocly.yaml` con `ignore` o bajar la regla a `warn`. Abre la
  puerta a componentes muertos de verdad.

## R-03 Forma del mapa y del chequeo

- `contracts/api-map.yaml`:

  ```yaml
  consumers:
    public: { securityScheme: null, tags: [system] }
    sdk:
      {
        securityScheme: ingestKey,
        tags: [ingest, decision],
        capabilities: [events:write, config:read, diagnostics:write, orders:corroborate],
      }
    platform:
      {
        securityScheme: platformKey,
        tags: [outcomes],
        capabilities: [orders:write, returns:write, catalog:write],
      }
    portal: { securityScheme: portalSession, tags: [portal], capabilities: [results:read, ledger:read] }
    admin:
      {
        securityScheme: adminToken,
        tags: [admin],
        capabilities: [merchants:write, credentials:rotate, experiments:write, flags:write, messages:publish],
      }
  operations:
    - operationId: ingestEvents
      method: post
      path: /v1/events
      consumer: sdk
      tag: ingest
      capabilities: [events:write]
      feature: "004"
      status: built
      source: mvp:01-arquitectura-mvp.md#3.1
  ```

  Los consumidores llevan el catálogo de capacidades (un solo archivo gobernado: FR-013);
  `tag ⇒ consumidor ⇒ esquema` sale de `consumers.<x>.tags`.

- `scripts/check-api-map.mjs` (patrón de `check-glossary`): carga el mapa y el bundle;
  problemas: `operationId` del bundle ausente del mapa; entrada `built` ausente del bundle;
  entrada `planned`/`deprecated`/`retired` presente en el bundle con estado incoherente
  (`deprecated` ⇔ `deprecated: true` en la operación; `retired` ⇒ ausente y con `retiredIn`);
  diferencia de método, ruta, tag, esquema o capacidades en una `built`; tag fuera del
  consumidor; capacidad fuera del vocabulario del consumidor; esquema sin archivo; feature sin
  directorio `specs/<NNN>-*` **o** sin entrada en el roadmap del mapa (`features:` lista
  numerada con título, para las que todavía no tienen spec); `source` con la misma verificación
  que el glosario (`constitucion#X`, `mvp:archivo#X` con aviso si los documentos no están);
  `operationId` repetido; método+ruta repetidos; estado fuera del conjunto. Salida: conteo por
  estado. Entra a `contract:check`.
- Reutiliza `governance-lib.mjs` (`readYaml`, `report`, `prop`, `isRecord`) y la verificación
  de fuentes de `check-glossary.mjs`, que se extrae a `governance-lib.mjs` para no duplicarla
  (el gate de duplicación de la 005 lo exigiría igual).

## R-04 Reglas nuevas del ruleset (diseño; fixture por regla)

1. `ope-consumer-security` (función `consumerSecurity`, `functionOptions.map: ./api-map.yaml`):
   para cada operación, el tag determina el consumidor; si el consumidor es `public`, exige
   `security: []` y ninguna capacidad (hoy lo hace `requiredCapabilities` por `security: []`;
   se mantiene); si no, exige `security: [{ <securityScheme>: [] }]` exactamente (un solo
   requisito, el del consumidor). Fixtures: `ingest` con `platformKey`; `system` con
   seguridad.
2. `ope-required-capabilities` (existente) gana `functionOptions.map` y verifica que cada
   capacidad esté en el vocabulario del consumidor del tag. Fixture: `orders:write` bajo
   `portal`.
3. `ope-outcomes-idempotency` (función `outcomesIdempotency`): toda operación con tag
   `outcomes` declara `x-idempotency: { key: <campo del body>, first: "<2xx>", repeat: "<2xx>" }`,
   el campo existe en el schema del request body, ambos códigos están en `responses` y son
   distintos. Fixture: `outcomes` sin la extensión; con `key` inexistente.
4. `ope-collection-pagination` (función `collectionPagination`): toda operación `GET` con tag
   `portal` cuya ruta no termina en `/{...}` es una lectura de colección y MUST declarar
   `x-collection: true`, los cuatro parámetros comunes por `$ref` (`cursor`, `limit`, `from`,
   `to`) y una respuesta `200` cuyo schema sea `$ref` a un `*Page`. Fixture: `portal` GET con
   `page`/`offset` propios.
5. `ope-planned-not-served`: no hace falta — las planeadas no están en `openapi.yaml` (R-01).

Todas en estilo bloque, CommonJS con JSDoc (`SpectralFunction`), fixture generado por
`tests/contract-rules/gen-fixtures.mjs`. Como hoy no hay operaciones `outcomes` ni `portal`
construidas, los fixtures son la única forma de ejercitar 3 y 4; `valid-*.yaml` incluye una
operación válida de cada una para que la regla no rompa el día que se construyan.

## R-05 Convenciones (→ ADR-020)

- **Consumidores y esquemas**:

  | Consumidor | Esquema                                              | Credencial                                                                                          | Identifica         | Ausente / inválida               |
  | ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------- |
  | sdk        | `ingestKey` (existente)                              | pública, header `X-OPE-Ingest-Key`, ≤ 2 activas                                                     | merchant           | 401 / 403 `origin-not-allowed`   |
  | platform   | `platformKey` (`apiKey` header `X-OPE-Platform-Key`) | **secreta**, servidor a servidor sobre TLS, ≤ 2 activas para rotar, nunca en navegador ni en el tag | merchant           | 401; sin CORS (no hay navegador) |
  | portal     | `portalSession` (`http` `bearer`, PROPUESTO)         | token de sesión de una persona del merchant                                                         | persona + merchant | 401                              |
  | admin      | `adminToken` (`http` `bearer`, PROPUESTO)            | token de operador de OPE                                                                            | operador           | 401                              |

  Firma HMAC del cuerpo con ventana temporal para `platformKey`: PROPUESTO; se decide en la
  feature de outcomes con el adaptador real de plataforma (02 §6). El secreto en header sobre
  TLS es el mínimo del adaptador genérico (02 §6.2).

- **Idempotencia servidor a servidor**: la clave es la identidad autoritativa de la
  plataforma (`orderId` para órdenes y devoluciones; `snapshotId`/versión para catálogo).
  Primera recepción → `201` con el registro; repetida con el **mismo contenido** → `200` con
  el mismo registro; misma clave con **contenido distinto** → `409` con tipo propio
  (`idempotency-conflict`, nuevo en `problem-types.yaml`), nunca sobrescritura. Igualdad de
  contenido: comparación canónica del cuerpo (claves ordenadas) — detalle de la 009.
- **Paginación**: cursor opaco (`cursor` string, `limit` entero 1..100, por defecto 50), orden
  por instante descendente, ventana `from`/`to` RFC 3339 inclusiva/exclusiva; envoltorio
  `{ items: [...], nextCursor?: string }`; sin `total` (costoso e inestable). Un `*Page` por
  colección (`DecisionPage`, …), todos con la misma forma verificada por la regla 4.
- **Ciclo de vida**: `planned` (sólo en el mapa) → `built` (en el contrato) → `deprecated`
  (`deprecated: true` en la operación, sigue sirviéndose, `Sunset` documentado en la
  descripción) → `retired` (fuera del contrato; sube la versión mayor, ADR-003; el mapa guarda
  `retiredIn`). Renombrar una `planned` es editar el mapa; renombrar una `built` es retirar y
  crear.

## R-06 Superficie planeada (contenido inicial del mapa)

Roadmap renumerado tras esta feature: 007 asignación, 008 persistencia y resiliencia, 009
outcomes (órdenes, devoluciones, confirmación desde navegador), 010 configuración, banderas,
kill switch y administración, 011 catálogo y stock, 012–016 plano de decisión, 017 análisis
ITT y portal, 018 observabilidad y e2e.

| operationId             | Método y ruta                                                          | Consumidor / tag    | Capacidad          | Feature     | Fuente                 |
| ----------------------- | ---------------------------------------------------------------------- | ------------------- | ------------------ | ----------- | ---------------------- |
| getHealth               | GET /v1/health                                                         | public / system     | —                  | 001 (built) | constitucion#VIII      |
| ingestEvents            | POST /v1/events                                                        | sdk / ingest        | events:write       | 004 (built) | mvp:01#3.1             |
| confirmExposure         | POST /v1/exposures                                                     | sdk / ingest        | events:write       | 004 (built) | mvp:01#5               |
| getSdkConfig            | GET /v1/sdk/config                                                     | sdk / ingest        | config:read        | 010         | mvp:02#3, mvp:01#3.1.1 |
| reportAnchorDiagnostics | POST /v1/sdk/diagnostics                                               | sdk / ingest        | diagnostics:write  | 010         | mvp:01#3.1.1           |
| corroborateOrder        | POST /v1/orders/corroborations                                         | sdk / ingest        | orders:corroborate | 009         | mvp:02#5.1             |
| notifyOrder             | POST /v1/orders                                                        | platform / outcomes | orders:write       | 009         | mvp:02#5.2             |
| notifyReturn            | POST /v1/returns                                                       | platform / outcomes | returns:write      | 009         | mvp:02#5.4             |
| upsertCatalogSnapshot   | PUT /v1/catalog                                                        | platform / outcomes | catalog:write      | 011         | mvp:02#4               |
| getExperimentResults    | GET /v1/portal/results                                                 | portal / portal     | results:read       | 017         | mvp:01#5.3             |
| getAccumulationStatus   | GET /v1/portal/accumulation                                            | portal / portal     | results:read       | 017         | mvp:01#5.7             |
| listDecisions           | GET /v1/portal/decisions                                               | portal / portal     | ledger:read        | 017         | mvp:01#5.7             |
| listExposures           | GET /v1/portal/exposures                                               | portal / portal     | ledger:read        | 017         | mvp:01#5.7             |
| listOrders              | GET /v1/portal/orders                                                  | portal / portal     | ledger:read        | 017         | mvp:01#5.2             |
| listMerchants           | GET /v1/admin/merchants                                                | admin / admin       | merchants:write    | 010         | mvp:01#14.1            |
| createMerchant          | POST /v1/admin/merchants                                               | admin / admin       | merchants:write    | 010         | mvp:01#14.1            |
| rotateIngestKey         | POST /v1/admin/merchants/{merchantId}/ingest-keys                      | admin / admin       | credentials:rotate | 010         | ADR-014                |
| rotatePlatformKey       | POST /v1/admin/merchants/{merchantId}/platform-keys                    | admin / admin       | credentials:rotate | 010         | ADR-020                |
| createExperiment        | POST /v1/admin/merchants/{merchantId}/experiments                      | admin / admin       | experiments:write  | 010         | mvp:01#4.1             |
| closeExperiment         | POST /v1/admin/merchants/{merchantId}/experiments/{experimentId}/close | admin / admin       | experiments:write  | 010         | mvp:01#14.2            |
| putFlags                | PUT /v1/admin/merchants/{merchantId}/flags                             | admin / admin       | flags:write        | 010         | mvp:01#14.2            |
| setKillSwitch           | PUT /v1/admin/merchants/{merchantId}/kill-switch                       | admin / admin       | flags:write        | 010         | mvp:01#14.2            |
| publishMessageCatalog   | POST /v1/admin/merchants/{merchantId}/message-catalog                  | admin / admin       | messages:publish   | 012         | mvp:03#4.4             |

`merchantId` en ruta **sólo** bajo `admin`: el operador de OPE actúa sobre un merchant que no
es el suyo. La regla `ope-no-merchant-id-in-request` (constitución V) gana la excepción
explícita para el consumidor `admin`, con fixture que la acota (fuera de `admin` sigue
fallando). El tag `decision` queda reservado sin operaciones planeadas hasta el plano de
decisión.

## R-07 Guía de agentes y flujo

`CLAUDE.md` paso 0 del flujo HTTP: "la operación existe en `contracts/api-map.yaml` como
`planned` (con consumidor, capacidad, feature y fuente); construirla es pasarla a `built` y
referenciar su esquema de seguridad en la raíz si es el primero de su consumidor". Tabla de
comandos: `check:api-map`. Notas del contrato: esquemas y componentes propuestos como archivos
sin referencia; extensiones `x-idempotency` y `x-collection`.
