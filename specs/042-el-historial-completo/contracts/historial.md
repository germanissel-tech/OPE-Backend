# El cambio de contrato (042)

Contrato `1.13.0 → 1.14.0`, menor (research R-07). Nada que `contract:diff` marque como incompatible.

## 1 · `api-map.yaml`, antes que nada

```yaml
- operationId: getMerchantConfigurationVersion
  method: get
  path: /v1/admin/merchants/{merchantId}/configuration/versions/{version}
  consumer: admin
  tag: admin
  capabilities: [configuration:read]
  status: planned # built, con feature: "042" en lugar de roadmap, al terminar
  roadmap: admin-panel
  source: specs/042-el-historial-completo/spec.md
```

## 2 · La operación nueva

`contracts/paths/admin-configuration-version.yaml`, referenciado desde `openapi.yaml`:

- `GET`, `security: adminToken`, `x-required-capabilities: [configuration:read]`.
- Parámetros: `merchantId` (el componente existente) y `version` (`integer`, `minimum: 1`, como en
  `admin-platform-configuration-version.yaml`).
- `200`: `MerchantConfigurationVersion`, con un ejemplo de una correctiva que reinició un experimento.
- `400`, `401`, `403` (`MerchantForbidden`: fuera de alcance, sin revelar), `404`
  (`ConfigurationVersionNotFound`), con los componentes de respuesta existentes.
- Descripción: una versión de la configuración del merchant por su número, lo mismo que trae la página
  del historial. El merchant va en la ruta por ser `admin` (constitución V, ADR-020).

## 3 · `MerchantConfigurationVersion` gana `windowsRestarted`

Opcional, la misma definición que en `PlatformConfigurationVersion` (`uniqueItems`, `ExperimentId`). La
descripción dice que lo trae la publicación y **toda** lectura, y que falta cuando la versión no reinició
nada.

## 4 · La descripción de `windowsRestarted` en los otros tres

En `PlatformConfigurationVersion`, `TreatmentDefaultsVersion` y `TextVersion`, la descripción pasa a
decir lo que hoy calla: **toda lectura** de la versión lo trae (la publicación, su repetición, el
historial y la versión por número), y una versión publicada antes de la 036 (o la 038, para textos) lo
trae sólo si el reinicio quedó registrado. Es texto, no forma: compatible.

## 5 · Lo que el servidor hace

| operación                                                                     | antes                                       | después                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| `publishPlatformConfiguration`, `publishTreatmentDefaults`, publicar un texto | `201` con la lista; `200` repetido sin ella | `201` y `200` con la lista de esa versión |
| `publishMerchantConfiguration`                                                | sin el campo                                | con la lista, igual que las globales      |
| `list…Versions` (cinco) y `get…Version` (cuatro)                              | sin el campo                                | con la lista de cada versión              |
| `getMerchantConfigurationVersion`                                             | no existía                                  | la versión por número                     |
