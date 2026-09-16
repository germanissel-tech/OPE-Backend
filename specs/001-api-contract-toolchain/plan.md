# Implementation Plan: Cadena de herramientas del contrato API

**Branch**: `001-api-contract-toolchain` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-api-contract-toolchain/spec.md`

## Summary

Construir la infraestructura API-first del backend: contrato OpenAPI 3.1 multi-archivo en
`contracts/` como única fuente de verdad, verificación automática que falla el build ante
cada regla de la constitución (Spectral con reglas propias + Redocly + oasdiff con severidades
custom), tipos y cliente generados (openapi-typescript / openapi-fetch), servidor que rutea por
`operationId` y valida request y response contra el contrato (openapi-backend sobre Fastify),
mock desde el mismo servidor, documentación estática (Redoc), pruebas de contrato generadas
(Schemathesis) y CI. Se demuestra con una sola operación, `GET /v1/health`. Las decisiones y su
evidencia están en [research.md](research.md).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 5.9.3 (`strict`, ESM, `module: NodeNext`)

**Primary Dependencies**: `fastify@5`, `openapi-backend@5`, `openapi-fetch@0.17`;
dev: `@stoplight/spectral-cli@6`, `@stoplight/spectral-core@1`, `@redocly/cli@2`,
`openapi-typescript@7`, `vitest@5`, `tsx@4`; binarios externos: `oasdiff@1.32.1`
(descargado por script), Schemathesis 4 (vía `uvx`)

**Storage**: N/A (sin persistencia en esta feature)

**Testing**: Vitest (unitarias, integración con `fastify.inject`, pruebas de reglas del
contrato y de compatibilidad sobre fixtures); Schemathesis (pruebas de contrato generadas
contra el servidor levantado)

**Target Platform**: Linux server (CI `ubuntu-latest`); desarrollo en Windows y macOS —
todos los scripts del repo en Node (`.mjs`), sin dependencias de shell

**Project Type**: web-service (backend HTTP) + toolchain de contrato

**Performance Goals**: `npm run contract:check` local < 30 s (SC-002); CI completo < 5 min
(SC-004). El servidor no tiene objetivo de latencia en esta feature (no hay plano de decisión).

**Constraints**: cero LLM en runtime; sin I/O de red en el servidor (sólo el diff/tests lo
usan en build); ningún campo PII en el contrato; `merchantId` nunca en request; todo error
RFC 9457; artefactos generados deterministas (SC-006); nada del código asume proveedor de
hosting

**Scale/Scope**: 1 operación (`getHealth`), ~12 reglas de lint propias, 7 clases de cambio
incompatible verificadas, ~8 scripts npm, 1 workflow de CI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (constitución, "Flujo de desarrollo") | ¿Aplica? | Cómo se cumple |
|---|---|---|
| Toca superficie HTTP → contrato diseñado en `specs/001/contracts/` antes de código; compatible o declara major | **Sí** | Diseño completo en [contracts/](contracts/) (raíz, `paths/health.yaml`, `ProblemDetails`, respuestas de error, ejemplos). Primer contrato: `info.version: 1.0.0`, `/v1`. No hay versión previa; el diff se omite con aviso (edge case de la spec). |
| Toca persistencia o API → tareas de prueba de aislamiento por merchant | **Sí (API)** | No hay datos ni credenciales; la frontera es el contrato. Se cumple con la prueba de la regla FR-017 (`merchantId` en path/query/header/cookie/body → falla) con un fixture por ubicación (research R-13). Las pruebas de contaminación cruzada con datos llegan con la feature 002. |
| Toca el plano de decisión → sin I/O de red ni escritura bloqueante; salida `NO_OP` posible | No | No hay plano de decisión. El servidor no hace I/O de red saliente. |
| Toca ledger o cadena de evidencia | No | — |
| Introduce campo nuevo de evento u orden → lista blanca, no PII | No | Único esquema nuevo: `Health` (`status`, `contractVersion`, `timestamp`) y `ProblemDetails`. Ninguno es PII; la regla `ope-no-pii` lo verifica mecánicamente. |
| Introduce llamada a modelo de lenguaje en runtime | No | Rechazado por diseño; ninguna dependencia de runtime lo hace. |

Principios adicionales relevantes:

- **I (composition root único)**: `src/main.ts` es el único lugar que instancia Fastify,
  openapi-backend y registra manejadores. `src/server/` no importa configuración de entorno.
- **Stack**: tipos y validadores se **generan** del contrato (openapi-typescript; openapi-backend
  compila validadores Ajv desde el documento). No hay esquema escrito a mano en paralelo.
- **Estado epistémico**: research.md marca cada decisión; quickstart.md marca BUILT/TESTED
  sólo con comando ejecutable.

**Resultado pre-Phase 0**: PASA. **Resultado post-Phase 1**: PASA (ver re-evaluación al
final).

## Project Structure

### Documentation (this feature)

```text
specs/001-api-contract-toolchain/
├── plan.md              # este archivo
├── spec.md
├── research.md          # Phase 0: decisiones y evidencia
├── data-model.md        # Phase 1: entidades del contrato y del servidor
├── quickstart.md        # Phase 1: guía de validación ejecutable
├── contracts/           # Phase 1: diseño del contrato (se copia a /contracts en implement)
│   ├── openapi.yaml
│   ├── paths/health.yaml
│   ├── components/schemas/{Health,ProblemDetails}.yaml
│   ├── components/responses/*.yaml
│   ├── examples/*.yaml
│   └── problem-types.yaml
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
contracts/                        # FUENTE DE VERDAD HTTP (FR-001)
├── openapi.yaml                  # raíz: info, servers, tags cerrados, paths ($ref). Sin components: el bundle los promueve por nombre de archivo
├── paths/health.yaml
├── components/
│   ├── schemas/Health.yaml
│   ├── schemas/ProblemDetails.yaml
│   ├── responses/{BadRequest,Unauthorized,NotFound,MethodNotAllowed,UnprocessableEntity,NotImplemented,InternalServerError}.yaml
│   ├── parameters/.gitkeep
│   └── securitySchemes/.gitkeep
├── webhooks/.gitkeep
├── examples/health-ok.yaml       # los ejemplos de error van inline en cada components/responses/*.yaml
├── problem-types.yaml            # catálogo de type URIs (única fuente)
├── .spectral.yaml                # ruleset: extends spectral:oas + reglas ope-*
├── rules/
│   ├── pii-denylist.json         # lista PII (única fuente, ampliable)
│   └── functions/*.js            # funciones custom de Spectral (CommonJS)
├── oasdiff-severity.txt          # severidades custom para FR-020
└── dist/                         # bundle (gitignored)

redocly.yaml                      # lint estructural + bundle + build-docs
docs/api/index.html               # docs generadas (gitignored)

src/
├── main.ts                       # composition root: config → buildServer → listen
├── server/
│   ├── build-server.ts           # Fastify + openapi-backend; ruta comodín; handlers 404/405/501/400/500
│   ├── problem-details.ts        # constructor de Problem Details + constantes de type (desde contracts/problem-types.yaml)
│   ├── handlers.ts               # tipo Handlers = { [operationId]: Handler<op> } derivado de src/generated
│   └── mock.ts                   # handler notImplemented en modo mock (mockResponseForOperation)
├── handlers/
│   └── health.ts                 # getHealth
├── generated/
│   └── api.d.ts                  # GENERADO por openapi-typescript — no editar
└── client/
    └── index.ts                  # createClient<paths>() de openapi-fetch; entrypoint "./client"

scripts/                          # todos en Node, multiplataforma
├── oasdiff-install.mjs           # descarga binario fijado + checksum
├── contract-diff.mjs             # bundle de base (git archive) + oasdiff --severity-levels; modo 2 archivos para tests
├── contract-types.mjs            # openapi-typescript → src/generated/api.d.ts con encabezado
├── contract-types-check.mjs      # drift: regenerar a temp y comparar
└── test-contract.mjs             # levanta servidor en puerto efímero, corre uvx schemathesis, apaga

tests/
├── unit/health.test.ts
├── unit/problem-details.test.ts
├── integration/server.test.ts    # US2: 200, 404, 405, 501, 400 (query/campo desconocido), 500 (respuesta inválida, excepción), arranque con contrato inválido, register de operationId inexistente
├── integration/mock.test.ts      # US3: mock responde example; rechaza igual que el real
├── contract-rules/
│   ├── fixtures/<regla>.yaml     # un contrato mínimo que viola cada regla (FR-012..FR-019, FR-003/004)
│   └── rules.test.ts             # Spectral programático; afirma la regla esperada
├── contract-diff/
│   ├── fixtures/{base,brk-*,compat-*}.yaml
│   └── diff.test.ts              # FR-020: 7 incompatibles fallan, 2 compatibles pasan, major bump pasa
└── types/client.test-d.ts        # SC-007: uso tipado compila; @ts-expect-error en uso incorrecto

.github/workflows/ci.yml
package.json  tsconfig.json  vitest.config.ts  .nvmrc  .gitignore  .gitattributes
CLAUDE.md                          # se actualiza con comandos y orden (FR-061)
```

**Structure Decision**: proyecto único (backend). `contracts/` vive en la raíz, no bajo
`src/`, porque es fuente para SDK y portal además del backend. `src/generated/` y `docs/api/`
son artefactos derivados: el primero se commitea (para que el drift sea visible en PR), el
segundo no.

### Comandos npm (nombres fijados por CLAUDE.md/HANDOFF)

| Comando | Qué hace |
|---|---|
| `contract:lint` | `redocly lint contracts/openapi.yaml` (estructura, refs) + `spectral lint contracts/openapi.yaml --ruleset contracts/.spectral.yaml --fail-severity warn` (estilo + reglas `ope-*`; `oas3-schema` apagada por bug con 3.1 multi-archivo, ver research R-02) |
| `contract:bundle` | `redocly bundle contracts/openapi.yaml -o contracts/dist/openapi.yaml` |
| `contract:diff` | `node scripts/contract-diff.mjs` (base = `origin/main` \| `main` \| `$CONTRACT_BASE_REF`) |
| `contract:types` | `node scripts/contract-types.mjs` |
| `contract:types:check` | `node scripts/contract-types-check.mjs` |
| `contract:check` | `contract:lint` → `contract:bundle` → `contract:diff` → `contract:types:check` |
| `contract:mock` | `OPE_MOCK=1` + servidor (`tsx src/main.ts`) |
| `contract:docs` | `contract:check` → `redocly build-docs contracts/dist/openapi.yaml -o docs/api/index.html` |
| `build` | `tsc -p tsconfig.json` |
| `dev` | `tsx watch src/main.ts` |
| `test` | `vitest run` |
| `test:contract` | `contract:bundle` → `node scripts/test-contract.mjs` |
| `typecheck` | `tsc --noEmit` (incluye `tests/types/*.test-d.ts`) |

## Diseño de los puntos no triviales

### Servidor (FR-040..FR-047)

1. `buildServer({ definition, handlers, mode })` crea Fastify (`logger` pino) y
   `new OpenAPIBackend({ definition, strict: true, validate: true, ajvOpts: { strict: false } })`.
2. `api.init()` falla ⇒ `buildServer` rechaza ⇒ `main.ts` sale con código ≠ 0 y el motivo en
   el log. Nunca "arranca parcialmente".
3. Registro: `api.register(handlersEnvueltos)`; un `operationId` inexistente hace que
   openapi-backend lance en `register` (verificado) ⇒ arranque abortado (SC-005).
4. Cada manejador se envuelve: recibe `{ params, query, headers, body }` tipados desde
   `src/generated/api.d.ts`; devuelve `{ status, body }` tipado por el union de respuestas
   declaradas (FR-046). El wrapper llama `api.validateResponse(body, operationId, status)`;
   si falla ⇒ log + Problem Details `response-contract-violation` (500). Nunca envía el body
   inválido (FR-043).
5. Handlers especiales de openapi-backend → Problem Details: `validationFail` → 400 con
   `errors[]` (uno por violación de Ajv, con `pointer` y `message`); `notFound` → 404;
   `methodNotAllowed` → 405 + header `Allow`; `notImplemented` → 501 (o mock en `OPE_MOCK=1`);
   excepciones no controladas → 500 genérico (FR-045).
6. Fastify: `setNotFoundHandler` y `setErrorHandler` reemplazados para que JSON inválido
   (`FST_ERR_CTP_*`) y cualquier otra falla del transporte también salgan como Problem Details.
   Ruta comodín `all('/*')` + parser de body que acepta `application/json` y
   `application/problem+json`.
7. `main.ts` es el único composition root: lee `PORT`, `HOST`, `OPE_MOCK`, carga
   `contracts/dist/openapi.yaml` (o el multi-archivo resuelto en dev), construye y escucha.

### Problem Details (FR-005, FR-018)

Esquema `ProblemDetails`: `type` (URI, default `about:blank`), `title`, `status`, `detail`,
`instance`, extensión `errors[]` (`{ pointer, message }`). Content-type
`application/problem+json`. `type` ∈ catálogo `contracts/problem-types.yaml` con esquema URN
`urn:ope:problem:<slug>` (research R-11). No se enumera en el esquema (agregar un tipo no debe
ser breaking).

### Compatibilidad (FR-020)

`scripts/contract-diff.mjs`:
1. Resolver base: `CONTRACT_BASE_REF` → `origin/main` → `main`. Si no existe o no contiene
   `contracts/openapi.yaml` ⇒ imprime `AVISO: sin contrato base, comparación omitida` y sale 0.
2. `git archive <base> contracts | tar -x` a `os.tmpdir()`, `redocly bundle` de la base.
3. `major(head.info.version) > major(base.info.version)` ⇒ `oasdiff changelog` sólo
   informativo, sale 0 con `Cambio incompatible esperado: versión mayor X → Y`.
4. Si no: `oasdiff breaking base head --fail-on ERR --severity-levels contracts/oasdiff-severity.txt --format text`;
   propaga exit code.
5. Modo `--base <file> --head <file>` para las pruebas de fixtures (sin git).

### Reglas del contrato (FR-012..FR-019)

Detalle regla → mecanismo en research R-02. Cada regla custom tiene `message` con "cómo
corregir" (FR-021) y un fixture que la viola en `tests/contract-rules/fixtures/` (FR-052).

## Complexity Tracking

Sin violaciones del Constitution Check. Dependencias que podrían discutirse:

| Elemento | Por qué | Alternativa más simple rechazada porque |
|---|---|---|
| Binario externo `oasdiff` (Go) | Único que cubre los 7 cambios de FR-020 configurando severidad | `@pb33f/openapi-changes` (npm) no detecta "agregar respuesta de error"; escribir un diff propio sería más código y menos confiable |
| Herramienta Python (Schemathesis) | Genera casos en bordes de esquema que las pruebas manuales no cubren (US5) | Sin equivalente en Node con mantenimiento activo; `uvx` lo hace de instalación cero |
| Dos linters (Spectral + Redocly) | Spectral para reglas propias declarativas; Redocly es necesario igual para bundle/docs y aporta lint estructural | Usar sólo uno perdería o el ruleset declarativo o el bundler |

## Re-evaluación del Constitution Check (post-Phase 1)

- El contrato diseñado en `specs/001/contracts/` no contiene campos PII ni `merchantId` en
  request; `getHealth` no tiene `security` (público, como fija la spec) y declara `500`.
- Todas las respuestas de error usan `application/problem+json` con `$ref` a `ProblemDetails`.
- Ningún componente de runtime hace I/O de red ni usa LLM.
- Composition root único: `src/main.ts`.

**Resultado: PASA.**
