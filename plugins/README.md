# plugins/ — plugins de Claude Code cuyo fuente vive en este repositorio

Un plugin es un directorio con `.claude-plugin/plugin.json` (nombre, versión semver,
descripción) y sus `skills/`. Vive acá para que las pruebas del repositorio lo ejecuten por su
ruta sin acceso externo (ADR-032, R-02 de la feature 019); no importa nada del repositorio
(`tests/audit/plugin-isolation.test.ts` lo verifica) y se instala en otro proyecto desde este
repo o desde una copia. El marketplace mínimo está en `.claude-plugin/marketplace.json` en la
raíz; este repositorio lo habilita en `.claude/settings.json`. Cuando un plugin madure, extraerlo
a su propio repositorio es mover el directorio y cambiar la fuente del marketplace.

## Inventario

| Entrada                   | Qué es                                                                                                                                                                                                                                   | Fuente o derivado | Quién lo lee                                                        | Verificación                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `auditable-architecture/` | Auditoría de arquitectura por método (`auditing-architecture`, guiada por `audit.profile.json`) y acondicionamiento de un repositorio (`conditioning-project`: inspección, perfil, criterios, doctor). Su README explica la instalación. | fuente            | Claude Code (plugin habilitado); `tests/audit/` lo ejecuta por ruta | `tests/audit/audit.test.ts`, `tests/audit/conditioning.test.ts`, `tests/audit/plugin-isolation.test.ts`, `claude plugin validate` |
