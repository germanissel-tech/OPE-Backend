# Data model — fase 1 (041)

Lo que cambia de forma. Los tipos del contrato no se escriben: salen del bundle; acá se nombra qué
gana cada cosa y qué regla lo juzga.

## La identidad del merchant

```
MerchantProfileRecord {
  displayName?: string          nombre de la tienda o razón social
  storeUrl?: string             URL absoluta http(s), como se escribió
  contact?: MerchantContactRecord
  notes?: string                texto libre del operador
}

MerchantContactRecord {
  name: string
  email: string
  phone?: string
  role?: string
}
```

`MerchantProfile` es una **clase** (hay reglas, ADR-024): `private constructor`, `of(record)` que
devuelve `Result<MerchantProfile, InvalidMerchantProfile>`, `rehydrate(record)` que no re-juzga,
`record()`. Reglas de `of`, en el orden en que se juzgan, cada una con el campo que señala:

| regla                                                                  | campo señalado (`details.pointer`) |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `displayName`, si viene, sin espacios en los bordes y no vacío         | `displayName`                      |
| `storeUrl`, si viene, parseable como URL absoluta `http` o `https`     | `storeUrl`                         |
| `contact.name`, si hay contacto, sin espacios en los bordes y no vacío | `contact.name`                     |
| `contact.email`, si hay contacto, sin espacios en los bordes           | `contact.email`                    |
| `notes`, si viene, no vacío (ausente es la forma de «sin notas»)       | `notes`                            |

Los largos máximos, el formato del email y el prefijo de la URL los expresa el **esquema** y los
rechaza el validador con `400` (R-04); el dominio no los repite. Las constantes de largo viven en el
contrato, no en el código: el dominio no las conoce.

`InvalidMerchantProfile(field)`: `code = "invalid-merchant-profile"`, módulo `merchant`, `details:
{ pointer }`, `status 422` en `contracts/problem-types.yaml`.

## El merchant, con identidad

```
MerchantRecord {
  merchantId, status, origins, credentials, createdAt     (sin cambio)
  profile?: MerchantProfileRecord                         NUEVO · ausente en los documentos viejos
}

MerchantInput (of) {
  ... (sin cambio)
  profile?: MerchantProfile                               ya juzgado por MerchantProfile.of
}
```

- `Merchant.of(input)`: acepta `profile` opcional; no lo re-juzga (llega como clase).
- `Merchant.withProfile(profile: MerchantProfile): Merchant`: el mismo merchant con la identidad
  reemplazada entera. **No falla** y **no mira el estado**: un merchant desactivado la admite.
- `Merchant.rehydrate(record)`: `profile` se rehidrata con `MerchantProfile.rehydrate` en el
  constructor (toda clase anidada se rehidrata, regla de `gateway-durable.md`); ausente queda
  ausente.
- `Merchant.record()`: incluye `profile` sólo si lo hay.

Lo que **no** cambia: `rotated`, `switched`, `deactivated`, `allowsOrigin`, `owns*`, las reglas de
credenciales y orígenes.

## La semilla

```
MerchantSeed {
  merchantId, ingestKeys, origins, platformKeys, platformSecrets     (sin cambio)
  displayName?, storeUrl?, contact?, notes?                          NUEVO · mismas reglas
}
```

`ImportMerchantsUseCase` construye `MerchantProfile.of(...)` cuando la semilla trae alguno de los
cuatro, y la falla es un `MerchantError` como las demás de la semilla (`seed-errors.ts` la nombra con
su campo). `config/schemas/merchants-seed.schema.json` los admite con los mismos largos que el
contrato (a mano, como el resto de ese esquema).

## El caso de uso

```
UpdateMerchantProfileRequest  { actor: Operator; merchantId: MerchantId; profile: MerchantProfileRecord }
UpdateMerchantProfileResponse Result<Merchant, InvalidMerchantProfile | MerchantOutOfScope | MerchantNotFound | StoreUnavailable>
UpdateMerchantProfileDependencies { scoped: ScopedMerchantService; merchants: MerchantStore }
```

Orden: `scoped.find(actor, merchantId)` (alcance y existencia, `403` sin revelar) → `MerchantProfile.of`
(`422` con campo) → `merchant.withProfile` → `merchants.update`. Dos dependencias, interfaces; sin
`throw`; cada error devuelto.

`CreateMerchantRequest` gana `profile: MerchantProfileRecord` (con `displayName` presente, porque el
esquema lo exige); el caso de uso lo juzga con `MerchantProfile.of` **antes** de acuñar nada, y lo
pasa a `Merchant.of`.

## Lo que el contrato lee y escribe

| esquema                | qué                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Merchant`             | gana `displayName?`, `storeUrl?`, `contact?` (`$ref MerchantContact`), `notes?`                             |
| `MerchantCreate`       | gana `displayName` (**required**), `storeUrl?`, `contact?`, `notes?`; invariante `invalid-merchant-profile` |
| `MerchantProfileInput` | NUEVO: `displayName` (required), `storeUrl?`, `contact?`, `notes?`; el mismo invariante                     |
| `MerchantContact`      | NUEVO: `name`, `email` (required), `phone?`, `role?`; `x-personal-datum` para `name`, `email`, `phone`      |

Largos y formas (del contrato; topes de formulario, no políticas):

| campo           | tipo y forma                          |
| --------------- | ------------------------------------- |
| `displayName`   | string, 1..120                        |
| `storeUrl`      | string, 1..255, `pattern: ^https?://` |
| `contact.name`  | string, 1..120                        |
| `contact.email` | string, 3..254, `format: email`       |
| `contact.phone` | string, 1..32                         |
| `contact.role`  | string, 1..80                         |
| `notes`         | string, 1..2000                       |

## El registro de administración

Sin cambio de forma. `updateMerchantProfile` deja `{ at, operatorId, operation:
"updateMerchantProfile", merchantId, outcome, code? }` y nada más; `createMerchant` sigue dejando lo
que dejaba (su lector de `merchantId`).

## Lo que ve cada consumidor

| consumidor                            | ve de la identidad                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `admin`                               | todo, en `Merchant` (lista y ficha) y en la respuesta del alta y de la edición |
| `sdk`, `platform`, `public`, `portal` | nada: ningún esquema suyo la lleva, y el lint lo verifica                      |
