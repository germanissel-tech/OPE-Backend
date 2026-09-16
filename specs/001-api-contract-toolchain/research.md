# Research — Feature 001: cadena de herramientas del contrato API

**Fecha**: 2026-09-16 · **Estado**: completo (sin NEEDS CLARIFICATION pendientes). Las decisiones transversales están registradas en `docs/adr/` (ADR-001 a ADR-005); este archivo conserva la evidencia.

Cada decisión indica su estado epistémico (DECIDIDO / PROPUESTO / ABIERTO) y, cuando hubo
verificación ejecutable durante la investigación, la evidencia. Lo que dice "verificar en
implementación" es una hipótesis que la tarea correspondiente debe confirmar con prueba.

## R-01 Runtime y lenguaje

- **Decisión (DECIDIDO por constitución D1)**: Node.js 22 LTS + TypeScript `strict`.
- **TypeScript 5.9.3, no 7.x**: `openapi-typescript@7.13.0` declara
  `peerDependencies.typescript: ^5.x` (verificado con `npm view`). TypeScript 7 (compilador
  nativo) rompería `npm ci`. Se revisa cuando openapi-typescript soporte 6/7.
- **ESM** (`"type": "module"`, `module: NodeNext`, `target: ES2022`). Todas las herramientas
  elegidas publican ESM o dual.
- **Alternativas**: Node 24 (también LTS) — no aporta nada a esta feature; se fija 22 en
  `engines` y `.nvmrc` para que local y CI coincidan.

## R-02 Lint de estilo y reglas propias → Spectral

**Registrado como ADR-004** (herramientas del contrato). Evidencia y detalle abajo.

- **Decisión (DECIDIDO)**: `@stoplight/spectral-cli@6.16.x` con ruleset en
  `contracts/.spectral.yaml` que extiende `spectral:oas` y agrega las reglas de OPE como
  reglas custom, todas `severity: error`. Las reglas que no se expresan con funciones
  built-in (`truthy`, `pattern`, `casing`, `enumeration`, `length`, `schema`) van como
  funciones JS en `contracts/rules/functions/` (Spectral carga funciones CommonJS desde
  `functionsDir`).
- **Mapa regla → requisito**:

  | Requisito | Regla(s) | Mecanismo |
  |---|---|---|
  | FR-012 operationId presente, único, camelCase | `operation-operationId` (oas), `operation-operationId-unique` (oas), `ope-operation-id-camel-case` | built-in `casing` |
  | FR-012 summary/description/tags | `operation-description` (oas), `operation-tags` (oas), `ope-operation-summary` | `truthy` |
  | FR-004 tags cerrados y exactamente uno | `operation-tag-defined` (oas), `ope-operation-single-tag`, `ope-tags-closed-catalog` | `length` + `enumeration` |
  | FR-013 propiedades con description | `ope-property-description` | `given: $..properties[*]`, `truthy` |
  | FR-014 ejemplos en request body y 2xx | `ope-request-example`, `ope-success-response-example` | función custom (acepta `example` o `examples` en el media type o en el schema) |
  | FR-015 `additionalProperties: false` en request (recursivo) | `ope-request-closed-schema` | función custom que recorre el schema resuelto (objetos anidados, `allOf`, `items`) |
  | FR-016 lista PII | `ope-no-pii` | función custom; lista en `contracts/rules/pii-denylist.json` (única fuente); compara sin mayúsculas; recorre `properties`, `parameters[].name`, `headers` |
  | FR-017 merchantId nunca en request | `ope-no-merchant-id-in-request` | función custom; normaliza (`merchant_id`, `merchant-id`, `MerchantId` → `merchantid`); recorre parámetros de path/query/header/cookie y propiedades del request body (recursivo); **no** mira respuestas |
  | FR-018 errores en Problem Details | `ope-error-response-problem-details` | `resolved: false`; respuestas `4xx`/`5xx` deben tener exactamente `application/problem+json` con `$ref` al esquema `ProblemDetails` (directo o vía `components/responses`) |
  | FR-019 respuestas obligatorias | `ope-required-error-responses` | función custom: `500` siempre; `401` si la operación tiene `security` no vacío (propio o heredado del root); `400` y `422` si tiene `requestBody` |
  | FR-003 prefijo `/v{major}` | `ope-path-version-prefix` | función custom: todo path empieza con `/v{major(info.version)}/` |
  | FR-011 estructura | Redocly lint (`struct`, `no-unresolved-refs`, `no-unused-components`) + `oas3-valid-*`, `no-$ref-siblings` (oas). `oas3-schema` apagada, ver abajo | ver R-03 |

- **FR-021 (regla, archivo, posición, cómo corregir)**: Spectral reporta código de regla,
  archivo y línea:columna sobre el contrato multi-archivo (sin bundle previo). El texto "cómo
  corregir" va en el `message` de cada regla custom.
- **Excepción `password` en login del portal**: la lista PII se aplica en todo el contrato; la
  excepción se implementa cuando exista el esquema de login (feature de portal), como
  `overrides` de Spectral acotado a ese archivo. En esta feature no hay excepción activa.
- **Alternativas**: Redocly custom rules/plugins (JS) — también sirven, pero Spectral tiene
  ruleset declarativo más legible para agentes y ecosistema de reglas más amplio. Vacuum
  (Go) — otro binario más.
- **Verificado (Spectral 6.16.3, sobre el contrato diseñado en `specs/001/contracts/`)**:
  - `functionsDir` + función CommonJS + ruleset YAML funcionan. El reporte señala el archivo
    hijo (`paths/health.yaml:6:13`), el id de regla y el `message` con la corrección (FR-021).
  - **Bug conocido**: `oas3-schema` falla con "must not have unevaluated properties" en todo
    path item que sea `$ref` a archivo externo en OpenAPI **3.1** (con 3.0.3 no ocurre; sobre
    el bundle tampoco). Decisión: `oas3-schema: "off"` en Spectral; la validez estructural la
    garantiza `redocly lint` (regla `struct` + `no-unresolved-refs`), que sí reporta en el
    archivo fuente. Sin esto el contrato multi-archivo no puede lintearse.
  - En el ruleset YAML hay que usar estilo bloque, no flow (`then: { field: x }` rompe el
    migrador de rulesets con "Cannot dump <unknown value>"), y `"off"` entre comillas (YAML
    1.1 lee `off` como `false`).
  - `oas3-unused-component` marca como no usados los `components` declarados en la raíz
    cuando los archivos hijos referencian archivos directamente. Decisión: la raíz **no**
    declara `components`; el bundle de Redocly los promueve a `#/components/<tipo>/<archivo>`
    (verificado: `Health`, `ProblemDetails`, `health-ok`, `BadRequest`, `InternalServerError`).
  - Redocly `security-defined` exige `security` explícito: `getHealth` declara `security: []`
    (público). Redocly `info-license` se apaga en `redocly.yaml` (API privada, sin licencia
    pública que declarar).

## R-03 Lint estructural, bundle y docs → Redocly CLI

**Registrado como ADR-004.**

- **Decisión (DECIDIDO)**: `@redocly/cli@2.x`. `redocly lint` (config `redocly.yaml`, ruleset
  `recommended` con `no-unused-components: error`) como segunda capa estructural; `redocly
  bundle` produce `contracts/dist/openapi.yaml` (gitignored, artefacto derivado); `redocly
  build-docs` produce `docs/api/index.html` autocontenido.
- **Docs = Redoc, no Scalar**: evita una dependencia más; Redocly ya está instalado.
  Alternativa registrada: `@scalar/cli` si Redoc no fuera determinista.
- **Verificado (Redocly CLI 2.53.2)**: dos corridas consecutivas de `bundle` y de
  `build-docs` sobre el contrato diseñado producen archivos byte a byte idénticos (`cmp`);
  ídem `openapi-typescript --alphabetize` (SC-006). `build-docs` genera un HTML autocontenido
  de ~197 KB.
- `contract:docs` ejecuta `contract:check` antes (FR-032).

## R-04 Breaking changes → oasdiff (binario) con severidades custom

**Registrado como ADR-003** (versionado) y **ADR-004** (herramienta).

- **Decisión (DECIDIDO)**: `oasdiff` v1.32.1, binario Go descargado de GitHub Releases por
  `scripts/oasdiff-install.mjs` (versión y checksums fijados en el script; destino
  `node_modules/.cache/oasdiff/`; se descarga en el primer uso, no en `postinstall`, para no
  penalizar instalaciones que no lo necesitan). Linux/macOS/Windows cubiertos por los assets
  oficiales. En CI corre sin paso manual.
- **Evidencia** (fixtures generados en la investigación, base + 7 variantes de FR-020 + 2
  compatibles). Con severidades por defecto `oasdiff breaking --fail-on ERR` detecta:
  eliminar operación (`api-path-removed-without-deprecation`), cambiar tipo
  (`response-property-type-changed`), quitar enum de request
  (`request-property-enum-value-removed`), volver obligatorio
  (`request-property-became-required`). **No** detecta como error: quitar/renombrar campo
  **opcional** de respuesta (`response-optional-property-removed`, INFO), cambiar `format`
  (`response-property-type-specialized`, INFO), agregar respuesta de error
  (`response-non-success-status-added`, INFO). Con
  `--severity-levels contracts/oasdiff-severity.txt` elevando esos tres checks a `err`, los
  7 casos fallan (`exit=1`) y los 2 compatibles pasan (`exit=0`). Los checks de `changelog`
  (757 ids) se listan con `oasdiff checks changelog`.
- **Alternativa rechazada — `@pb33f/openapi-changes` (npm, descarga binario en postinstall)**:
  detecta 3 de 4 casos probados pero **no** marca "agregar respuesta de error" y no permite
  configurar severidad por check. Rechazado por FR-020.
- **Alternativa rechazada — `@useoptic/optic`**: última publicación 2025-08; proyecto sin
  mantenimiento activo.
- **Base de comparación**: `scripts/contract-diff.mjs` hace `git archive <base> contracts/`
  a un directorio temporal, bundlea con Redocly y compara. `<base>` = `origin/main` si existe,
  si no `main`; override con `CONTRACT_BASE_REF`. Si la base no tiene `contracts/openapi.yaml`
  → aviso explícito y salida 0 (edge case "primer contrato"). Si `major(head) > major(base)`
  → corre oasdiff sólo para reportar y sale 0 (US1 escenario 12).

## R-05 Tipos generados → openapi-typescript; cliente → openapi-fetch

- **Decisión (DECIDIDO)**: `openapi-typescript@7.13` genera `src/generated/api.d.ts` desde el
  bundle con encabezado "GENERADO — no editar". Se commitea. `scripts/contract-types-check.mjs`
  regenera a temporal y compara byte a byte (FR-031, US3 escenario 5). Opciones fijas
  (`--alphabetize`, `--export-type`) para determinismo.
- `openapi-fetch@0.17` (~6 KB min, ~2 KB gzip) como cliente tipado, exportado desde
  `src/client/index.ts` y expuesto como entrypoint `"./client"` en `package.json` (FR-033,
  SC-007). La prueba de "tipo incorrecto no compila" usa `// @ts-expect-error` en un archivo
  de prueba de tipos incluido en `tsc --noEmit`.
- **Alternativas**: `openapi-zod-client`/`orval` — generan más código y validadores
  paralelos; la constitución exige que el validador de runtime derive del contrato, cosa que
  openapi-backend ya hace directamente desde el documento.

## R-06 Servidor: validación en runtime y routing por operationId → openapi-backend sobre Fastify

**El mapa de códigos 400/422 está registrado como ADR-001.**

- **Decisión (DECIDIDO)**: `openapi-backend@5.20` como router/validador, con Fastify 5 como
  transporte HTTP (una única ruta comodín delega en `api.handleRequest`).
- **Evidencia** (openapi-backend 5.20.3, documento 3.1, `strict: true`, `ajvOpts: {strict: false}`):
  - `GET /v1/health?foo=bar` → `validationFail` con `additionalProperties` en `/query` (edge
    case de query desconocida, FR-042).
  - Ruta inexistente → `notFound`; método no declarado → `methodNotAllowed`; operación sin
    handler → `notImplemented` (FR-044).
  - `api.validateResponse(body, operationId, status)` detecta propiedades extra y tipos
    (FR-043).
  - `api.register('doesNotExist', fn)` lanza `Unknown operationId ... Refusing to register
    handler` (SC-005).
  - Documento inválido (sin `info.version`) → `init()` lanza `Document is not valid OpenAPI`
    (FR-040).
  - `api.mockResponseForOperation(id)` devuelve el `example` declarado (ver R-07).
- **Por qué no `fastify-openapi-glue`**: la validación de respuesta de Fastify
  (`fast-json-stringify`) **recorta** propiedades no declaradas en vez de rechazar, y coerciona
  tipos en request por defecto; ambas contradicen FR-042/FR-043 (rechazar, no limpiar).
- **Por qué Fastify y no `node:http` pelado**: parseo de body con límites, logs estructurados
  (pino) que la constitución pide, ciclo de vida/cierre ordenado, e `inject()` para pruebas de
  integración sin puerto. El costo es reemplazar sus handlers de 404 y de error por Problem
  Details (Fastify responde JSON propio ante JSON inválido o ruta desconocida).
- **Mapa de códigos** (DECIDIDO, alineado con la spec): toda violación del contrato en el
  request detectada por el validador (parámetro/campo desconocido, tipo, enum, requerido,
  formato) → `400` con `errors[]` enumerando cada violación; JSON no parseable o content-type
  no soportado → `400`; `422` queda reservado para manejadores que rechazan un request válido
  por semántica de dominio (por eso FR-019 lo exige declarado en operaciones con body).
  Respuesta inválida → `500` + log; excepción no controlada → `500` genérico sin detalles.
- **Ajv y OpenAPI 3.1**: openapi-backend usa Ajv 8; con `ajvOpts.strict=false` acepta el
  vocabulario 3.1 usado en esta feature (`type`, `enum`, `format`, `additionalProperties`,
  `required`). Verificar en implementación que `format: date-time` valida (agregar
  `ajv-formats` si hace falta).

## R-07 Mock → el mismo servidor en modo mock (reemplaza a Prism)

**Registrado como ADR-005.**

- **Decisión (DECIDIDO, desvío respecto de HANDOFF)**: `npm run contract:mock` levanta el
  mismo servidor con `OPE_MOCK=1`: no registra manejadores de dominio y el handler
  `notImplemented` responde con `api.mockResponseForOperation(operationId)` (el `example`
  del contrato). La validación de request, los `404`/`405` y los Problem Details son
  **idénticos** al servidor real porque es el mismo código.
- **Razón**: US3 escenario 2 exige que el mock rechace con "el mismo código de error que el
  servidor real". Prism responde `422` a toda violación de esquema y no valida parámetros no
  declarados; habría requerido documentar una divergencia permanente. Además elimina una
  dependencia (`@stoplight/prism-cli`, ~300 paquetes).
- **Costo**: sin generación dinámica de datos ni `Prefer: example=`; para el MVP, los
  ejemplos declarados alcanzan y son obligatorios por FR-014.

## R-08 Pruebas de contrato generadas → Schemathesis vía `uvx`

- **Decisión (DECIDIDO)**: `uvx schemathesis run contracts/dist/openapi.yaml --url
  http://127.0.0.1:<port> --checks all --phases examples,coverage,fuzzing` orquestado por
  `scripts/test-contract.mjs` (arranca el servidor en puerto efímero, espera `/v1/health`,
  corre, apaga, propaga el código de salida). Verificado localmente: `uvx schemathesis
  --version` → 4.27.2. En CI, `astral-sh/setup-uv`.
- **Alternativas**: Dredd (sin mantenimiento), Portman/Newman (más pasos, menos cobertura de
  bordes). Schemathesis es el único que genera casos negativos en los bordes de cada esquema
  (US5).

## R-09 Pruebas unitarias/integración → Vitest

- **Decisión (DECIDIDO)**: `vitest@5`. Integración vía `fastify.inject()` (sin puerto).
  Pruebas de reglas del contrato (FR-052): fixtures YAML en `tests/contract-rules/fixtures/`,
  uno por regla, ejecutando Spectral programáticamente (`@stoplight/spectral-core`) y
  afirmando que aparece **esa** regla. Pruebas de FR-020: fixtures base + variantes en
  `tests/contract-diff/fixtures/`, ejecutando `scripts/contract-diff.mjs` en modo
  "comparar dos archivos" y afirmando `exit≠0` / `exit=0`.
- **Alternativa**: `node:test` — sin `inject` helpers ni watch; Vitest es el estándar del
  ecosistema y lo usarán SDK y portal.

## R-10 CI → GitHub Actions

- **Decisión (DECIDIDO)**: `.github/workflows/ci.yml`, un job en `ubuntu-latest`: checkout
  con `fetch-depth: 0` (necesario para `git archive origin/main`), `setup-node@v4` (22, cache
  npm), `setup-uv`, `npm ci`, `npm run contract:check`, `npm run build`, `npm test`,
  `npm run test:contract`. Objetivo SC-004: < 5 min (estimado: ~2 min; el mayor costo es
  `uvx` la primera vez, cacheable con `enable-cache: true`).

## R-11 Espacio de nombres de `type` de Problem Details

**Registrado como ADR-002.**

- **Decisión (DECIDIDO)**: URN `urn:ope:problem:<slug>` (por ejemplo
  `urn:ope:problem:validation-failed`). RFC 9457 §3.1 permite URIs no dereferenciables y
  recomienda que sean estables; un URN no depende de un dominio cuya propiedad no está
  confirmada (D3 hosting ABIERTO) y no cambia si cambia el hosting. Cambiar el `type` es
  incompatible para clientes que lo comparan, así que la decisión se toma ahora.
- Catálogo inicial (`contracts/problem-types.yaml`, única fuente; el servidor importa las
  constantes y una prueba verifica que todo `type` emitido está en el catálogo):
  `validation-failed` (400), `unauthorized` (401), `not-found` (404),
  `method-not-allowed` (405), `unprocessable` (422), `not-implemented` (501),
  `internal-error` (500), `response-contract-violation` (500).
- **Alternativa rechazada**: `https://ope.dev/problems/<slug>` (HANDOFF, PROPUESTO): mejor
  UX si se sirviera documentación, pero exige un dominio que hoy no es DECIDIDO.

## R-12 Versionado del contrato

**Registrado como ADR-003.**

- **Decisión (DECIDIDO)**: `info.version: 1.0.0` desde el inicio (el prefijo `/v1` implica
  major 1; con `0.x` la regla de "breaking ⇒ major" no tendría sentido). Regla
  `ope-path-version-prefix` ata ambos. Cambio incompatible ⇒ `2.0.0` + prefijo `/v2`.

## R-13 Reglas de aislamiento por merchant en esta feature

- Sin persistencia ni credenciales, la única frontera es el contrato. La prueba de aislamiento
  exigida por el gate de la constitución se cumple con la prueba de la regla FR-017
  (`merchantId` no puede entrar por path/query/header/cookie/body) sobre fixtures que lo
  intentan en cada ubicación. Las pruebas de contaminación cruzada con datos reales llegan
  con la feature 002 (ingesta), que es la primera con `merchantId` derivado de credencial.

## Resumen de herramientas (versiones a fijar en `package.json`)

| Rol | Paquete | Versión |
|---|---|---|
| Lint reglas | `@stoplight/spectral-cli`, `@stoplight/spectral-core` (tests) | 6.16.x |
| Lint estructural / bundle / docs | `@redocly/cli` | 2.53.x |
| Breaking changes | `oasdiff` (binario, script de descarga) | 1.32.1 |
| Tipos | `openapi-typescript` | 7.13.x |
| Cliente | `openapi-fetch` | 0.17.x |
| Servidor | `fastify`, `openapi-backend` | 5.12.x, 5.20.x |
| Pruebas | `vitest`, Schemathesis (uvx) | 5.0.x, 4.27.x |
| TS | `typescript`, `tsx`, `@types/node` | 5.9.3, 4.x, 22.x |
