# Data model — Feature 006

Sin persistencia ni código de servidor: las entidades son artefactos gobernados del contrato.

## Mapa del contrato (`contracts/api-map.yaml`)

| Sección              | Campo            | Regla                                                                                              |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `consumers.<nombre>` | `securityScheme` | nombre de archivo en `components/securitySchemes/` (sin `.yaml`) o `null` sólo para `public`       |
|                      | `tags`           | subconjunto del catálogo cerrado del ruleset; un tag pertenece a un solo consumidor                |
|                      | `capabilities`   | lista cerrada `recurso:accion`; vacía para `public`                                                |
| `features.<NNN>`     | título           | roadmap; toda operación cita una feature con directorio en `specs/` **o** con entrada acá          |
| `operations[]`       | `operationId`    | único; camelCase; el mismo del contrato si `built`/`deprecated`                                    |
|                      | `method`, `path` | únicos en conjunto; `path` con prefijo `/v<mayor>/`; `{merchantId}` sólo bajo consumidor `admin`   |
|                      | `consumer`       | clave de `consumers`                                                                               |
|                      | `tag`            | uno de `consumers[consumer].tags`                                                                  |
|                      | `capabilities`   | subconjunto de `consumers[consumer].capabilities`; vacío si `public`                               |
|                      | `feature`        | `"NNN"`                                                                                            |
|                      | `status`         | `planned` \| `built` \| `deprecated` \| `retired`                                                  |
|                      | `source`         | `constitucion#X` \| `mvp:archivo#X` \| `ruta/en/el/repo.md#X` (misma verificación que el glosario) |
|                      | `retiredIn`      | obligatorio si `retired`: versión mayor del contrato en que se retiró                              |

Coherencia con el bundle (`check:api-map`):

| Estado       | En el contrato                  | Verificación                                                                                        |
| ------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `planned`    | ausente                         | sólo la forma de la entrada                                                                         |
| `built`      | presente                        | método, ruta, tag, `security` (= esquema del consumidor, o `[]`), `x-required-capabilities` iguales |
| `deprecated` | presente con `deprecated: true` | igual que `built` + la marca                                                                        |
| `retired`    | ausente                         | `retiredIn` presente y ≤ versión mayor actual                                                       |

## Consumidor

`public` \| `sdk` \| `platform` \| `portal` \| `admin`. Determina el esquema de seguridad y el
vocabulario de capacidades. Tabla de esquemas en research R-05.

## Esquema de seguridad (archivo)

Forma mínima verificada: `type` (`apiKey` \| `http`), `in` + `name` si `apiKey`, `scheme` si
`http`, `description` no vacía. Los no usados por ninguna `built` llevan `PROPUESTO` en la
descripción (en inglés en el archivo: `PROPOSED`, que `check:markers` reconoce) y no se
referencian desde la raíz.

## Extensión `x-idempotency` (operaciones `outcomes`)

| Campo           | Regla                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `key`           | nombre de una propiedad **requerida** del schema del request body        |
| `first`         | código 2xx declarado en `responses` (primera recepción)                  |
| `repeat`        | código 2xx declarado, distinto de `first` (misma clave, mismo contenido) |
| `responses.409` | obligatoria, ejemplo con `urn:ope:problem:idempotency-conflict`          |

## Extensión `x-collection` (lecturas de colección)

`true` en toda `GET` con tag `portal` cuya ruta no termina en parámetro. Exige los parámetros
`cursor`, `limit`, `from`, `to` por `$ref` y respuesta `200` con schema `$ref` a `<X>Page`
(`items` array tipado, `nextCursor?` string, `additionalProperties: false`).

## Tipo de problema nuevo

`idempotency-conflict` (409): misma identidad, contenido distinto. Entra al catálogo y a la
réplica de `problem-details.ts` (la prueba de réplica lo exige); sin operación construida que
lo emita hasta la 009.

## Reglas del ruleset

| Regla                                        | Dado                                       | Falla si                                                                                                     |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `ope-consumer-security`                      | toda operación                             | `security` ≠ `[{ esquema del consumidor: [] }]` (o ≠ `[]` para `public`)                                     |
| `ope-required-capabilities` (modificada)     | operación autenticada                      | alguna capacidad fuera del vocabulario del consumidor de su tag                                              |
| `ope-outcomes-idempotency`                   | operación con tag `outcomes`               | falta `x-idempotency`, `key` no es requerida del body, `first`/`repeat` no declarados o iguales, falta `409` |
| `ope-collection-pagination`                  | `GET` con tag `portal` sin parámetro final | falta `x-collection`, faltan parámetros comunes, `200` no es `<X>Page`                                       |
| `ope-no-merchant-id-in-request` (modificada) | todo                                       | `merchantId` en query o body (todos); en ruta salvo consumidor `admin`                                       |
