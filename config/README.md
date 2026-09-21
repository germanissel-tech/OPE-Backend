# config/ — la configuración que el servidor lee al arrancar

Ninguna política vive en el código (constitución XI, ADR-031): todo valor que gobierna el
comportamiento es configuración en tres niveles. Los dos primeros **viajan con el release** y
están acá: el nivel de plataforma (`platform.json`) y los defaults de tratamiento
(`treatment-defaults.json`). El tercero —la versión de configuración de cada merchant— no es un
archivo: lo publica un operador por la API de administración y vive en el store. Los otros dos
archivos de este directorio son **sólo de desarrollo**: la semilla de merchants y los operadores
que `npm run dev` carga; en cualquier otro entorno los nombra la variable de entorno o no existen.

Todo lo que hay acá es **fuente**: se edita a mano y se commitea. Cambiar un archivo del release
es un deploy, no una operación; nada de lo que un operador hace a un merchant (crear, rotar,
apagar, dar de baja, publicar configuración) requiere tocar este directorio ni reiniciar.

## Inventario

| Entrada                   | Qué es                                                                                                                                                                                                                                                                                                  | Fuente o derivado | Quién lo lee                                                                                                                                                                 | Verificación                                                                                                                          | Variable de entorno                                       | Cuándo se lee                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `platform.json`           | Nivel 1: reglas globales del despliegue que ningún merchant sobrescribe (ventana de deduplicación, tolerancias de reloj, memoria de sesión y visitante, ventana de firma, gracia de rotación, tope de diagnósticos, `Retry-After`).                                                                     | fuente            | `composition/levels-config.ts` → `readPlatformConfiguration` (aplicación) → `PlatformConfiguration.of` (dominio); se publica por `GET /v1/admin/platform-configuration`      | `contract:check` (esquema `PlatformConfiguration` del contrato); `check:behaviour-constants` vigila que ningún valor vuelva al código | `OPE_PLATFORM_CONFIG` (ruta de otro archivo)              | Al arrancar, siempre; sin él el servidor no levanta                                                             |
| `treatment-defaults.json` | Nivel 2: lo que rige para todo merchant que no declaró el valor (frescura, nivel de sincronización, holdout, políticas de decisión y comercial, perfil de evidencia, superficies, barreras, estrategia de sincronización, idiomas). Es parte del tratamiento: su `version` se estampa en cada decisión. | fuente            | `composition/levels-config.ts` → `readTreatmentDefaults` → `TreatmentDefaults.of`; se publica por `GET /v1/admin/treatment-defaults`                                         | `contract:check` (esquema `TreatmentDefaults`); una prueba verifica que cada valor resuelve al vocabulario del código                 | `OPE_TREATMENT_DEFAULTS` (ruta de otro archivo)           | Al arrancar, siempre                                                                                            |
| `dev-merchants.json`      | Semilla de merchants para desarrollo: claves crudas (el import las huellea), orígenes, experimentos, y lo que `MerchantConfigurationDeclared` admite (se publica como versión 1 del merchant).                                                                                                          | fuente            | `composition/merchants-config.ts` y `experiments-config.ts` → `ImportMerchantsUseCase`, `ImportExperimentsUseCase`, `ImportMerchantConfigurationUseCase` (operador `system`) | La forma en composición; las reglas en `Merchant.of`, `Experiment` y el lector de configuración declarada                             | `OPE_MERCHANTS` (JSON en línea) o `OPE_MERCHANTS_FILE`    | Sólo cuando la variable lo nombra (`npm run dev` lo hace) y **sólo si el store arranca vacío**: nunca pisa nada |
| `dev-operators.json`      | Operadores de administración para desarrollo: id, huellas SHA-256 de sus tokens (nunca el token) y alcance (`"*"` o merchants).                                                                                                                                                                         | fuente            | `composition/operators-config.ts` → `Operator.of`; `DefaultAdminTokenResolver` resuelve el bearer por huella                                                                 | La forma en composición; las reglas en `Operator.of`; `node scripts/mint-admin-token.mjs` acuña token y huella                        | `OPE_ADMIN_OPERATORS` (JSON) o `OPE_ADMIN_OPERATORS_FILE` | Sólo cuando la variable lo nombra (`npm run dev`); sin operadores nadie administra                              |

## Release o desarrollo

| Archivo                                    | Viaja con el release | Sólo desarrollo    |
| ------------------------------------------ | -------------------- | ------------------ |
| `platform.json`, `treatment-defaults.json` | sí                   |                    |
| `dev-merchants.json`, `dev-operators.json` |                      | sí (`npm run dev`) |

En `package.json`, `dev` es el único script que nombra los archivos de desarrollo
(`OPE_MERCHANTS_FILE=config/dev-merchants.json OPE_ADMIN_OPERATORS_FILE=config/dev-operators.json`);
no hay default implícito (ADR-018). Los del release se leen de la ruta del repositorio salvo que
su variable nombre otra.

## Cómo se reporta un valor inválido

`readConfig` rechaza con `ConfigError` lo que no puede arrancar el servidor: nombra la variable
o el archivo y el campo, y el proceso sale con error antes de escuchar. Los mensajes citan el
campo con su ruta:

- `platform.<campo>` / `treatmentDefaults.<campo>` — un valor fuera de rango juzgado por las
  fábricas del dominio (`PlatformConfiguration.of`, `TreatmentDefaults.of`) o una clave que el
  esquema no admite (los lectores son de forma cerrada).
- `merchants[i].<campo>`, `merchants[i].experiments[j].<campo>`, `merchants[i].origins[k]` —
  la semilla; las reglas son las del agregado `Merchant` y de `Experiment`.
- `operators[i].operatorId`, `operators[i].tokenFingerprints[k]`, `operators[i].scope` — los
  operadores.

## Qué significa cada campo

La fuente de cada campo de los dos niveles es el contrato:
`contracts/components/schemas/PlatformConfiguration.yaml` y `TreatmentDefaults.yaml` (y sus
sub-esquemas: `DecisionPolicy`, `CommercialPolicy`, `Freshness`, `SyncLevelRules`, …), con su
descripción y su rango. El glosario explica el concepto:
[configuración de plataforma](../docs/dominio/configuracion-de-plataforma.md) y
[defaults de tratamiento](../docs/dominio/defaults-de-tratamiento.md). Las convenciones de
unidades: milisegundos en los nombres `*Ms`, porcentajes enteros 0–100 en los nombres `*Percent`
(adentro del dominio son tasas 0–1), segundos en `*Seconds`.
