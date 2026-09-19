# Configuración por merchant que agrega la 013 (`OPE_MERCHANTS[i]`)

| Campo             | Tipo       | Regla                                                                             |
| ----------------- | ---------- | --------------------------------------------------------------------------------- |
| `platformSecrets` | `string[]` | opcional; 1 o 2 (rotación); no vacíos; distintos de `ingestKeys` y `platformKeys` |

Inválido ⇒ `ConfigError` `merchants[i].platformSecrets` (`invalid-platform-secret`); el
servidor no arranca. Con el campo presente, toda operación de plataforma del merchant exige
firma (ver [platform-signature.md](platform-signature.md)).
