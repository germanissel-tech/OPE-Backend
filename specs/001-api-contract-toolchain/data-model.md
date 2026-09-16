# Data model — Feature 001

No hay persistencia. Las "entidades" son artefactos del contrato y estructuras del servidor.
El detalle de cada esquema HTTP está en [contracts/](contracts/); acá se listan campos,
reglas y relaciones sin duplicar YAML.

## Entidades del contrato

### Contrato (`contracts/`)

| Campo | Regla |
|---|---|
| `openapi` | `3.1.0` |
| `info.version` | semver `MAJOR.MINOR.PATCH`; MAJOR debe coincidir con el prefijo de todo path (`/v{MAJOR}/`) |
| `tags[]` | catálogo cerrado; hoy `[system]`; cada operación usa exactamente uno |
| `paths` | `$ref` a `paths/*.yaml`; una operación por método; `operationId` único y camelCase |
| `components` | `$ref` a `components/{schemas,responses,parameters,securitySchemes}/*.yaml` |
| `webhooks` | vacío en esta feature |

Relaciones: Contrato 1—N Operación; Operación 1—1 Tag; Operación 1—N Respuesta; Respuesta de
error 1—1 ProblemDetails.

### Contrato empaquetado (`contracts/dist/openapi.yaml`)

Derivado, no commiteado. Entrada de tipos, docs, diff y Schemathesis. Se produce sólo si el
lint pasa.

### Regla de verificación

| Campo | Valor |
|---|---|
| `id` | `ope-<kebab>` para reglas propias; ids de `spectral:oas` para las heredadas |
| `severity` | siempre `error` |
| `message` | incluye qué está mal y cómo corregirlo (FR-021) |
| `given` / `then` | JSONPath + función built-in o custom |
| fixture | `tests/contract-rules/fixtures/<id>.yaml`, contrato mínimo que viola sólo esa regla |

Reglas propias de esta feature (ids definitivos):
`ope-operation-id-camel-case`, `ope-operation-summary`, `ope-operation-single-tag`,
`ope-tags-closed-catalog`, `ope-property-description`, `ope-request-example`,
`ope-success-response-example`, `ope-request-closed-schema`, `ope-no-pii`,
`ope-no-merchant-id-in-request`, `ope-error-response-problem-details`,
`ope-required-error-responses`, `ope-path-version-prefix`.

### Lista de datos personales prohibidos (`contracts/rules/pii-denylist.json`)

Array de strings, comparación sin distinguir mayúsculas contra nombres de propiedades,
parámetros y headers. Valor inicial:
`email, name, firstName, lastName, phone, address, document, dni, ip, ipAddress, card, cardNumber, password`.
Ampliable sin tocar reglas. Sin excepciones activas en esta feature.

### Catálogo de tipos de problema (`contracts/problem-types.yaml`)

| slug | `type` | status | título |
|---|---|---|---|
| `validation-failed` | `urn:ope:problem:validation-failed` | 400 | El request no cumple el contrato |
| `unauthorized` | `urn:ope:problem:unauthorized` | 401 | Credencial ausente o inválida |
| `not-found` | `urn:ope:problem:not-found` | 404 | Ruta no declarada en el contrato |
| `method-not-allowed` | `urn:ope:problem:method-not-allowed` | 405 | Método no declarado para la ruta |
| `unprocessable` | `urn:ope:problem:unprocessable` | 422 | Request válido rechazado por semántica |
| `internal-error` | `urn:ope:problem:internal-error` | 500 | Error interno |
| `response-contract-violation` | `urn:ope:problem:response-contract-violation` | 500 | La respuesta del manejador no cumple el contrato |
| `not-implemented` | `urn:ope:problem:not-implemented` | 501 | Operación declarada sin manejador |

Invariante (probada): todo `type` que emite el servidor pertenece a este catálogo.

## Esquemas HTTP

### `Health` (respuesta de `getHealth`)

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `status` | `string` enum `ok \| degraded` | sí | `degraded` reservado para cuando existan dependencias (Redis/Postgres); hoy siempre `ok` |
| `contractVersion` | `string` (semver) | sí | igual a `info.version` del contrato cargado |
| `timestamp` | `string` `date-time` | sí | UTC, instante de la respuesta |

`additionalProperties: false`.

### `ProblemDetails` (RFC 9457)

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `type` | `string` URI | sí | del catálogo; `about:blank` no se usa |
| `title` | `string` | sí | fijo por `type` |
| `status` | `integer` 400–599 | sí | igual al código HTTP |
| `detail` | `string` | no | legible, sin datos internos (sin stack, sin mensajes de excepción) |
| `instance` | `string` URI-reference | no | path del request |
| `errors` | `array<ValidationError>` | no | sólo en 400/422 |

`ValidationError`: `pointer` (JSON Pointer relativo al request: `/query/foo`, `/body/kind`),
`message` (string). `additionalProperties: false` en ambos.

## Estructuras del servidor (TypeScript, no HTTP)

### `Handlers`

```
type Handlers = Partial<{ [Op in keyof operations]: Handler<Op> }>
type Handler<Op> = (req: TypedRequest<Op>) => Promise<TypedResponse<Op>>
type TypedResponse<Op> = union sobre los status declarados de { status: S; body: Body<Op, S> }
```

`operations` proviene de `src/generated/api.d.ts`. Un manejador con `status` o `body` fuera
del union no compila (FR-046). `Partial` porque una operación sin manejador debe responder
`501` en runtime (FR-044), no fallar la compilación.

### `ServerMode`

`'real' | 'mock'`. En `mock`, `handlers` se ignora y `notImplemented` devuelve el ejemplo del
contrato para la operación.

### Ciclo de vida

```
config (main.ts) → loadDefinition → buildServer → api.init (falla ⇒ abort) →
api.register(handlers) (operationId desconocido ⇒ abort) → listen
```

No hay estado global ni por merchant.
