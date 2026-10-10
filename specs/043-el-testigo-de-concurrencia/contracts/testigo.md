# El cambio de contrato (043)

Contrato `1.14.0 → 1.15.0`. **Incompatible** para `contract:diff` —un encabezado requerido en cuatro
operaciones— y entra por `info.x-stability: building` (ADR-003, research R-09). Ninguna operación nueva,
así que `api-map.yaml` no cambia.

## 1 · El catálogo de problemas

```yaml
- slug: stale-version
  status: 412
  title: The resource changed since it was read
- slug: witness-required
  status: 428
  title: The write needs the witness of the resource it replaces
```

## 2 · El parámetro

`contracts/components/parameters/If-Match.yaml` (NUEVO):

```yaml
name: If-Match
in: header
required: true
x-when-missing: witness-required
description: "The witness of the resource as it was read: the ETag of its last read. A write that replaces
  what it read is accepted only if nobody wrote it since (ADR-046). Missing: 428 witness-required, without
  the current witness. Any other value —another resource's, an old one, `*`, several, a weak one— is
  412 stale-version."
schema:
  type: string
```

La extensión `x-when-missing` gana su fila en `contracts/README.md`: dónde (un parámetro), forma (un slug
del catálogo), regla (sólo en un parámetro requerido; el slug existe), consumidor (`validationFail`).

## 3 · Las cuatro operaciones protegidas

`publishMerchantConfiguration`, `publishPlatformConfiguration`, `publishTreatmentDefaults`,
`updateMerchantProfile`:

- `parameters`: `$ref` al `If-Match`.
- Respuestas nuevas: `412` (`StaleVersion.yaml`) y `428` (`WitnessRequired.yaml`), con su ejemplo.
- `x-invariants` sobre la operación: `stale-version` (`412`), con su regla y su prueba
  `[invariant:stale-version]`. `witness-required` no es un invariante: es la forma del pedido, y lo prueba
  la del parámetro.
- La descripción dice que la escritura **reemplaza** el recurso entero (FR-008): en la configuración, lo
  ausente de `declared` se hereda y lo ausente de `content` es un error de forma; en la identidad, lo ausente
  queda vacío (ya lo decía la 041). Y que un cuerpo idéntico a lo que rige responde como hoy, con cualquier
  testigo.
- `201` y `200` declaran el encabezado `ETag`.

## 4 · El testigo en las respuestas

`components/headers/ETag.yaml` (NUEVO): «The witness of the resource as this response leaves it, to send
back in `If-Match`.» Lo declaran:

| operación                                                                                     | respuesta                 |
| --------------------------------------------------------------------------------------------- | ------------------------- |
| `getPlatformConfiguration`, `getTreatmentDefaults`, `getMerchantConfiguration`, `getMerchant` | `200`                     |
| las tres publicaciones                                                                        | `201`, `200`              |
| `updateMerchantProfile`, `setKillSwitch`, `deactivateMerchant`                                | `200`                     |
| `createMerchant`                                                                              | `201`                     |
| `rotateIngestKey`, `rotatePlatformKey`, `rotatePlatformSecret`                                | `201` (o la que declaren) |

## 5 · Lo que el servidor hace

| caso                                             | respuesta                                          |
| ------------------------------------------------ | -------------------------------------------------- |
| testigo que coincide                             | como hoy, con el `ETag` nuevo                      |
| cuerpo idéntico a lo que rige, cualquier testigo | `200` con la versión que rige y su `ETag` (FR-005) |
| testigo que no coincide                          | `412 stale-version`, nada escrito                  |
| sin `If-Match`                                   | `428 witness-required`, sin `ETag`, nada escrito   |
| merchant fuera de alcance                        | `403` como hoy, antes de mirar el testigo          |
