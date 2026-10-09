# El cambio de contrato de la 041

**A quién le habla**: a quien implemente el tramo 1 (el contrato), y a OPE-Web, que lo recibe por
`generated/contract/`. La forma la fija este documento; los largos, el data model.

## 1 · Lo que cambia en `contracts/`

### `contracts/components/schemas/MerchantContact.yaml` (nuevo)

```yaml
type: object
description: The person the merchant relationship is handled with (ADR-045). An identified party of the commercial relationship, never an observed one (constitution VII, 1.5.1); served to the administration only.
additionalProperties: false
required: [name, email]
x-personal-datum:
  - property: name
    reason: The contact is an identified party of the commercial relationship, not an observed person; served only to the admin consumer and never recorded in the log (constitution VII 1.5.1, ADR-045).
  - property: email
    reason: Same as name.
  - property: phone
    reason: Same as name.
properties:
  name:
    type: string
    minLength: 1
    maxLength: 120
  email:
    type: string
    format: email
    minLength: 3
    maxLength: 254
  phone:
    type: string
    minLength: 1
    maxLength: 32
  role:
    type: string
    description: The contact's role at the merchant (e.g. e-commerce manager). Not a personal datum.
    minLength: 1
    maxLength: 80
```

(Las razones se escriben completas en cada entrada; «Same as name» es sólo abreviatura de este
documento. `role` no está en la lista de datos personales y no se excusa.)

### `contracts/components/schemas/MerchantProfileInput.yaml` (nuevo)

```yaml
type: object
description: The identity of a merchant as an operator writes it, whole — a field left out is cleared (ADR-045). Never its origins, status or credentials.
additionalProperties: false
required: [displayName]
x-personal-datum:
  - property: displayName
    reason: The name of the store or its legal entity, not of a person; served to the admin consumer only (ADR-045).
x-invariants:
  - type: invalid-merchant-profile
    status: 422
    rule: a text field has no leading or trailing whitespace; storeUrl parses as an absolute http(s) URL
    pointer: displayName
    description: What the schema cannot say — padding and a URL that only looks like one — is judged by the domain and named by field.
properties:
  displayName:
    type: string
    description: The name of the store or legal entity, as the console lists and heads it.
    minLength: 1
    maxLength: 120
  storeUrl:
    type: string
    description: The canonical URL of the store for a person, kept as written; not an origin.
    pattern: "^https?://"
    minLength: 1
    maxLength: 255
  contact:
    $ref: ./MerchantContact.yaml
  notes:
    type: string
    description: Free text of the operator about the relationship.
    minLength: 1
    maxLength: 2000
```

### `contracts/components/schemas/MerchantCreate.yaml`

Gana las mismas cuatro propiedades, con `displayName` en `required` (`[origins, signature,
displayName]`), la misma marca `x-personal-datum` para `displayName`, y el invariante
`invalid-merchant-profile` junto a los dos que ya tiene. Su descripción dice que el alta trae la
identidad.

### `contracts/components/schemas/Merchant.yaml`

Gana `displayName?`, `storeUrl?`, `contact?` (`$ref: ./MerchantContact.yaml`) y `notes?`, con las
mismas formas, y la marca para `displayName`. `required` no cambia: un merchant de antes se sirve sin
ellos.

### `contracts/paths/admin-merchant-profile.yaml` (nuevo), referenciado como `/v1/admin/merchants/{merchantId}/profile`

```yaml
put:
  operationId: updateMerchantProfile
  tags: [admin]
  security:
    - adminToken: []
  x-required-capabilities: [merchants:write]
  summary: Replace the identity of a merchant
  description: |
    The display name, the store URL, the contact and the operator's notes, whole: a field left out is
    cleared. Origins, status and credentials have operations of their own and are not touched here. A
    merchant outside the operator's scope is refused without revealing whether it exists. Audited.
  parameters:
    - $ref: ../components/parameters/MerchantIdPath.yaml # el que usen hoy las rutas por merchant
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: ../components/schemas/MerchantProfileInput.yaml
        example:
          displayName: Tienda Norte
          storeUrl: https://www.tiendanorte.example
          contact: { name: Ana Pérez, email: ana@tiendanorte.example, role: e-commerce manager }
          notes: Piloto desde octubre; hablar con Ana los martes.
  responses:
    "200":
      description: The merchant as it is now.
      content:
        application/json:
          schema:
            $ref: ../components/schemas/Merchant.yaml
    "400": { $ref: ../components/responses/BadRequest.yaml } # los que usen las demás rutas admin
    "401": { $ref: ../components/responses/OperatorUnauthorized.yaml }
    "403": { $ref: ../components/responses/MerchantOutOfScope.yaml }
    "422": { $ref: ../components/responses/MerchantProfileUnprocessable.yaml } # nuevo, con su ejemplo
    "503": { $ref: ../components/responses/StoreUnavailable.yaml }
    "500": { $ref: ../components/responses/InternalServerError.yaml }
```

(Los nombres de parámetro y de respuestas reutilizables son los que las rutas `admin` por merchant ya
usan; se copian de `admin-merchant-kill-switch.yaml` o la que corresponda.)

### `contracts/components/responses/MerchantProfileUnprocessable.yaml` (nuevo)

Ejemplo con `type: urn:ope:problem:invalid-merchant-profile` y `errors: [{ pointer: /body/storeUrl,
message }]`; `MerchantUnprocessable.yaml` gana el ejemplo de `invalid-merchant-profile` con
`/body/displayName`.

### `contracts/problem-types.yaml`

```yaml
- slug: invalid-merchant-profile
  status: 422
  title: A field of the merchant identity is not what it says it is
```

### `contracts/api-map.yaml`

```yaml
- operationId: updateMerchantProfile
  method: put
  path: /v1/admin/merchants/{merchantId}/profile
  consumer: admin
  tag: admin
  capabilities: [merchants:write]
  feature: "041"
  status: built
  source: specs/041-el-merchant-con-identidad/spec.md
```

### `contracts/rules/functions/noPii.js`

`x-personal-datum` admite un objeto o una lista de objetos `{ property, reason }`; cada uno con razón
no vacía y con la propiedad declarada en ese esquema; una lista vacía falla. Fixtures nuevas:
`ope-no-pii.contact-elsewhere.yaml` (`email` en un esquema de orden → falla),
`ope-no-pii.list-without-reason.yaml` (lista con una entrada sin razón → falla); `valid-admin-path`
gana un esquema con dos propiedades excusadas.

### `contracts/openapi.yaml`

`info.version: 1.13.0` (R-09: `displayName` obligatorio en el alta es incompatible para `contract:diff`
y entra por la marca `building`, reportado); el path nuevo. `contracts/README.md`: la fila de
`x-personal-datum` dice que admite una lista.

## 2 · Lo que el servidor hace

- `createMerchant`: lee `displayName`, `storeUrl`, `contact`, `notes` del cuerpo y los pasa como
  `profile`; `MerchantProfile.of` juzga antes de acuñar; `422 invalid-merchant-profile` con campo.
- `updateMerchantProfile`: `scoped.find` → `MerchantProfile.of` → `withProfile` → `update`; `200`
  con `merchantDto`, que gana los cuatro campos cuando el merchant los tiene.
- `listMerchants` y `getMerchant`: `merchantDto` los trae; nada más cambia.
- Semilla: `MerchantSeed` los admite.

## 3 · Lo que llega a `generated/contract/`

`CONSTRAINTS` gana `MerchantContact` y `MerchantProfileInput`, y `MerchantCreate` gana los cuatro
campos (`contact` como `{ type: 'object', ref: 'MerchantContact' }`). `OPERATIONS` gana
`updateMerchantProfile` con `['merchants:write']`, `idempotent: false`. `conformity` de OPE-Web pasa
sin cambio.
