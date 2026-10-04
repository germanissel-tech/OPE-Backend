# Superficie HTTP — Los textos se editan por API

Fase 1 del plan. Lo que entra al mapa del contrato como `planned` y pasa a `built` al construirse
(`.claude/rules/contrato.md`, paso 0). Seis operaciones del consumidor `admin`, tres por capa.

## Capacidades nuevas del consumidor `admin`

`texts:read` y `texts:write`. Un texto es tratamiento pero no es configuración: quien redacta prosa no es
necesariamente quien publica políticas.

## Las operaciones

| operationId                | Método y ruta                                                                     | Capacidad     | Qué hace                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `publishText`              | `POST /v1/admin/texts`                                                            | `texts:write` | Publica el texto base de una clave e idioma; `201` creada, `200` repetida                         |
| `listTextVersions`         | `GET /v1/admin/texts/{family}/{locale}/versions`                                  | `texts:read`  | Las versiones de la clave base, más nueva primero, paginadas                                      |
| `getTextVersion`           | `GET /v1/admin/texts/{family}/{locale}/versions/{version}`                        | `texts:read`  | Una versión concreta tal como se publicó                                                          |
| `publishMerchantText`      | `POST /v1/admin/merchants/{merchantId}/texts`                                     | `texts:write` | Publica el texto del merchant de una clave e idioma, o lo **quita** (`text: null`); `201` / `200` |
| `listMerchantTextVersions` | `GET /v1/admin/merchants/{merchantId}/texts/{family}/{locale}/versions`           | `texts:read`  | Las versiones de la clave del merchant                                                            |
| `getMerchantTextVersion`   | `GET /v1/admin/merchants/{merchantId}/texts/{family}/{locale}/versions/{version}` | `texts:read`  | Una versión concreta del merchant                                                                 |

El valor de atributo va **en el cuerpo** al publicar y como **parámetro de consulta** `attributeValue` al
leer: es opcional y una ruta con un segmento opcional no existe. El `merchantId` en la ruta sólo bajo
`admin` (constitución V, ADR-020).

**Alcance del operador**: la base exige alcance total (`operator-scope-too-narrow`, como los niveles); la
capa del merchant, alcance sobre ese merchant (`merchant-out-of-scope`, como toda operación de merchant).

**Auditoría**: las tres publicaciones quedan auditadas por construcción (toda operación de `admin` que no
es sólo lectura); nada que declarar.

**Idempotencia**: `x-idempotency` con clave `text`, `first: "201"`, `repeat: "200"`, como la publicación
de la configuración de merchant. Para la capa del merchant, quitar lo que ya está quitado repite.

## Los esquemas

- `TextInput`: `family`, `attributeValue?`, `locale`, `text` (1 a 512 caracteres), `corrective`,
  `reason?`. `additionalProperties: false`.
- `MerchantTextInput`: lo mismo con `text` **nullable**: `null` quita.
- `TextVersion`: `family`, `attributeValue?`, `locale`, `layer` (`base` o el merchant), `version`,
  `messageVersionId` (el identificador que una intervención estampa), `text?` (ausente cuando la versión
  dice «quitado»), `removed`, `publishedAt`, `operatorId`, `corrective`, `reason?`.
- `TextVersionPage`: `items`, `nextCursor?`, con los parámetros de paginación por `$ref`.
- `PublishedText`: la versión y `outcome` (`created` | `repeated`).

## Invariantes y tipos de problema

| Slug                                                                       | Status | Dónde                                                      | Regla                                                                                    |
| -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `text-key-unknown`                                                         | 422    | las dos publicaciones                                      | La familia o el valor de atributo no están en el vocabulario de OPE, o no van juntos     |
| `base-text-required`                                                       | 422    | `publishText`                                              | La base no admite quitar: tiene que seguir completa                                      |
| `locale-incomplete`                                                        | 422    | `publishTreatmentDefaults`, `publishMerchantConfiguration` | Un idioma que entra como soportado o reserva no tiene base completa; nombra las familias |
| `configuration-frozen`                                                     | 409    | las dos publicaciones (existe)                             | Experimentos activos alcanzados y sin motivo                                             |
| `corpus-text-empty`, `corpus-text-too-long`, `corpus-text-has-placeholder` | 422    | las dos publicaciones (existen)                            | El texto en sí                                                                           |

Cada `422` nombra en su ejemplo la invariante que la produce (ADR-007); `x-invariants` sobre la operación
cuando depende de otro recurso (`locale-incomplete`, `configuration-frozen`) y sobre el esquema cuando
sólo involucra sus campos.

## Lo que se retira o cambia

- `components/schemas/Voice.yaml` se retira: ningún `$ref` lo nombra.
- `Intervention.messageVersionId` sube su `maxLength` para la clave entera; sin patrón, como hoy.
- Las dos operaciones de publicación de idiomas de la 036 ganan `locale-incomplete` en sus `422`.
- `info.version`: bump MINOR, con el contrato marcado `building`; `contract:diff` lo reporta.

## Lo que no cambia

`getSdkConfig`, `Intervention` en su forma, `Locales`, y toda operación del SDK y de la plataforma.
