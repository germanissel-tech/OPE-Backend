# El cambio de contrato de la 040, y los artefactos que emite

**A quién le habla**: a quien implemente el tramo 1 (el contrato) y el tramo 3 (el emisor), y a
OPE-Web, que es quien consume lo emitido. La forma de los artefactos **no se decide acá**: se
reproduce de `specs/005-la-base-de-ope/contracts/contract-artifact.md` y
`specs/006-el-merchant-completo/contracts/constraints-artifact.md` de OPE-Web, que son la fuente.

## 1 · Lo que cambia en `contracts/`

### `contracts/paths/admin-operator.yaml` (nuevo), referenciado desde `openapi.yaml` como `/v1/admin/operator`

```yaml
get:
  operationId: getOperator
  tags: [admin]
  security:
    - adminToken: []
  x-required-capabilities: []
  x-identifies-principal: true
  summary: Who the authenticated operator is
  description: |
    The operator the credential belongs to: its identifier, its display name when configured, and
    its scope (ADR-031). Any valid credential may ask; identifying oneself demands no capability.
    Reading it is not logged.
  responses:
    "200":
      description: The authenticated operator.
      content:
        application/json:
          schema:
            $ref: ../components/schemas/Operator.yaml
          example:
            operatorId: ops-1
            displayName: Ana
            scope: "*"
    "401":
      $ref: ../components/responses/OperatorUnauthorized.yaml
    "500":
      $ref: ../components/responses/InternalServerError.yaml
```

### `contracts/components/schemas/Operator.yaml` (nuevo)

```yaml
type: object
description: The operator behind an admin credential (ADR-031); displayName is the only personal name the contract carries, served only to the operator it names (constitution VII, 1.5.0).
additionalProperties: false
required: [operatorId, scope]
properties:
  operatorId:
    $ref: ./OperatorId.yaml
  displayName:
    type: string
    description: The name the operator sees in the panel; never an identifier, never audited.
    minLength: 1
    maxLength: 80
  scope:
    description: Which merchants the operator reaches, as configured.
    oneOf:
      - type: string
        enum: ["*"]
      - type: array
        minItems: 1
        items:
          $ref: ./MerchantId.yaml
```

(Si `OperatorId.yaml` o `MerchantId.yaml` no existen como archivo, se referencia el esquema donde
viva hoy: el bundle ya tiene `OperatorId` y `MerchantId`.)

### `contracts/components/schemas/ProblemDetails.yaml`

Gana, como propiedad opcional:

```yaml
requestId:
  type: string
  description: The identifier the server minted for this request, also in the X-Request-Id header of every response; quote it when reporting.
```

Y la descripción de `errors[].pointer` no cambia: ya dice `/body/kind`.

### `x-invariants` de esquema: el campo `pointer`

```yaml
x-invariants:
  - type: origin-already-registered
    status: 422
    rule: no origin belongs to another merchant (deactivated ones included)
    pointer: origins[N]
    description: ...
```

`pointer` es un camino relativo al cuerpo; `[N]` significa «el elemento que la regla señala». El
servidor publica `/body/origins/1`. En esta feature: `invalid-origin` y `origin-already-registered`
(`MerchantCreate.yaml`, `origins[N]`), `rotation-grace-too-long` (`CredentialRotation.yaml`,
`graceSeconds`), `configuration-reason-required` (`reason`, en los cuatro esquemas que lo declaran).

### Los ejemplos de `422` que muestran `errors[]`

`RotationUnprocessable.yaml` (`/graceSeconds` → `/body/graceSeconds`), `MerchantUnprocessable.yaml`
(`invalid-origin` ya muestra `/origins/0` → `/body/origins/0`; `origin-already-registered` gana su
`errors[]`), y cualquier otro ejemplo con un puntero sin `/body`.

### `contracts/api-map.yaml`

```yaml
getOperator:
  status: built
  consumer: admin
  tag: admin
  capabilities: []
  feature: "040"
  source: specs/040-el-contrato-para-consumidores/spec.md
```

(con los campos que el mapa use hoy para una entrada `built`; la forma exacta la fija `check:api-map`.)

### `contracts/.spectral.yaml` y sus funciones

- `ope-required-capabilities`: admite `x-required-capabilities: []` **sólo** con
  `x-identifies-principal: true`, y la marca sólo en una operación autenticada. Fixtures:
  `ope-required-capabilities.identifies-empty.yaml` (lista vacía sin marca → falla) y
  `ope-required-capabilities.identifies-public.yaml` (marca en una pública → falla); `valid-capabilities`
  gana una operación con marca y lista vacía.
- `ope-no-pii`: `displayName` entra a `pii-denylist.json`; `functionOptions.allow` lleva
  `{ path: "components.schemas.Operator.properties.displayName", reason: "..." }`. Fixtures:
  `ope-no-pii.display-name.yaml` (en otro esquema → falla); `valid-admin-path` o uno nuevo con el
  esquema del operador → pasa.
- `ope-invariants`: `pointer` opcional, string, sólo en invariantes de esquema (no bajo una
  operación). Fixture: `ope-invariants.pointer-on-operation.yaml`.

### `contracts/openapi.yaml`

`info.version: 1.12.0`; el path nuevo. `contracts/README.md`: las filas de `x-identifies-principal`
y del campo `pointer`.

## 2 · Lo que el servidor emite

### `X-Request-Id` y `requestId`

- Hook de transporte en `build-server.ts`: `reply.header("x-request-id", request.id)` al recibir el
  pedido (antes de cualquier handler, para que un error del framework también lo lleve).
- `send()` en `http-response.ts`: si el cuerpo es un Problem Details, `body.requestId = request.id`.
- `Fastify({ requestIdHeader: false })`: el identificador es del servidor.

### `errors[]` con `/body`

`toProblem`: `pointer` publicado como `/body` + `jsonPointerOf(details.pointer)`. Los errores de dominio
que ganan `pointer`: `OriginAlreadyRegistered(index)` y `InvalidOrigin(index)` → `origins[${index}]`;
`RotationGraceTooLong` → `graceSeconds`.

## 3 · Los artefactos (`generated/contract/`)

La forma es la de los dos documentos de OPE-Web. Lo que esta feature fija además:

| archivo                          | de dónde sale                                                                                                            | determinismo              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `openapi.yaml`                   | copia del bundle (`contracts/dist/openapi.yaml`)                                                                         | el bundle es determinista |
| `api.d.ts`, `problem-types.d.ts` | copia de `generated/api.d.ts` y `generated/problem-types.d.ts`                                                           | ídem                      |
| `capabilities.{js,d.ts}`         | operaciones con tag `admin` en el orden del bundle; `idempotent` = `'x-idempotency' in op`; vocabulario = unión ordenada | ídem                      |
| `constraints.{js,d.ts}`          | esquemas objeto referenciados por `requestBody` de operaciones `admin`, transitivamente; claves ordenadas por nombre     | ídem                      |
| `identity.json`                  | `{ "$comment", "version", "sha256" }` — **sin commit**                                                                   | ídem                      |

Cabecera de todos: `GENERATED by scripts/contract-consumer-artifacts-lib.mjs — DO NOT EDIT BY HAND.
Regenerate with: npm run contract:types` (en JSON, en `$comment`).

**Lo que OPE-Web tiene que aceptar, y es una línea**: su `conformity` exige hoy que toda operación del
módulo tenga al menos una capacidad; con `getOperator` emitida con `[]`, admite la lista vacía cuando
el bundle marca la operación con `x-identifies-principal`. Es un cambio en OPE-Web, fuera de esta
feature, que se hace al verificar SC-001.
