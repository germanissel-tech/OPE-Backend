# Tasks: Cadena de herramientas del contrato API

**Input**: Design documents from `specs/001-api-contract-toolchain/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: la spec exige pruebas (FR-050, FR-051, FR-052) y la constitución fija el orden
"contrato → pruebas → código". Las tareas de prueba preceden a las de implementación en cada
historia y deben **fallar** antes de implementar.

**Organization**: por historia de usuario, en orden de prioridad. Las historias comparten la
fundación (Fase 2); a partir de ahí son independientes salvo donde se indica.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: US1..US5 según spec.md
- Rutas exactas en cada descripción; raíz del repo = `backend/`

## Path Conventions

Proyecto único: `contracts/`, `src/`, `scripts/`, `tests/` en la raíz (ver plan.md →
Project Structure). Todos los scripts de repo en Node (`.mjs`), multiplataforma.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: proyecto Node/TS con las herramientas fijadas en research.md.

- [X] T001 Crear `package.json` (`"type": "module"`, `engines.node: ">=22"`, `private: true`, exports `"."` y `"./client"`) con dependencias: `fastify@^5.12`, `openapi-backend@^5.20`, `openapi-fetch@^0.17`; dev: `typescript@5.9.3` (exacta, research R-01), `tsx@^4`, `@types/node@^22`, `vitest@^5`, `@stoplight/spectral-cli@^6.16`, `@stoplight/spectral-core@^1`, `@redocly/cli@^2.53`, `openapi-typescript@^7.13`, `yaml@^2`. Scripts con los nombres de plan.md → "Comandos npm": `contract:lint`, `contract:bundle`, `contract:diff`, `contract:types`, `contract:types:check`, `contract:check`, `contract:mock`, `contract:docs`, `build`, `dev`, `test`, `test:contract`, `typecheck`. Ejecutar `npm install` y commitear `package-lock.json`.
- [X] T002 [P] Crear `tsconfig.json` (`strict: true`, `noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, `rootDir: src`, `outDir: dist`, `declaration: true`, `include: ["src"]`) y `tsconfig.typecheck.json` que extiende el anterior con `noEmit: true` e `include: ["src", "tests"]` (para `tests/types/*.test-d.ts`).
- [X] T003 [P] Crear `vitest.config.ts` (`test.include: ["tests/**/*.test.ts"]`, `typecheck` deshabilitado, `testTimeout: 30000` para las pruebas que invocan CLIs) y `.nvmrc` con `22`.
- [X] T004 [P] Actualizar `.gitignore` agregando `contracts/dist/`, `docs/api/`, `node_modules/.cache/` y crear `.gitkeep` en `contracts/components/parameters/`, `contracts/components/securitySchemes/`, `contracts/webhooks/`.
- [X] T005 [P] Crear `redocly.yaml` en la raíz: `extends: [recommended]`, `rules: { info-license: off, no-unused-components: error, security-defined: error }`, `apis.main.root: contracts/openapi.yaml` (research R-02/R-03).

---

## Phase 2: Foundational (contrato base y bundle — bloquea todas las historias)

**Purpose**: el contrato fuente existe en `contracts/` y se puede lintear estructuralmente,
bundlear y convertir en tipos. Sin esto ninguna historia es verificable.

**⚠️ CRITICAL**: ninguna historia empieza hasta cerrar esta fase.

- [X] T006 Copiar el contrato diseñado de `specs/001-api-contract-toolchain/contracts/` a `contracts/` respetando la estructura (`openapi.yaml`, `paths/health.yaml`, `components/schemas/{Health,ProblemDetails}.yaml`, `components/responses/{BadRequest,Unauthorized,NotFound,MethodNotAllowed,UnprocessableEntity,InternalServerError,NotImplemented}.yaml`, `examples/health-ok.yaml`, `problem-types.yaml`). No modificar contenido: `Health` con `additionalProperties: false`, `required: [status, contractVersion, timestamp]`, `status` enum `[ok, degraded]`, `contractVersion` pattern `^\d+\.\d+\.\d+$`, `timestamp` `format: date-time`; `ProblemDetails` `required: [type, title, status]`, `status` `minimum: 400, maximum: 599`, `errors[].{pointer,message}`; `getHealth` con `security: []`, respuestas `200`, `400`, `500`.
- [X] T007 Verificar `npx redocly lint contracts/openapi.yaml` y `npx redocly bundle contracts/openapi.yaml -o contracts/dist/openapi.yaml` en verde; confirmar que el bundle expone `#/components/schemas/Health`, `#/components/schemas/ProblemDetails`, `#/components/responses/BadRequest`, `#/components/responses/InternalServerError`, `#/components/examples/health-ok` (research R-02).
- [X] T008 Crear `scripts/contract-types.mjs`: ejecuta `openapi-typescript contracts/dist/openapi.yaml --alphabetize --export-type` (API programática de `openapi-typescript`), antepone el encabezado `// GENERADO por scripts/contract-types.mjs desde contracts/dist/openapi.yaml — NO EDITAR A MANO.` y escribe `src/generated/api.d.ts` con `\n` como fin de línea. Ejecutarlo y commitear el archivo generado.
- [X] T009 [P] Crear `scripts/contract-types-check.mjs`: regenera a un archivo temporal con la misma función de T008, compara byte a byte con `src/generated/api.d.ts`; si difieren imprime `Tipos generados desactualizados: corré npm run contract:types` y sale 1; si coinciden imprime `Tipos generados al día` y sale 0 (FR-031).
- [X] T010 [P] Crear `src/server/problem-details.ts`: declarar en código las constantes `PROBLEM_TYPES` (`slug`, `type = "urn:ope:problem:" + slug`, `status`, `title` para los 8 tipos de data-model.md; el catálogo YAML sigue siendo la fuente y T011 verifica que coinciden) y exportar `problem(typeSlug, { detail?, instance?, errors? })` que devuelve `{ status, body: ProblemDetails }` tipado con `components["schemas"]["ProblemDetails"]` de `src/generated/api.d.ts`. Exportar `PROBLEM_CONTENT_TYPE = "application/problem+json"`.
- [X] T011 [P] Crear `tests/unit/problem-details.test.ts`: (a) cada `type` de `PROBLEM_TYPES` existe en `contracts/problem-types.yaml` (parsear con `yaml`) con el mismo `status` y `title`, y viceversa (catálogo ⊆ código); (b) `problem("validation-failed", {errors:[...]})` produce `status: 400` y body con `type: "urn:ope:problem:validation-failed"`; (c) el body nunca incluye claves fuera de `type,title,status,detail,instance,errors`.

**Checkpoint**: `npm run contract:bundle`, `npm run contract:types`, `npm run contract:types:check` y `npx vitest run tests/unit/problem-details.test.ts` en verde.

---

## Phase 3: User Story 1 — El contrato frena al agente que lo viola (Priority: P1) 🎯 MVP

**Goal**: `npm run contract:check` falla, con regla + archivo + línea + cómo corregir, ante
cada violación de FR-011..FR-020, y pasa limpio sobre el contrato válido.

**Independent Test**: `tests/contract-rules/rules.test.ts` (una violación por regla) y
`tests/contract-diff/diff.test.ts` (7 incompatibles fallan, 2 compatibles pasan, major bump
pasa) en verde; `npm run contract:check` sale 0 sobre `contracts/`.

### Tests for User Story 1 (escribir primero; deben fallar hasta implementar las reglas)

- [X] T012 [P] [US1] Crear fixtures en `tests/contract-rules/fixtures/`, un contrato **mínimo y autocontenido** (un solo archivo, sin `$ref` externos) por regla, que viole **sólo** esa regla; nombre = id de regla: `operation-operationId.yaml`, `operation-operationId-unique.yaml`, `ope-operation-id-camel-case.yaml`, `ope-operation-summary.yaml`, `operation-description.yaml`, `operation-tags.yaml`, `ope-operation-single-tag.yaml`, `ope-tags-closed-catalog.yaml`, `ope-property-description.yaml`, `ope-request-example.yaml`, `ope-success-response-example.yaml`, `ope-request-closed-schema.yaml` (objeto anidado sin `additionalProperties: false`), `ope-no-pii.yaml` (propiedad opcional `Email`, mayúscula distinta), `ope-no-merchant-id-in-request.path.yaml`, `ope-no-merchant-id-in-request.query.yaml`, `ope-no-merchant-id-in-request.header.yaml`, `ope-no-merchant-id-in-request.cookie.yaml`, `ope-no-merchant-id-in-request.body.yaml` (usar `merchant_id`, `merchant-id`, `MerchantId`, `merchantId` alternados), `ope-error-response-problem-details.yaml` (un `404` con `application/json`), `ope-required-error-responses.500.yaml`, `ope-required-error-responses.401.yaml` (operación con `security` sin `401`), `ope-required-error-responses.400-422.yaml` (con `requestBody` sin `400`/`422`), `ope-path-version-prefix.yaml` (`info.version: 2.0.0` con path `/v1/x`), más `valid.yaml` (pasa todas) y `merchant-id-in-response.yaml` (con `merchantId` sólo en respuesta: debe pasar).
- [X] T013 [US1] Crear `tests/contract-rules/rules.test.ts`: carga `contracts/.spectral.yaml` con `@stoplight/spectral-core` + `@stoplight/spectral-ruleset-bundler` (o `spectral-cli` vía `execFileSync` con `--format json` si el bundler complica el `functionsDir`), corre sobre cada fixture y afirma: para `<regla>[.variante].yaml` hay al menos un resultado con `code === <regla>` y `severity === 0` (error), y con `range.start.line` definido; para `valid.yaml` y `merchant-id-in-response.yaml`, cero resultados de severidad error o warn. Cubre FR-052 y SC-001; el caso `merchant-id-in-*` es la prueba de aislamiento por merchant de esta feature (plan → Constitution Check).
- [X] T014 [P] [US1] Crear fixtures en `tests/contract-diff/fixtures/`: `base.yaml` (contrato bundleado con `getHealth` + una operación `createThing` con `requestBody` cuyo esquema tiene `kind` enum `[a,b]` y `note` opcional, ambos con `500`), y variantes: `brk-remove-operation.yaml`, `brk-remove-response-field.yaml` (quita `version` opcional), `brk-rename-response-field.yaml`, `brk-request-field-required.yaml`, `brk-change-type.yaml`, `brk-change-format.yaml`, `brk-remove-request-enum.yaml`, `brk-add-error-response.yaml` (`429` nuevo), `compat-add-optional-and-op.yaml`, `compat-add-enum-in-request.yaml`, `major-bump.yaml` (= `brk-remove-operation` con `info.version: 2.0.0`).
- [X] T015 [US1] Crear `tests/contract-diff/diff.test.ts`: ejecuta `node scripts/contract-diff.mjs --base <fixture> --head <fixture>` con `execFile` y afirma exit ≠ 0 y salida que incluye el id de check esperado para cada `brk-*`, exit 0 para `compat-*`, exit 0 y salida con `Cambio incompatible esperado: versión mayor 1 → 2` para `major-bump`, y exit 0 con `AVISO: sin contrato base` cuando `--base` apunta a un archivo inexistente (FR-020 y edge cases).

### Implementation for User Story 1

- [X] T016 [P] [US1] Crear `contracts/rules/pii-denylist.json` con `["email","name","firstName","lastName","phone","address","document","dni","ip","ipAddress","card","cardNumber","password"]` y un campo `"_doc"` explicando que la comparación es sin distinguir mayúsculas y que se amplía acá (FR-016).
- [X] T017 [P] [US1] Crear `contracts/rules/functions/noPii.js` (CommonJS): recibe el documento resuelto en `given: $`, recorre recursivamente `properties` de todo esquema, `parameters[].name` y `headers` (en responses y encodings), compara en minúsculas contra la lista de T016, devuelve un resultado por coincidencia con `path` al elemento y `message` `"'<nombre>' es un dato personal prohibido (contracts/rules/pii-denylist.json). OPE no almacena información identificatoria: quitá la propiedad o reemplazala por una clave seudónima."`.
- [X] T018 [P] [US1] Crear `contracts/rules/functions/noMerchantIdInRequest.js`: para cada operación, revisa `parameters` (propios y del path item) en `path|query|header|cookie` y las propiedades del `requestBody` (recursivo por `properties`, `items`, `allOf/oneOf/anyOf`), normaliza `nombre.toLowerCase().replace(/[_-]/g,'')` y falla si es `merchantid`; **no** recorre `responses`. Mensaje: `"'<nombre>' no puede entrar por el request: merchantId se deriva de la credencial (constitución V). Quitalo del <in|body>."`.
- [X] T019 [P] [US1] Crear `contracts/rules/functions/requestClosedSchema.js`: para cada `requestBody.content[*].schema` resuelto, recorre objetos (`type: object` o con `properties`) y sus anidados (`properties`, `items`, `allOf/oneOf/anyOf`) y falla en cada objeto sin `additionalProperties: false`. Mensaje: `"El esquema de request en <path> no declara additionalProperties: false; los campos no declarados deben rechazarse (constitución VII)."`.
- [X] T020 [P] [US1] Crear `contracts/rules/functions/hasExample.js`: recibe un media type object; pasa si tiene `example`, `examples` con al menos una clave, o `schema.example`/`schema.examples`. Mensaje: `"Falta ejemplo en <path>: agregá example o examples al media type."`.
- [X] T021 [P] [US1] Crear `contracts/rules/functions/requiredErrorResponses.js`: recibe una operación (`given` con `resolved: true`) y el documento vía `context.document`; exige `500`; exige `401` si `operation.security` es un array no vacío o si `operation.security` es undefined y `root.security` es un array no vacío; exige `400` y `422` si hay `requestBody`. Un resultado por código faltante: `"La operación <operationId> debe declarar la respuesta <código> como Problem Details (FR-019)."`.
- [X] T022 [P] [US1] Crear `contracts/rules/functions/pathVersionPrefix.js`: recibe el documento; `major = info.version.split('.')[0]`; cada clave de `paths` debe empezar con `/v${major}/`. Mensaje: `"El path <path> no lleva el prefijo /v<major>/ que corresponde a info.version <version>. Un cambio de major cambia el prefijo."`.
- [X] T023 [P] [US1] Crear `contracts/rules/functions/problemDetailsErrorResponse.js`: se usa con `resolved: false`; recibe una respuesta (`given: $.paths[*][*].responses[?(@property.match(/^[45]\d\d$/))]`); pasa si es `$ref` a `../components/responses/*.yaml`/`#/components/responses/*` **o** si su `content` tiene exactamente la clave `application/problem+json` cuyo `schema.$ref` termina en `ProblemDetails.yaml` o `#/components/schemas/ProblemDetails`. Mensaje: `"La respuesta <código> de <operationId> debe ser application/problem+json con el esquema ProblemDetails (RFC 9457)."`.
- [X] T024 [US1] Crear `contracts/.spectral.yaml` (estilo bloque, `"off"` entre comillas — research R-02): `extends: ["spectral:oas"]`, `functionsDir: ./rules/functions`, `functions: [noPii, noMerchantIdInRequest, requestClosedSchema, hasExample, requiredErrorResponses, pathVersionPrefix, problemDetailsErrorResponse]`, `rules:` con `oas3-schema: "off"`, elevar a `error` las heredadas `operation-operationId`, `operation-operationId-unique`, `operation-description`, `operation-tags`, `operation-tag-defined`, `oas3-unused-component`, `oas3-valid-media-example`, `oas3-valid-schema-example`, y definir las reglas `ope-*` de research R-02 (todas `severity: error`, `message` con corrección): `ope-operation-id-camel-case` (`casing` `{type: camel}` sobre `$.paths[*][*].operationId`), `ope-operation-summary` (`truthy`), `ope-operation-single-tag` (`length` `{min: 1, max: 1}` sobre `tags`), `ope-tags-closed-catalog` (`enumeration` `{values: [system, ingest, decision, outcomes, portal, admin]}` sobre `$.tags[*].name` y `$.paths[*][*].tags[*]`), `ope-property-description` (`truthy` `description` en `$..properties[*]`), `ope-request-example` (`hasExample` en `$.paths[*][*].requestBody.content[*]`), `ope-success-response-example` (`hasExample` en `$.paths[*][*].responses[?(@property.match(/^2\d\d$/))].content[*]`), `ope-request-closed-schema`, `ope-no-pii` (`given: $`), `ope-no-merchant-id-in-request` (`given: $`), `ope-error-response-problem-details` (`resolved: false`), `ope-required-error-responses` (`given: $.paths[*][get,put,post,delete,patch,options,head,trace]`), `ope-path-version-prefix` (`given: $`).
- [X] T025 [US1] Correr `npx spectral lint contracts/openapi.yaml --ruleset contracts/.spectral.yaml --fail-severity warn` → 0 problemas; correr `npx vitest run tests/contract-rules` → verde. Ajustar reglas/fixtures hasta que cada fixture falle exactamente por su regla. Registrar en `tests/contract-rules/README.md` cómo agregar una regla nueva (regla + fixture + fila en research).
- [X] T026 [US1] Crear `scripts/oasdiff-install.mjs`: constantes `VERSION = "1.32.1"` y tabla `{platform-arch → asset}` (`linux_amd64`, `linux_arm64`, `darwin_all`, `windows_amd64`, `windows_arm64`, `.tar.gz`); destino `node_modules/.cache/oasdiff/<version>/oasdiff[.exe]`; si existe, imprime la ruta y sale; si no, descarga `https://github.com/oasdiff/oasdiff/releases/download/v<version>/<asset>` y `checksums.txt`, verifica SHA-256, extrae con `tar` de Node (`node:zlib` + parser tar mínimo o `tar` del sistema vía `execFile` con fallback claro), `chmod 755`. Exportar `ensureOasdiff(): Promise<string>` y permitir ejecución directa.
- [X] T027 [US1] Crear `contracts/oasdiff-severity.txt` con `response-optional-property-removed err`, `response-non-success-status-added err`, `response-property-type-specialized err`, `response-property-type-generalized err`, `response-property-format-changed err` (si el id existe en `oasdiff checks changelog`; si no, omitirlo y anotarlo en el archivo) — research R-04.
- [X] T028 [US1] Crear `scripts/contract-diff.mjs`: (1) parsea `--base <file>`/`--head <file>` (modo pruebas) o, sin flags, resuelve `CONTRACT_BASE_REF` → `origin/main` → `main` (`git rev-parse --verify`), hace `git archive <ref> contracts` a `os.tmpdir()`, bundlea con `redocly bundle` y usa `contracts/dist/openapi.yaml` como head; (2) si la base no existe o no tiene `contracts/openapi.yaml` (o `--base` no existe) imprime `AVISO: sin contrato base, comparación omitida` y sale 0; (3) lee `info.version` de ambos con `yaml`; si `major(head) > major(base)` corre `oasdiff changelog` y sale 0 con `Cambio incompatible esperado: versión mayor <b> → <h>`; (4) si no, corre `oasdiff breaking <base> <head> --fail-on ERR --format text --severity-levels contracts/oasdiff-severity.txt`, reenvía stdout/stderr y propaga el exit code; (5) sin cambios imprime `Sin cambios incompatibles`. Usa `ensureOasdiff()` de T026.
- [X] T029 [US1] Correr `npx vitest run tests/contract-diff` → verde; correr `npm run contract:check` completo sobre `contracts/` → sale 0 con `AVISO: sin contrato base` (main aún no tiene contrato). Medir el tiempo (< 30 s, SC-002) y anotarlo en `quickstart.md` → "Estado al cierre".

**Checkpoint**: US1 completa: la verificación frena cada violación y pasa el contrato válido.

---

## Phase 4: User Story 2 — El backend sólo puede exponer lo que el contrato declara (Priority: P1)

**Goal**: servidor que carga el contrato, rutea por `operationId`, valida request y response,
responde Problem Details en todo error y sirve `GET /v1/health`.

**Independent Test**: `tests/integration/server.test.ts` y `tests/unit/health.test.ts` en
verde; `npm run typecheck` falla si un manejador devuelve un tipo fuera del contrato.

### Tests for User Story 2 (escribir primero; deben fallar hasta implementar el servidor)

- [X] T030 [P] [US2] Crear `tests/unit/health.test.ts`: `getHealth` (función pura que recibe `{ contractVersion, now: () => Date }`) devuelve `status: 200` y body `{ status: "ok", contractVersion, timestamp }` con `timestamp` igual a `now().toISOString()`; no hay claves extra.
- [X] T031 [P] [US2] Crear `tests/integration/server.test.ts` usando `buildServer` + `app.inject()`: (1) `GET /v1/health` → 200, `content-type: application/json`, body válido contra el esquema `Health` (validar con Ajv o comparando claves y formatos); (2) `GET /nope` → 404 `application/problem+json` con `type: urn:ope:problem:not-found`; (3) `POST /v1/health` → 405 problem+json con header `Allow: GET`; (4) operación declarada sin manejador → 501 problem+json (usar un contrato de prueba con dos operaciones, cargado desde `tests/integration/fixtures/two-ops.yaml`); (5) `GET /v1/health?x=1` → 400 problem+json con `errors[0].pointer === "/query/x"`; (6) request con body JSON inválido a la operación con `requestBody` del contrato de prueba → 400 problem+json; body con campo no declarado → 400 con `errors[0].pointer` que menciona el campo; (7) manejador que devuelve `{ status: 200, body: { status: "ok", extra: 1 } }` (cast a `unknown` para saltar el tipo) → 500 problem+json `type: urn:ope:problem:response-contract-violation` y el body inválido no aparece; (8) manejador que lanza `new Error("secreto")` → 500 problem+json `type: urn:ope:problem:internal-error` y el texto `secreto` no aparece en la respuesta; (9) `buildServer` con un documento inválido (`tests/integration/fixtures/invalid.yaml`, sin `info.version`) rechaza con error que menciona el motivo; (10) `buildServer` con `handlers: { doesNotExist: ... }` (cast) rechaza con `Unknown operationId` (SC-005).
- [X] T032 [P] [US2] Crear `tests/types/server-handlers.test-d.ts`: un manejador `getHealth` que devuelve `status: 200` con body `Health` compila; con `// @ts-expect-error` uno que devuelve `body: { status: "ok" }` (faltan campos) y otro con `status: 201` (no declarado) — FR-046, US2 escenario 7.

### Implementation for User Story 2

- [X] T033 [P] [US2] Crear `src/server/handlers.ts`: tipos derivados de `src/generated/api.d.ts`: `OperationId = keyof operations`; `ResponsesOf<Op>`; `TypedResponse<Op>` = union sobre cada status declarado de `{ status: S; body: <content application/json | application/problem+json de esa respuesta> }`; `TypedRequest<Op>` = `{ params, query, headers, body }` desde `operations[Op]["parameters"]`/`requestBody`; `Handler<Op> = (req: TypedRequest<Op>) => Promise<TypedResponse<Op>>`; `Handlers = Partial<{ [Op in OperationId]: Handler<Op> }>`.
- [X] T034 [P] [US2] Crear `src/handlers/health.ts`: `makeGetHealth({ contractVersion, now }): Handler<"getHealth">` que devuelve `{ status: 200, body: { status: "ok", contractVersion, timestamp: now().toISOString() } }`. Sin I/O.
- [X] T035 [US2] Crear `src/server/build-server.ts`: `buildServer({ definition, handlers, mode: "real" | "mock", logger? }): Promise<FastifyInstance>`. Instancia `OpenAPIBackend({ definition, strict: true, validate: true, ajvOpts: { strict: false } })`; en `init()` fallido, rechaza con el mensaje original. Registra `validationFail` → `problem("validation-failed", { errors: ajvErrors.map(e => ({ pointer: e.instancePath, message: e.message })) , instance })`, `notFound` → 404, `methodNotAllowed` → 405 con header `Allow` (métodos declarados del path), `notImplemented` → 501 (o mock, T041), `unauthorizedHandler` → 401. Envuelve cada handler de `handlers`: construye `TypedRequest` desde el `Context`, invoca, valida con `api.validateResponse(body, operationId, status)`; si inválido, `log.error` con los errores y responde `problem("response-contract-violation")`; si lanza, `log.error` y `problem("internal-error")`. `api.register(...)` con `operationId` inexistente propaga el error (abort). Fastify: `addContentTypeParser` para `application/json` y `application/problem+json`; ruta `all("/*")` que arma `{ method, path, query, body, headers }` y delega en `api.handleRequest`; `setNotFoundHandler` → 404 problem; `setErrorHandler` → 400 problem si `err.code` empieza con `FST_ERR_CTP_` (JSON inválido, content-type), 500 genérico en cualquier otro caso. Toda respuesta de error con `content-type: application/problem+json`.
- [X] T036 [US2] Crear `src/main.ts` (composition root único): lee `PORT` (default 3000), `HOST` (default `127.0.0.1`), `OPE_MOCK` (`"1"` → mode mock), `OPE_CONTRACT` (default `contracts/dist/openapi.yaml`; si no existe, mensaje `Corré npm run contract:bundle` y sale 1); carga el YAML con `yaml`; `handlers = { getHealth: makeGetHealth({ contractVersion: definition.info.version, now: () => new Date() }) }`; `buildServer` → `listen`; ante cualquier error de arranque: log del motivo y `process.exit(1)`. Manejo de `SIGINT`/`SIGTERM` con `app.close()`.
- [X] T037 [US2] Correr `npm run build`, `npm run typecheck` y `npx vitest run tests/unit tests/integration/server.test.ts` → verde. Arrancar `npm run dev` y verificar manualmente los tres `curl` de quickstart §3.

**Checkpoint**: US2 completa: nada se sirve fuera del contrato; `getHealth` responde conforme.

---

## Phase 5: User Story 3 — SDK y portal se desarrollan contra el contrato, sin backend (Priority: P2)

**Goal**: mock desde el contrato con la misma validación que el servidor real; cliente tipado
generado; drift de tipos detectado.

**Independent Test**: `tests/integration/mock.test.ts` y `tests/types/client.test-d.ts` en
verde; `npm run contract:types:check` falla tras editar a mano `src/generated/api.d.ts`.

### Tests for User Story 3

- [X] T038 [P] [US3] Crear `tests/integration/mock.test.ts`: `buildServer({ mode: "mock", handlers: {} })` con el contrato real: `GET /v1/health` → 200 con body **igual** al `value` de `contracts/examples/health-ok.yaml`; `GET /v1/health?x=1` → 400 con el mismo `type` y `errors` que produce el servidor real en `mode: "real"` (comparar ambas respuestas en la misma prueba); `GET /nope` → 404 problem+json.
- [X] T039 [P] [US3] Crear `tests/types/client.test-d.ts`: `createClient<paths>({ baseUrl })` de `src/client/index.ts`; `const { data } = await client.GET("/v1/health")` tipa `data` como `Health | undefined`; `// @ts-expect-error` en `client.GET("/v1/nope")` y en `client.POST("/v1/health")` (SC-007).
- [X] T040 [P] [US3] Crear `tests/unit/contract-types-check.test.ts`: copia `src/generated/api.d.ts` a un temporal, ejecuta `node scripts/contract-types-check.mjs` con env `OPE_TYPES_FILE=<temporal>` (agregar ese override al script si no existe) tras modificarlo → exit 1 con `Tipos generados desactualizados`; sin modificar → exit 0 (US3 escenarios 4 y 5).

### Implementation for User Story 3

- [X] T041 [US3] (implementado dentro de `src/server/build-server.ts`, handler `notImplemented` en `mode: "mock"`; no hizo falta un módulo aparte) Crear `src/server/mock.ts`: `makeMockNotImplemented(api)` que devuelve un handler `notImplemented` que llama `api.mockResponseForOperation(operationId)` y responde `{ status, body: mock }` con `content-type: application/json`; si la operación no tiene ejemplo, responde 501 problem con `detail: "La operación no declara ejemplo"`. Cablearlo en `build-server.ts` cuando `mode === "mock"` (T035 deja el punto de extensión).
- [X] T042 [P] [US3] Crear `src/client/index.ts`: `import createClient from "openapi-fetch"; import type { paths } from "../generated/api.js"; export const createOpeClient = (options: { baseUrl: string; fetch?: typeof fetch }) => createClient<paths>(options); export type { paths, components, operations } from "../generated/api.js";`. Exponer como `"./client"` en `package.json` `exports` (apunta a `dist/client/index.js`).
- [X] T043 [US3] Correr `npm run contract:mock` y verificar los dos `curl` de quickstart §4; correr `npx vitest run tests/integration/mock.test.ts tests/unit/contract-types-check.test.ts` y `npm run typecheck` → verde.

**Checkpoint**: US3 completa: mock y cliente derivan del contrato sin código a mano.

---

## Phase 6: User Story 4 — Cualquiera puede leer el contrato como documentación (Priority: P2)

**Goal**: documentación estática autocontenida desde el bundle; se rehúsa si el contrato no
pasa la verificación.

**Independent Test**: `npm run contract:docs` produce `docs/api/index.html` que contiene
`getHealth`; dos corridas son idénticas; con un contrato inválido el comando falla antes de
escribir.

- [X] T044 [P] [US4] Crear `tests/unit/contract-docs.test.ts`: ejecuta `npm run contract:docs` (`execFile npm` con `shell: true` en Windows) → exit 0 y `docs/api/index.html` contiene `getHealth`, `Estado del servicio`, `application/problem+json` y `2026-09-16T12:00:00Z`; ejecutarlo de nuevo → archivo byte a byte idéntico (SC-006); con env `OPE_CONTRACT_ROOT=tests/contract-rules/fixtures/ope-no-pii.yaml` → exit ≠ 0 y no se escribe `docs/api/index.html` nuevo (FR-032, US4 escenario 2).
- [X] T045 [US4] Definir `contract:docs` en `package.json` como `npm run contract:check && redocly build-docs contracts/dist/openapi.yaml -o docs/api/index.html --config redocly.yaml` (respetando `OPE_CONTRACT_ROOT` en `contract:lint`/`contract:bundle` si T044 lo necesita: los scripts leen `process.env.OPE_CONTRACT_ROOT ?? "contracts/openapi.yaml"`; para eso mover `contract:lint` y `contract:bundle` a `scripts/contract-lint.mjs` y `scripts/contract-bundle.mjs`). Correr T044 → verde.

**Checkpoint**: US4 completa.

---

## Phase 7: User Story 5 — Pruebas automáticas demuestran que el servidor cumple el contrato (Priority: P2)

**Goal**: Schemathesis genera requests desde el bundle contra el servidor levantado y termina
sin fallas; detecta un código de respuesta no declarado.

**Independent Test**: `npm run test:contract` sale 0; con un manejador que responde `203`,
sale ≠ 0 nombrando `GET /v1/health` y `status_code_conformance`.

- [X] T046 [US5] Crear `scripts/test-contract.mjs`: verifica `uvx` disponible (si no, mensaje `Instalá uv: https://docs.astral.sh/uv/` y exit 1); obtiene un puerto libre con `net.createServer().listen(0)` y arranca `node --import tsx src/main.ts` (o `dist/main.js` si existe) con `PORT=<puerto>`; espera hasta 10 s a que `GET /v1/health` responda 200; ejecuta `uvx schemathesis@4 run contracts/dist/openapi.yaml --url http://127.0.0.1:<port> --checks all --phases examples,coverage,fuzzing --max-examples 50 --report junit --report-dir .schemathesis`; mata el servidor (`SIGTERM`, luego `kill` a los 3 s) y propaga el exit code. Para la prueba negativa, `main.ts` acepta `OPE_HANDLERS_MODULE=<ruta>` e importa dinámicamente ese módulo (export `handlers`) en lugar del default; documentarlo como uso exclusivo de pruebas.
- [X] T047 [P] [US5] Crear `tests/contract/fixtures/health-203.ts` exportando `handlers` con un `getHealth` que devuelve `status: 203` (cast a `unknown` para saltar el tipo) y `tests/contract/README.md` explicando `npm run test:contract` y la prueba negativa manual `OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract` → falla con `status_code_conformance`.
- [X] T048 [US5] Agregar `.schemathesis/` a `.gitignore`; correr `npm run test:contract` → exit 0; correr la prueba negativa de T047 → exit ≠ 0 con `GET /v1/health` y `status_code_conformance` en la salida. Anotar ambos resultados en `quickstart.md` → "Estado al cierre".

**Checkpoint**: US5 completa.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T049 [P] Crear `.github/workflows/ci.yml`: `on: [push, pull_request]`; job `ci` en `ubuntu-latest`; `actions/checkout@v4` con `fetch-depth: 0`; `git fetch origin main:refs/remotes/origin/main` (si no es main); `actions/setup-node@v4` con `node-version-file: .nvmrc` y `cache: npm`; `astral-sh/setup-uv@v5` con `enable-cache: true`; `npm ci`; `npm run contract:check`; `npm run build`; `npm run typecheck`; `npm test`; `npm run test:contract`; `timeout-minutes: 10` (FR-060, SC-004).
- [X] T050 [P] Actualizar `CLAUDE.md` → sección "Flujo de trabajo": tabla de comandos (`contract:lint`, `contract:bundle`, `contract:diff`, `contract:types`, `contract:types:check`, `contract:check`, `contract:mock`, `contract:docs`, `build`, `dev`, `test`, `test:contract`, `typecheck`), el orden contrato → `contract:check` → `contract:types` → manejador (`src/handlers/<op>.ts` + registro en `src/main.ts`) → pruebas, y las tres notas operativas: ruleset YAML en estilo bloque, `components` no van en la raíz del contrato, `contracts/rules/pii-denylist.json` es la única lista PII (FR-061).
- [X] T051 [P] Actualizar `README.md`: comandos principales, prerrequisitos (`uv`), ubicación de docs generadas y del cliente (`ope-backend/client`).
- [X] T052 Correr `quickstart.md` completo (§1–§7) y actualizar su tabla "Estado al cierre de la feature" con BUILT/TESTED y la evidencia (comando + resultado + tiempo de `contract:check`).
- [X] T053 Verificar SC-003: `grep -r "Estado del servicio"` fuera de `contracts/` y `docs/api/` no devuelve nada (ningún texto de la operación duplicado); verificar SC-006 con dos corridas de `contract:types` y `contract:docs` (`git status` limpio, `cmp` idéntico).
- [X] T054 Borrar `HANDOFF.md` de la raíz y hacer el commit final de la feature (conventional commit en español).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de Fase 1; bloquea todas las historias (todas leen
  `contracts/` y `src/generated/api.d.ts`).
- **US1 (Fase 3)**: depende de Fase 2. Independiente de las demás.
- **US2 (Fase 4)**: depende de Fase 2 (tipos generados, `problem-details.ts`). Independiente
  de US1 (no necesita las reglas de Spectral para correr).
- **US3 (Fase 5)**: depende de US2 (`buildServer` para el mock) y de Fase 2 (tipos).
- **US4 (Fase 6)**: depende de US1 (`contract:check` debe existir para que `contract:docs`
  lo ejecute antes).
- **US5 (Fase 7)**: depende de US2 (servidor) y de Fase 2 (bundle).
- **Polish (Fase 8)**: depende de todas.

### User Story Dependencies

```
Fase 1 → Fase 2 ─┬→ US1 ──→ US4
                 └→ US2 ─┬→ US3
                         └→ US5
                    todas → Polish
```

### Within Each User Story

- Fixtures y pruebas primero; deben fallar antes de implementar.
- Funciones custom de Spectral (T017–T023) antes del ruleset (T024).
- `handlers.ts` y `health.ts` antes de `build-server.ts`; `build-server.ts` antes de `main.ts`.

### Parallel Opportunities

- Fase 1: T002–T005 en paralelo tras T001.
- Fase 2: T009, T010, T011 en paralelo tras T008.
- US1: T012 y T014 (fixtures) en paralelo; T016–T023 (funciones) todas en paralelo; T026 y
  T027 en paralelo con T024.
- US2: T030–T032 en paralelo; T033 y T034 en paralelo.
- US3: T038–T040 en paralelo; T042 en paralelo con T041.
- US1 y US2 pueden avanzar en paralelo (archivos disjuntos: `contracts/rules/`, `scripts/`
  vs `src/`).
- Polish: T049–T051 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Fixtures de reglas y de compatibilidad, a la vez:
Task: "T012 fixtures en tests/contract-rules/fixtures/"
Task: "T014 fixtures en tests/contract-diff/fixtures/"

# Las siete funciones custom de Spectral, a la vez:
Task: "T017 contracts/rules/functions/noPii.js"
Task: "T018 contracts/rules/functions/noMerchantIdInRequest.js"
Task: "T019 contracts/rules/functions/requestClosedSchema.js"
Task: "T020 contracts/rules/functions/hasExample.js"
Task: "T021 contracts/rules/functions/requiredErrorResponses.js"
Task: "T022 contracts/rules/functions/pathVersionPrefix.js"
Task: "T023 contracts/rules/functions/problemDetailsErrorResponse.js"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Las dos historias P1 son el MVP: sin US1 las reglas son prosa; sin US2 el contrato y el
código divergen. Se pueden construir en paralelo tras la Fase 2.

1. Fase 1 → Fase 2 (contrato en `contracts/`, bundle, tipos, Problem Details).
2. US1 (reglas + diff) y US2 (servidor) → **validar cada una con sus pruebas**.
3. Commit por unidad de trabajo (conventional commits en español), sólo con pruebas verdes.

### Incremental Delivery

4. US3 (mock + cliente) → US5 (Schemathesis) → US4 (docs).
5. Polish: CI, CLAUDE.md, quickstart ejecutado, borrar HANDOFF.md.

---

## Notes

- Los fixtures de reglas deben ser **mínimos**: un contrato de 15–30 líneas que viola una
  sola regla; si un fixture dispara dos reglas, la prueba afirma sólo la esperada pero hay que
  anotar la segunda en el fixture para no confundir a quien lo mantenga.
- `src/generated/api.d.ts` se regenera con `npm run contract:types` cada vez que cambia el
  contrato; nunca a mano.
- Antes de cada commit: `npm run contract:check && npm run typecheck && npm test`.
- Estados: al cerrar cada fase, anotar BUILT/TESTED en quickstart.md sólo con evidencia
  ejecutable.
