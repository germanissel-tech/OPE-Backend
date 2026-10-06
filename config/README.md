# config/ — la configuración que el servidor lee al arrancar

Ninguna política vive en el código (constitución XI, ADR-031): todo valor que gobierna el
comportamiento es configuración en tres niveles. Los dos primeros están acá: el nivel de plataforma
(`platform.json`) y los defaults de tratamiento (`treatment-defaults.json`). El tercero —la versión de
configuración de cada merchant— nunca fue un archivo: lo publica un operador por la API de
administración y vive en el store. Los otros dos archivos de este directorio son **sólo de
desarrollo**: la semilla de merchants y los operadores que `npm run dev` carga; en cualquier otro
entorno los nombra la variable de entorno o no existen.

**Desde la feature 036 los tres niveles se publican por la API, así que ningún archivo de acá es la
fuente de lo que rige: los dos del release son la semilla de su versión 1.** Se importan una sola vez,
sobre un almacén de niveles vacío, a nombre del operador `system`, y lo que está vigente es la última
versión que un operador publicó —numerada, inmutable y con su nombre acuñado del número
(`platform-1`, `defaults-3`)—. Desde el segundo arranque, editar un archivo del release **no hace
nada**; cambiar un valor es una operación, no un deploy. La enmienda de ADR-031 dice por qué.

**Y ninguno de los dos archivos nombra su versión.** La acuña el almacén desde el número (`platform-1`, `defaults-3`), así que un archivo no puede declarar un nombre: declararlo dejaba un string que nadie leía y que **podía chocar** —la segunda publicación acuña `platform-2`, para otro contenido—, y un nombre que significa dos tratamientos es justo lo que numerar vino a impedir. Lo que el arranque le pone a lo que lee es `platform-seed` / `defaults-seed`, que ninguna publicación puede acuñar: si ese nombre aparece en una decisión, algo sirvió el archivo en vez del nivel vigente y lo dice.

**Y eso ya valía para la semilla de merchants** (feature 033): a un store que ya tiene merchants no se
le aplica, lo mismo que a la configuración declarada y los experimentos que trae. En las dos
situaciones el arranque **lo dice en el log**, que es la diferencia entre una decisión y un
descubrimiento; para cambiar algo hay API.

## Inventario

| Entrada                   | Qué es                                                                                                                                                                                                                                                                                                                                                                                                                                                | Fuente o derivado | Quién lo lee                                                                                                                                                                                                                                                           | Verificación                                                                                                                                                                                        | Variable de entorno                                       | Cuándo se lee                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `platform.json`           | **Semilla de la versión 1 del nivel 1**: reglas globales del despliegue que ningún merchant sobrescribe (ventana de deduplicación, tolerancias de reloj, memoria de sesión y visitante, ventana de firma, gracia de rotación, tope de diagnósticos, `Retry-After`). **No nombra una versión**: la acuña el almacén, y lo vigente es la última publicada, cuyo nombre se estampa en cada decisión.                                                     | fuente            | `composition/levels-config.ts` → `readPlatformConfiguration` (aplicación) → `PlatformConfiguration.of` (dominio) → `importConfigurationLevels`; lo vigente se lee del almacén de niveles y se publica por `POST /v1/admin/platform-configuration`                      | `contract:check` (esquema `PlatformConfigurationContent` del contrato); `check:behaviour-constants` vigila que ningún valor vuelva al código                                                        | `OPE_PLATFORM_CONFIG` (ruta de otro archivo)              | Al arrancar, siempre; sin él el servidor no levanta. Se **aplica** sólo si el nivel no tiene ninguna versión    |
| `treatment-defaults.json` | **Semilla de la versión 1 del nivel 2**: lo que rige para todo merchant que no declaró el valor (frescura, nivel de sincronización, holdout, políticas de decisión y comercial, perfil de evidencia, superficies, barreras, estrategia de sincronización, idiomas). Es tratamiento entero, y **tampoco nombra una versión**: el nombre que se estampa en cada decisión es el de la versión vigente, que numera el almacén.                            | fuente            | `composition/levels-config.ts` → `readTreatmentDefaults` → `TreatmentDefaults.of` → `importConfigurationLevels`; lo vigente se lee del almacén de niveles y se publica por `POST /v1/admin/treatment-defaults`                                                         | `contract:check` (esquema `TreatmentDefaultsContent`); una prueba verifica que cada valor resuelve al vocabulario del código                                                                        | `OPE_TREATMENT_DEFAULTS` (ruta de otro archivo)           | Al arrancar, siempre; se **aplica** sólo si el nivel no tiene ninguna versión                                   |
| `messages.json`           | La **semilla** de los textos base (feature 027; semilla desde la 038): los textos que una persona ve, por familia de mensaje e idioma, sin voz ni versión declarada. Se importa una sola vez, sobre un almacén de textos vacío, como versión 1 de cada clave en la capa base; desde el segundo arranque lo vigente es lo que un operador publicó por la API y editar este archivo no hace nada. No es una política: es contenido (constitución VIII). | fuente            | `composition/corpus-config.ts` → `readCorpus` (sólo la forma) → `ImportTextsUseCase` → `TextVersion.draft` (dominio) y la completitud de la base contra los idiomas de los niveles sembrados; el módulo `messages` sirve lo vigente desde memoria en el camino crítico | `TextVersion.draft` rechaza una clave fuera del vocabulario y un texto vacío, más largo que el contrato o con un hueco sin resolver; una semilla que deja la base incompleta no arranca el servidor | `OPE_MESSAGE_CORPUS` (ruta de otro archivo)               | Sólo en un almacén de textos vacío                                                                              |
| `dev-merchants.json`      | Semilla de merchants para desarrollo: claves crudas (el import las huellea), orígenes, experimentos, y lo que `MerchantConfigurationDeclared` admite (se publica como versión 1 del merchant).                                                                                                                                                                                                                                                        | fuente            | `composition/merchants-config.ts` y `experiments-config.ts` → `ImportMerchantsUseCase`, `ImportExperimentsUseCase`, `ImportMerchantConfigurationUseCase` (operador `system`)                                                                                           | La forma en composición; las reglas en `Merchant.of`, `Experiment` y el lector de configuración declarada                                                                                           | `OPE_MERCHANTS` (JSON en línea) o `OPE_MERCHANTS_FILE`    | Sólo cuando la variable lo nombra (`npm run dev` lo hace) y **sólo si el store arranca vacío**: nunca pisa nada |
| `dev-operators.json`      | Operadores de administración para desarrollo: id, huellas SHA-256 de sus tokens (nunca el token) y alcance (`"*"` o merchants).                                                                                                                                                                                                                                                                                                                       | fuente            | `composition/operators-config.ts` → `Operator.of`; `DefaultAdminTokenResolver` resuelve el bearer por huella                                                                                                                                                           | La forma en composición; las reglas en `Operator.of`; `node scripts/mint-admin-token.mjs` acuña token y huella                                                                                      | `OPE_ADMIN_OPERATORS` (JSON) o `OPE_ADMIN_OPERATORS_FILE` | Sólo cuando la variable lo nombra (`npm run dev`); sin operadores nadie administra                              |
| `schemas/`                | Esquemas JSON escritos una vez para lo que no es DTO de la API: la semilla de merchants (`merchants-seed.schema.json`) y los operadores (`operators.schema.json`); descripción por campo. Los de los dos niveles se generan en `generated/schemas/`.                                                                                                                                                                                                  | fuente            | el editor (por `$schema` de cada archivo) y `tests/unit/composition/config-schemas.test.ts`                                                                                                                                                                            | la prueba cruza cada esquema con su lector sobre fixtures válidos, inválidos y más estrictos                                                                                                        | —                                                         | —                                                                                                               |

## Release o desarrollo

| Archivo                                                     | Viaja con el release | Sólo desarrollo    |
| ----------------------------------------------------------- | -------------------- | ------------------ |
| `platform.json`, `treatment-defaults.json`, `messages.json` | sí                   |                    |
| `dev-merchants.json`, `dev-operators.json`                  |                      | sí (`npm run dev`) |

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

## Esquemas: el editor y la suite validan cada archivo

Cada archivo nombra su esquema JSON en `$schema` (los lectores lo quitan antes de juzgar la
forma; nunca llega al dominio) y `tests/unit/composition/config-schemas.test.ts` lo valida en
cada corrida:

| Archivo                   | Esquema                                                        | Origen                                                                                                                |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `platform.json`           | `generated/schemas/platform-configuration-content.schema.json` | generado desde `PlatformConfigurationContent` del contrato (`contract:types`): los valores, sin la versión            |
| `treatment-defaults.json` | `generated/schemas/treatment-defaults-content.schema.json`     | generado desde `TreatmentDefaultsContent` del contrato                                                                |
| `messages.json`           | —                                                              | sin esquema propio: su forma la juzga `readCorpus` y sus reglas el dominio al importar (`TextVersion.draft`)          |
| `dev-merchants.json`      | `schemas/merchants-seed.schema.json`                           | escrito una vez; las políticas declaradas referencian `generated/schemas/merchant-configuration-declared.schema.json` |
| `dev-operators.json`      | `schemas/operators.schema.json`                                | escrito una vez                                                                                                       |

La semilla y los operadores se escriben como el objeto del esquema (`{ "$schema", "merchants": [...] }`,
`{ "$schema", "operators": [...] }`); en la variable de entorno en línea (`OPE_MERCHANTS`,
`OPE_ADMIN_OPERATORS`) vale también el array a secas. Los esquemas describen la **forma** (tipos,
rangos, patrones, claves admitidas); las reglas de negocio siguen en su dueño (`Merchant.of`,
`Experiment.of`, `Operator.of`, las fábricas de configuración) y algunas se juzgan al importar,
no al leer. En dos puntos el esquema es más estricto que el lector, a propósito, porque lleva la
forma del contrato: el patrón de `merchantId` y de las huellas (hex de 64), y las claves
desconocidas (el lector las ignora; la API las rechaza). La prueba mantiene esa lista en
`tests/unit/composition/fixtures/config-schemas/*/stricter/`.

## Qué significa cada campo

La fuente de cada campo de los dos niveles es el contrato:
`contracts/components/schemas/PlatformConfiguration.yaml` y `TreatmentDefaults.yaml` (y sus
sub-esquemas: `DecisionPolicy`, `CommercialPolicy`, `Freshness`, `SyncLevelRules`, …), con su
descripción y su rango. El glosario explica el concepto:
[configuración de plataforma](../docs/dominio/configuracion-de-plataforma.md) y
[defaults de tratamiento](../docs/dominio/defaults-de-tratamiento.md). Las convenciones de
unidades: milisegundos en los nombres `*Ms`, fracciones de 1 en los nombres `*Share`
(la misma unidad afuera y adentro, ADR-035), segundos en `*Seconds`.
